package com.teguh.klinikamanah.klinikamanah_api.finance;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.teguh.klinikamanah.klinikamanah_api.auth.AuthUser;
import com.teguh.klinikamanah.klinikamanah_api.common.AppTime;
import com.teguh.klinikamanah.klinikamanah_api.common.DocumentNumbers;
import com.teguh.klinikamanah.klinikamanah_api.common.Formats;
import com.teguh.klinikamanah.klinikamanah_api.common.ValidationException;
import com.teguh.klinikamanah.klinikamanah_api.domain.Bill;
import com.teguh.klinikamanah.klinikamanah_api.domain.CashSession;
import com.teguh.klinikamanah.klinikamanah_api.domain.Labels;
import com.teguh.klinikamanah.klinikamanah_api.domain.Payment;
import com.teguh.klinikamanah.klinikamanah_api.domain.PaymentDetail;
import com.teguh.klinikamanah.klinikamanah_api.repository.PaymentRepository;

import lombok.RequiredArgsConstructor;

/**
 * Payments of visit bills (port of the Laravel Payment model).
 */
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository payments;
    private final BillService billService;
    private final CashSessionService sessionService;
    private final DocumentNumbers numbers;
    private final Records records;
    private final AppTime time;

    public record Line(String method, BigDecimal amount, String reference) {
    }

    /**
     * Record a payment of the bill. The patient pays the whole bill at once within an open cashier session,
     * getting the change back from the cash; a guarantor settles all or part of its receivable.
     */
    @Transactional
    public Payment record(Long billId, List<Line> lines, String notes, AuthUser user) {
        Bill bill = records.lock(Bill.class, billId);
        CashSession session = sessionService.currentFor(user);
        BigDecimal tendered = Formats.money(lines.stream().map(Line::amount).reduce(BigDecimal.ZERO, BigDecimal::add));
        BigDecimal nonCash = Formats.money(lines.stream()
                .filter(line -> !Labels.METHOD_CASH.equals(line.method()))
                .map(Line::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        boolean paysCash = lines.stream().anyMatch(line -> Labels.METHOD_CASH.equals(line.method()));
        BigDecimal amount;

        if (bill.isCoveredByGuarantor()) {
            if (!bill.isReceivable()) {
                throw ValidationException.of("details", "Tagihan " + bill.getNumber() + " belum difinalisasi ke penjamin atau sudah lunas.");
            }
            if (paysCash && session == null) {
                throw ValidationException.of("details", "Buka sesi kasir terlebih dahulu untuk menerima pembayaran tunai.");
            }
            if (tendered.compareTo(bill.outstanding()) > 0) {
                throw ValidationException.of("details", "Jumlah pembayaran melebihi sisa piutang Rp" + Formats.rupiah(bill.outstanding()) + ".");
            }

            amount = tendered;
        } else {
            if (!bill.isDraft()) {
                throw ValidationException.of("details", "Tagihan " + bill.getNumber() + " sudah lunas.");
            }
            if (session == null) {
                throw ValidationException.of("details", "Buka sesi kasir terlebih dahulu sebelum menerima pembayaran pasien.");
            }

            billService.syncVisitCharges(bill);
            amount = bill.getTotal();

            if (amount.signum() <= 0) {
                throw ValidationException.of("details", "Tagihan belum memiliki item yang ditagihkan.");
            }
            if (tendered.compareTo(amount) < 0) {
                throw ValidationException.of("details", "Jumlah pembayaran kurang dari total tagihan Rp" + Formats.rupiah(amount) + ".");
            }
            if (nonCash.compareTo(amount) > 0) {
                throw ValidationException.of("details", "Pembayaran non tunai tidak boleh melebihi total tagihan.");
            }
        }

        Payment payment = new Payment();
        payment.setClinicId(bill.getClinicId());
        payment.setBillId(bill.getId());
        payment.setCashSessionId(session == null ? null : session.getId());
        payment.setUserId(user.id());
        payment.setNumber(numbers.next("payments", bill.getClinicId(), "BYR", time.today()));
        payment.setPayerType(bill.getPayerType());
        payment.setStatus(Labels.PAYMENT_COMPLETED);
        payment.setPaidAt(time.now());
        payment.setAmount(Formats.money(amount));
        payment.setTendered(tendered);
        payment.setChangeAmount(Formats.money(tendered.subtract(amount)));
        payment.setNotes(notes);

        for (Line line : lines) {
            PaymentDetail detail = new PaymentDetail();
            detail.setMethod(line.method());
            detail.setAmount(Formats.money(line.amount()));
            detail.setReference(line.reference());
            payment.getDetails().add(detail);
        }

        payments.save(payment);
        billService.refreshPaymentStatus(bill);

        return payment;
    }

    /**
     * Cancel the payment, reopening the bill it paid. Payments of a closed cashier session stay as they are,
     * since the session has already been reported.
     */
    @Transactional
    public void cancel(Long paymentId, String reason, AuthUser user) {
        Payment payment = records.lock(Payment.class, paymentId);

        if (payment.isCancelled()) {
            throw ValidationException.of("cancellation_reason", "Pembayaran " + payment.getNumber() + " sudah dibatalkan.");
        }
        if (payment.getSession() != null && !payment.getSession().isOpen()) {
            throw ValidationException.of("cancellation_reason",
                    "Sesi kasir " + payment.getSession().getNumber() + " sudah ditutup, pembayaran tidak dapat dibatalkan.");
        }

        payment.setStatus(Labels.PAYMENT_CANCELLED);
        payment.setCancelledAt(time.now());
        payment.setCancelledBy(user.id());
        payment.setCancellationReason(reason);

        billService.refreshPaymentStatus(records.lock(Bill.class, payment.getBillId()));
    }
}
