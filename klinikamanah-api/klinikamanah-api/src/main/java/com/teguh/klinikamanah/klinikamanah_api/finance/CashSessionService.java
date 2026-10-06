package com.teguh.klinikamanah.klinikamanah_api.finance;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.teguh.klinikamanah.klinikamanah_api.auth.AuthUser;
import com.teguh.klinikamanah.klinikamanah_api.common.AppTime;
import com.teguh.klinikamanah.klinikamanah_api.common.DocumentNumbers;
import com.teguh.klinikamanah.klinikamanah_api.common.Formats;
import com.teguh.klinikamanah.klinikamanah_api.common.ValidationException;
import com.teguh.klinikamanah.klinikamanah_api.domain.CashSession;
import com.teguh.klinikamanah.klinikamanah_api.domain.Labels;
import com.teguh.klinikamanah.klinikamanah_api.domain.Payment;
import com.teguh.klinikamanah.klinikamanah_api.domain.PaymentDetail;
import com.teguh.klinikamanah.klinikamanah_api.repository.CashSessionRepository;
import com.teguh.klinikamanah.klinikamanah_api.repository.CashTransactionRepository;
import com.teguh.klinikamanah.klinikamanah_api.repository.PaymentRepository;

import lombok.RequiredArgsConstructor;

/**
 * Cashier sessions (port of the Laravel CashSession model).
 */
@Service
@RequiredArgsConstructor
public class CashSessionService {

    private final CashSessionRepository sessions;
    private final PaymentRepository payments;
    private final CashTransactionRepository transactions;
    private final DocumentNumbers numbers;
    private final Records records;
    private final AppTime time;

    /**
     * Money received and paid during a session. The expected cash is the starting cash plus the cash kept from
     * payments (net of change) and other cash income, minus the cash expenses.
     */
    public record Summary(BigDecimal openingBalance, int paymentCount, BigDecimal paymentsTotal, Map<String, BigDecimal> methods,
            BigDecimal cashIn, BigDecimal cashOut, BigDecimal expectedCash) {

        public Map<String, Object> toJson() {
            Map<String, Object> methodsJson = new LinkedHashMap<>();
            methods.forEach((method, amount) -> methodsJson.put(method, Formats.num(amount)));

            Map<String, Object> json = new LinkedHashMap<>();
            json.put("opening_balance", Formats.num(openingBalance));
            json.put("payment_count", paymentCount);
            json.put("payments_total", Formats.num(paymentsTotal));
            json.put("methods", methodsJson);
            json.put("cash_in", Formats.num(cashIn));
            json.put("cash_out", Formats.num(cashOut));
            json.put("expected_cash", Formats.num(expectedCash));

            return json;
        }
    }

    /**
     * Session the user is currently working in, if any.
     */
    public CashSession currentFor(AuthUser user) {
        return sessions.findFirstByUserIdAndStatusOrderByIdDesc(user.id(), Labels.SESSION_OPEN).orElse(null);
    }

    /**
     * Open a session of the user with the starting cash in the drawer.
     */
    @Transactional
    public CashSession open(AuthUser user, BigDecimal openingBalance, String openingNotes) {
        if (!sessions.lockByUserIdAndStatus(user.id(), Labels.SESSION_OPEN).isEmpty()) {
            throw ValidationException.of("opening_balance", "Anda masih memiliki sesi kasir yang belum ditutup.");
        }

        CashSession session = new CashSession();
        session.setClinicId(user.clinicId());
        session.setUserId(user.id());
        session.setNumber(numbers.next("cash_sessions", user.clinicId(), "KSR", time.today()));
        session.setStatus(Labels.SESSION_OPEN);
        session.setOpenedAt(time.now());
        session.setOpeningBalance(Formats.money(openingBalance));
        session.setOpeningNotes(openingNotes);

        return sessions.save(session);
    }

    /**
     * Close the session with the cash counted in the drawer, recording the difference with the expected cash.
     */
    @Transactional
    public CashSession close(Long sessionId, BigDecimal countedCash, String closingNotes) {
        CashSession session = records.lock(CashSession.class, sessionId);

        if (!session.isOpen()) {
            throw ValidationException.of("counted_cash", "Sesi kasir " + session.getNumber() + " sudah ditutup.");
        }

        BigDecimal expectedCash = summary(session).expectedCash();

        session.setCountedCash(Formats.money(countedCash));
        session.setClosingNotes(closingNotes);
        session.setStatus(Labels.SESSION_CLOSED);
        session.setClosedAt(time.now());
        session.setExpectedCash(expectedCash);
        session.setDifference(Formats.money(countedCash.subtract(expectedCash)));

        return session;
    }

    public Summary summary(CashSession session) {
        List<Payment> completed = payments.findByCashSessionIdAndStatus(session.getId(), Labels.PAYMENT_COMPLETED);
        Map<String, BigDecimal> methods = new LinkedHashMap<>();
        Labels.PAYMENT_METHODS.keySet().forEach(method -> methods.put(method, BigDecimal.ZERO));
        BigDecimal paymentsTotal = BigDecimal.ZERO;

        for (Payment payment : completed) {
            for (PaymentDetail detail : payment.getDetails()) {
                methods.merge(detail.getMethod(), detail.getAmount(), BigDecimal::add);
            }

            methods.merge(Labels.METHOD_CASH, payment.getChangeAmount().negate(), BigDecimal::add);
            paymentsTotal = paymentsTotal.add(payment.getAmount());
        }

        methods.replaceAll((method, amount) -> Formats.money(amount));

        BigDecimal cashIn = BigDecimal.ZERO;
        BigDecimal cashOut = BigDecimal.ZERO;

        for (Object[] row : transactions.sumCashBySessionGroupedByType(session.getId())) {
            if (Labels.TYPE_IN.equals(row[0])) {
                cashIn = (BigDecimal) row[1];
            } else if (Labels.TYPE_OUT.equals(row[0])) {
                cashOut = (BigDecimal) row[1];
            }
        }

        BigDecimal expectedCash = session.getOpeningBalance().add(methods.get(Labels.METHOD_CASH)).add(cashIn).subtract(cashOut);

        return new Summary(
                Formats.money(session.getOpeningBalance()),
                completed.size(),
                Formats.money(paymentsTotal),
                methods,
                Formats.money(cashIn),
                Formats.money(cashOut),
                Formats.money(expectedCash));
    }
}
