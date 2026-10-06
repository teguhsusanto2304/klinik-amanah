package com.teguh.klinikamanah.klinikamanah_api.finance;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.teguh.klinikamanah.klinikamanah_api.auth.AuthUser;
import com.teguh.klinikamanah.klinikamanah_api.common.AppTime;
import com.teguh.klinikamanah.klinikamanah_api.common.DocumentNumbers;
import com.teguh.klinikamanah.klinikamanah_api.common.Formats;
import com.teguh.klinikamanah.klinikamanah_api.common.ValidationException;
import com.teguh.klinikamanah.klinikamanah_api.domain.CashSession;
import com.teguh.klinikamanah.klinikamanah_api.domain.CashTransaction;
import com.teguh.klinikamanah.klinikamanah_api.domain.Labels;
import com.teguh.klinikamanah.klinikamanah_api.repository.CashTransactionRepository;

import lombok.RequiredArgsConstructor;

/**
 * Cash expenses and income outside of patient bills (port of the Laravel CashTransaction model).
 */
@Service
@RequiredArgsConstructor
public class CashTransactionService {

    private final CashTransactionRepository transactions;
    private final CashSessionService sessionService;
    private final DocumentNumbers numbers;
    private final Records records;
    private final AppTime time;

    public record Attributes(String type, String category, String method, LocalDate transactionDate, BigDecimal amount,
            String description, String reference) {
    }

    /**
     * Record a transaction of the user's clinic. Cash transactions go to the open cashier session of the user;
     * a cash expense cannot exceed the cash in its drawer.
     */
    @Transactional
    public CashTransaction record(Attributes attributes, AuthUser user) {
        boolean isCash = Labels.METHOD_CASH.equals(attributes.method());
        CashSession session = isCash ? sessionService.currentFor(user) : null;

        if (isCash && session == null) {
            throw ValidationException.of("method", "Buka sesi kasir terlebih dahulu untuk mencatat transaksi tunai.");
        }

        if (Labels.TYPE_OUT.equals(attributes.type()) && session != null) {
            BigDecimal cashInDrawer = sessionService.summary(session).expectedCash();

            if (attributes.amount().compareTo(cashInDrawer) > 0) {
                throw ValidationException.of("amount", "Jumlah kas keluar melebihi uang tunai di sesi kasir (Rp" + Formats.rupiah(cashInDrawer) + ").");
            }
        }

        CashTransaction transaction = new CashTransaction();
        transaction.setClinicId(user.clinicId());
        transaction.setCashSessionId(session == null ? null : session.getId());
        transaction.setUserId(user.id());
        transaction.setNumber(numbers.next("cash_transactions", user.clinicId(), Labels.CASH_PREFIXES.get(attributes.type()), time.today()));
        transaction.setType(attributes.type());
        transaction.setCategory(attributes.category());
        transaction.setMethod(attributes.method());
        transaction.setStatus(Labels.CASH_COMPLETED);
        transaction.setTransactionDate(attributes.transactionDate());
        transaction.setAmount(Formats.money(attributes.amount()));
        transaction.setDescription(attributes.description());
        transaction.setReference(attributes.reference());

        return transactions.save(transaction);
    }

    /**
     * Cancel the transaction. Transactions of a closed cashier session stay as they are.
     */
    @Transactional
    public void cancel(Long transactionId, String reason, AuthUser user) {
        CashTransaction transaction = records.lock(CashTransaction.class, transactionId);

        if (transaction.isCancelled()) {
            throw ValidationException.of("cancellation_reason", "Transaksi " + transaction.getNumber() + " sudah dibatalkan.");
        }
        if (transaction.getSession() != null && !transaction.getSession().isOpen()) {
            throw ValidationException.of("cancellation_reason",
                    "Sesi kasir " + transaction.getSession().getNumber() + " sudah ditutup, transaksi tidak dapat dibatalkan.");
        }

        transaction.setStatus(Labels.CASH_CANCELLED);
        transaction.setCancelledAt(time.now());
        transaction.setCancelledBy(user.id());
        transaction.setCancellationReason(reason);
    }
}
