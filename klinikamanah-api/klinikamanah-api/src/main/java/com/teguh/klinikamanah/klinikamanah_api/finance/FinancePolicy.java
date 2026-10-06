package com.teguh.klinikamanah.klinikamanah_api.finance;

import org.springframework.stereotype.Component;

import com.teguh.klinikamanah.klinikamanah_api.auth.AuthUser;
import com.teguh.klinikamanah.klinikamanah_api.domain.Bill;
import com.teguh.klinikamanah.klinikamanah_api.domain.CashSession;
import com.teguh.klinikamanah.klinikamanah_api.domain.CashTransaction;
import com.teguh.klinikamanah.klinikamanah_api.domain.Payment;

/**
 * Who may do what on bills, payments, cashier sessions and cash transactions (dokumentasi bagian 10),
 * matching BillPolicy, PaymentPolicy, CashSessionPolicy and CashTransactionPolicy of the Laravel application.
 */
@Component
public class FinancePolicy {

    // ------------------------------------------------------------------ bills

    public boolean viewAnyBills(AuthUser user) {
        return user.allows(user.can("bills.view"));
    }

    public boolean viewBill(AuthUser user, Bill bill) {
        return user.allows(user.can("bills.view") && user.canAccessClinic(bill.getClinicId()));
    }

    /**
     * Bill the visits of the user's own clinic.
     */
    public boolean createBill(AuthUser user) {
        return user.clinicId() != null && user.allows(user.can("bills.create"));
    }

    public boolean updateBill(AuthUser user, Bill bill) {
        return user.allows(user.can("bills.create") && user.canAccessClinic(bill.getClinicId()) && bill.isDraft());
    }

    /**
     * Receive the payment of the patient for the bill.
     */
    public boolean payBill(AuthUser user, Bill bill) {
        return user.allows(user.can("bills.pay")
                && user.canAccessClinic(bill.getClinicId())
                && !bill.isCoveredByGuarantor()
                && bill.isDraft());
    }

    public boolean finalizeBill(AuthUser user, Bill bill) {
        return user.allows(user.can("bills.create")
                && user.canAccessClinic(bill.getClinicId())
                && bill.isCoveredByGuarantor()
                && bill.isDraft());
    }

    public boolean reopenBill(AuthUser user, Bill bill) {
        return user.allows(user.can("bills.create")
                && user.canAccessClinic(bill.getClinicId())
                && bill.isReceivable()
                && bill.getPaidAmount().signum() <= 0);
    }

    /**
     * Record the settlement of the receivable by its guarantor.
     */
    public boolean settleBill(AuthUser user, Bill bill) {
        return user.allows(user.can("receivables.settle") && user.canAccessClinic(bill.getClinicId()) && bill.isReceivable());
    }

    // --------------------------------------------------------------- payments

    public boolean viewPayment(AuthUser user, Payment payment) {
        return user.allows(user.can("bills.view") && user.canAccessClinic(payment.getClinicId()));
    }

    /**
     * Payments of a closed cashier session stay as they are.
     */
    public boolean cancelPayment(AuthUser user, Payment payment) {
        return user.allows(user.can("payments.cancel")
                && user.canAccessClinic(payment.getClinicId())
                && !payment.isCancelled()
                && (payment.getSession() == null || payment.getSession().isOpen()));
    }

    // ----------------------------------------------------------- cash sessions

    public boolean viewAnySessions(AuthUser user) {
        return user.allows(user.can("cash_sessions.view"));
    }

    public boolean viewSession(AuthUser user, CashSession session) {
        return user.allows(user.can("cash_sessions.view") && user.canAccessClinic(session.getClinicId()));
    }

    public boolean createSession(AuthUser user) {
        return user.clinicId() != null && user.allows(user.can("cash_sessions.create"));
    }

    /**
     * Only the cashier owning the open session closes it.
     */
    public boolean closeSession(AuthUser user, CashSession session) {
        return user.allows(user.can("cash_sessions.create") && user.id().equals(session.getUserId()) && session.isOpen());
    }

    // ------------------------------------------------------- cash transactions

    public boolean viewAnyTransactions(AuthUser user) {
        return user.allows(user.can("cash_transactions.view"));
    }

    public boolean viewTransaction(AuthUser user, CashTransaction transaction) {
        return user.allows(user.can("cash_transactions.view") && user.canAccessClinic(transaction.getClinicId()));
    }

    public boolean createTransaction(AuthUser user) {
        return user.clinicId() != null && user.allows(user.can("cash_transactions.create"));
    }

    /**
     * Transactions of a closed cashier session stay as they are.
     */
    public boolean cancelTransaction(AuthUser user, CashTransaction transaction) {
        return user.allows(user.can("cash_transactions.cancel")
                && user.canAccessClinic(transaction.getClinicId())
                && !transaction.isCancelled()
                && (transaction.getSession() == null || transaction.getSession().isOpen()));
    }
}
