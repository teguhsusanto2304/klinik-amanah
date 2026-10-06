package com.teguh.klinikamanah.klinikamanah_api.finance;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.teguh.klinikamanah.klinikamanah_api.auth.AuthUser;
import com.teguh.klinikamanah.klinikamanah_api.common.ApiException;
import com.teguh.klinikamanah.klinikamanah_api.common.Formats;
import com.teguh.klinikamanah.klinikamanah_api.common.Input;
import com.teguh.klinikamanah.klinikamanah_api.domain.Bill;
import com.teguh.klinikamanah.klinikamanah_api.domain.Labels;
import com.teguh.klinikamanah.klinikamanah_api.domain.Payment;

import lombok.RequiredArgsConstructor;

/**
 * Payments of bills (dokumentasi bagian 4).
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PaymentController {

    private static final Set<String> RELATIONS = Set.of("user", "details", "session", "canceller", "bill");

    private final PaymentService paymentService;
    private final FinancePolicy policy;
    private final FinanceJson json;
    private final Records records;

    /**
     * Process the payment of the bill: by the patient paying the whole bill within an open cashier session,
     * or by the guarantor settling all or part of its receivable.
     */
    @PostMapping("/bills/{billId}/payments")
    public ResponseEntity<Map<String, Object>> store(AuthUser user, @PathVariable Long billId,
            @RequestBody(required = false) Map<String, Object> body) {
        Bill bill = records.find(Bill.class, billId);

        Input input = Input.of(body)
                .attribute("details", "pembayaran")
                .attribute("details.*.method", "metode pembayaran")
                .attribute("details.*.amount", "jumlah")
                .attribute("details.*.reference", "nomor referensi")
                .attribute("notes", "catatan")
                .message("details.required", "Isi minimal satu metode pembayaran beserta jumlahnya.");

        // drop the rows left without an amount
        List<?> rawDetails = input.get("details") instanceof List<?> list ? list : List.of();
        input.put("details", rawDetails.stream()
                .filter(row -> row instanceof Map<?, ?> map && Input.isFilled(map.get("amount")))
                .toList());

        List<Object> rows = input.list("details", true, 1);
        List<PaymentService.Line> lines = new ArrayList<>();

        for (int i = 0; rows != null && i < rows.size(); i++) {
            String method = input.in("details." + i + ".method", true, Labels.PAYMENT_METHODS.keySet());
            BigDecimal amount = input.numeric("details." + i + ".amount", true, "1", "9999999999");
            String reference = input.string("details." + i + ".reference", false, 100);
            lines.add(new PaymentService.Line(method, amount, reference));
        }

        String notes = input.string("notes", false, 1000);
        input.validate();

        ApiException.authorize(bill.isCoveredByGuarantor() ? policy.settleBill(user, bill) : policy.payBill(user, bill));

        Payment payment = paymentService.record(billId, lines, notes, user);
        payment = records.reload(Payment.class, payment.getId());

        String message = "Pembayaran " + payment.getNumber() + " sebesar Rp" + Formats.rupiah(payment.getAmount()) + " berhasil dicatat.";

        if (payment.getChangeAmount().signum() > 0) {
            message += " Kembalian Rp" + Formats.rupiah(payment.getChangeAmount()) + ".";
        }

        return ResponseEntity.status(201).body(FinanceJson.wrap(json.payment(payment, user, RELATIONS), message));
    }

    /**
     * Payment, e.g. to print its receipt.
     */
    @GetMapping("/payments/{paymentId}")
    public Map<String, Object> show(AuthUser user, @PathVariable Long paymentId) {
        Payment payment = records.find(Payment.class, paymentId);
        ApiException.authorize(policy.viewPayment(user, payment));

        return FinanceJson.wrap(json.payment(payment, user, RELATIONS));
    }

    /**
     * Cancel the payment, reopening the bill it paid.
     */
    @PatchMapping("/payments/{paymentId}/cancel")
    public Map<String, Object> cancel(AuthUser user, @PathVariable Long paymentId, @RequestBody(required = false) Map<String, Object> body) {
        Payment payment = records.find(Payment.class, paymentId);
        ApiException.authorize(policy.cancelPayment(user, payment));

        Input input = Input.of(body).attribute("cancellation_reason", "alasan pembatalan");
        String reason = input.string("cancellation_reason", true, 255);
        input.validate();

        paymentService.cancel(paymentId, reason, user);
        payment = records.reload(Payment.class, paymentId);

        return FinanceJson.wrap(json.payment(payment, user, RELATIONS), "Pembayaran " + payment.getNumber() + " dibatalkan.");
    }
}
