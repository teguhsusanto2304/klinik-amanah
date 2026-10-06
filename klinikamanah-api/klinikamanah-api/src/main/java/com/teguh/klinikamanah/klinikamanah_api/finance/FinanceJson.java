package com.teguh.klinikamanah.klinikamanah_api.finance;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.teguh.klinikamanah.klinikamanah_api.auth.AuthUser;
import com.teguh.klinikamanah.klinikamanah_api.common.AppTime;
import com.teguh.klinikamanah.klinikamanah_api.common.Formats;
import com.teguh.klinikamanah.klinikamanah_api.domain.Bill;
import com.teguh.klinikamanah.klinikamanah_api.domain.BillItem;
import com.teguh.klinikamanah.klinikamanah_api.domain.CashSession;
import com.teguh.klinikamanah.klinikamanah_api.domain.CashTransaction;
import com.teguh.klinikamanah.klinikamanah_api.domain.Clinic;
import com.teguh.klinikamanah.klinikamanah_api.domain.Guarantor;
import com.teguh.klinikamanah.klinikamanah_api.domain.Labels;
import com.teguh.klinikamanah.klinikamanah_api.domain.MedicalRecord;
import com.teguh.klinikamanah.klinikamanah_api.domain.Patient;
import com.teguh.klinikamanah.klinikamanah_api.domain.Payment;
import com.teguh.klinikamanah.klinikamanah_api.domain.PaymentDetail;
import com.teguh.klinikamanah.klinikamanah_api.domain.User;
import com.teguh.klinikamanah.klinikamanah_api.domain.Visit;
import com.teguh.klinikamanah.klinikamanah_api.repository.BillItemRepository;
import com.teguh.klinikamanah.klinikamanah_api.repository.CashTransactionRepository;
import com.teguh.klinikamanah.klinikamanah_api.repository.PaymentRepository;

import lombok.RequiredArgsConstructor;

/**
 * Response objects of the finance API (dokumentasi bagian 7), matching the Laravel API resources.
 * Relations are only shown when requested through the include names, like whenLoaded().
 */
@Component
@RequiredArgsConstructor
public class FinanceJson {

    /**
     * Relations of a bill: "clinic", "guarantor", "user", "items", "payments" and "visit".
     */
    public static final Set<String> BILL_DETAIL = Set.of("clinic", "guarantor", "user", "items", "payments", "visit");

    private final FinancePolicy policy;
    private final CashSessionService sessionService;
    private final BillItemRepository billItems;
    private final PaymentRepository payments;
    private final CashTransactionRepository cashTransactions;
    private final AppTime time;

    // ------------------------------------------------------------------ bills

    public Map<String, Object> bill(Bill bill, AuthUser user, Set<String> include) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", bill.getId());
        json.put("number", bill.getNumber());
        json.put("bill_date", Formats.date(bill.getBillDate()));
        json.put("status", bill.getStatus());
        json.put("status_label", bill.statusLabel());
        json.put("payer_type", bill.getPayerType());
        json.put("payer_label", bill.payerLabel());
        json.put("services_total", Formats.num(bill.getServicesTotal()));
        json.put("medical_total", Formats.num(bill.getMedicalTotal()));
        json.put("nursing_total", Formats.num(bill.getNursingTotal()));
        json.put("laboratory_total", Formats.num(bill.getLaboratoryTotal()));
        json.put("pharmacy_total", Formats.num(bill.getPharmacyTotal()));
        json.put("discount", Formats.num(bill.getDiscount()));
        json.put("total", Formats.num(bill.getTotal()));
        json.put("paid_amount", Formats.num(bill.getPaidAmount()));
        json.put("outstanding", Formats.num(bill.outstanding()));
        json.put("notes", bill.getNotes());
        json.put("finalized_at", Formats.iso(bill.getFinalizedAt()));

        if (include.contains("clinic")) {
            json.put("clinic", clinic(bill.getClinic()));
        }
        if (include.contains("guarantor")) {
            json.put("guarantor", guarantor(bill.getGuarantor()));
        }
        if (include.contains("user")) {
            json.put("user", user(bill.getUser()));
        }
        if (include.contains("visit")) {
            json.put("visit", visit(bill.getVisit(), Set.of("medical_record", "doctor", "polyclinic")));
        }
        if (include.contains("items")) {
            json.put("items", billItems.findByBillIdOrderById(bill.getId()).stream().map(this::billItem).toList());
        }
        if (include.contains("payments")) {
            json.put("payments", payments.findByBillIdOrderByIdDesc(bill.getId()).stream()
                    .map(payment -> payment(payment, user, Set.of("user", "details", "session", "canceller")))
                    .toList());
        }

        Map<String, Object> abilities = new LinkedHashMap<>();
        abilities.put("update", policy.updateBill(user, bill));
        abilities.put("pay", policy.payBill(user, bill));
        abilities.put("finalize", policy.finalizeBill(user, bill));
        abilities.put("reopen", policy.reopenBill(user, bill));
        abilities.put("settle", policy.settleBill(user, bill));

        json.put("abilities", abilities);
        json.put("created_at", Formats.iso(bill.getCreatedAt()));
        json.put("updated_at", Formats.iso(bill.getUpdatedAt()));

        return json;
    }

    private Map<String, Object> billItem(BillItem item) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", item.getId());
        json.put("type", item.type());
        json.put("service_tariff_id", item.getServiceTariffId());
        json.put("description", item.getDescription());
        json.put("quantity", item.getQuantity());
        json.put("unit_price", Formats.num(item.getUnitPrice()));
        json.put("subtotal", Formats.num(item.getSubtotal()));

        return json;
    }

    /**
     * Visit listed on the billing page, with its bill (null when not billed yet) and the next billing step of the user.
     */
    public Map<String, Object> billingVisit(Visit visit, Bill bill, AuthUser user) {
        Map<String, Object> json = visit(visit, Set.of("clinic", "medical_record", "doctor", "polyclinic", "guarantor"));
        json.put("bill", bill == null ? null : bill(bill, user, Set.of()));

        // keep the key order of the Laravel resource: bill before the timestamps
        Object createdAt = json.remove("created_at");
        Object updatedAt = json.remove("updated_at");
        json.put("created_at", createdAt);
        json.put("updated_at", updatedAt);
        json.put("billing_action", billingAction(visit, bill, user));

        return json;
    }

    private String billingAction(Visit visit, Bill bill, AuthUser user) {
        if (bill != null && bill.isFinalized()) {
            return "view";
        }
        if (user.belongsToClinic(visit.getClinicId()) && policy.createBill(user)) {
            return bill != null ? "process" : "create";
        }
        return bill != null ? "view" : null;
    }

    // ----------------------------------------------------------------- visits

    /**
     * Visit with the relations named in include: "clinic", "medical_record", "doctor", "polyclinic", "guarantor".
     */
    public Map<String, Object> visit(Visit visit, Set<String> include) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", visit.getId());
        json.put("visit_date", Formats.date(visit.getVisitDate()));
        json.put("queue_number", visit.getQueueNumber());
        json.put("formatted_queue_number", visit.formattedQueueNumber());
        json.put("status", visit.getStatus());
        json.put("status_label", Labels.VISIT_STATUSES.get(visit.getStatus()));
        json.put("complaint", visit.getComplaint());

        if (include.contains("clinic")) {
            json.put("clinic", clinic(visit.getClinic()));
        }
        if (include.contains("medical_record")) {
            json.put("medical_record", medicalRecord(visit.getMedicalRecord()));
        }
        if (include.contains("doctor") && visit.getDoctor() != null) {
            Map<String, Object> doctor = new LinkedHashMap<>();
            doctor.put("id", visit.getDoctor().getId());
            doctor.put("name", visit.getDoctor().getName());
            doctor.put("specialty", null);
            json.put("doctor", doctor);
        }
        if (include.contains("polyclinic")) {
            Map<String, Object> polyclinic = null;

            if (visit.getPolyclinic() != null) {
                polyclinic = new LinkedHashMap<>();
                polyclinic.put("id", visit.getPolyclinic().getId());
                polyclinic.put("code", visit.getPolyclinic().getCode());
                polyclinic.put("name", visit.getPolyclinic().getName());
            }

            json.put("polyclinic", polyclinic);
        }

        json.put("payment_type", visit.getPaymentType());
        json.put("payment_type_label", Labels.PAYMENT_TYPES.get(visit.getPaymentType()));

        if (include.contains("guarantor")) {
            json.put("guarantor", guarantor(visit.getGuarantor()));
        }

        json.put("guarantor_member_number", visit.getGuarantorMemberNumber());

        Map<String, Object> referral = new LinkedHashMap<>();
        referral.put("type", visit.getReferralType());
        referral.put("type_label", Labels.REFERRAL_TYPES.get(visit.getReferralType()));
        referral.put("facility", visit.getReferralFacility());
        referral.put("number", visit.getReferralNumber());
        referral.put("date", Formats.date(visit.getReferralDate()));
        referral.put("has_document", visit.isHasReferralDocument());

        json.put("referral", referral);
        json.put("created_at", Formats.iso(visit.getCreatedAt()));
        json.put("updated_at", Formats.iso(visit.getUpdatedAt()));

        return json;
    }

    private Map<String, Object> medicalRecord(MedicalRecord record) {
        if (record == null) {
            return null;
        }

        Patient patient = record.getPatient();
        Map<String, Object> patientJson = null;

        if (patient != null) {
            patientJson = new LinkedHashMap<>();
            patientJson.put("id", patient.getId());
            patientJson.put("nik", patient.getNik());
            patientJson.put("name", patient.getName());
            patientJson.put("birth_date", Formats.date(patient.getBirthDate()));
            patientJson.put("age", patient.age(time.today()));
            patientJson.put("gender", patient.getGender());
            patientJson.put("gender_label", patient.genderLabel());
            patientJson.put("phone", patient.getPhone());
        }

        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", record.getId());
        json.put("number", record.getNumber());
        json.put("patient", patientJson);

        return json;
    }

    // --------------------------------------------------------------- payments

    /**
     * Payment with the relations named in include: "user", "details", "session", "canceller",
     * "bill" (with its guarantor) and "bill_visit" (the bill with its guarantor and patient).
     */
    public Map<String, Object> payment(Payment payment, AuthUser user, Set<String> include) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", payment.getId());
        json.put("number", payment.getNumber());
        json.put("bill_id", payment.getBillId());
        json.put("payer_type", payment.getPayerType());
        json.put("status", payment.getStatus());
        json.put("status_label", payment.statusLabel());
        json.put("paid_at", Formats.iso(payment.getPaidAt()));
        json.put("amount", Formats.num(payment.getAmount()));
        json.put("tendered", Formats.num(payment.getTendered()));
        json.put("change_amount", Formats.num(payment.getChangeAmount()));
        json.put("notes", payment.getNotes());

        if (include.contains("details")) {
            json.put("details", payment.getDetails().stream().map(this::paymentDetail).toList());
            json.put("method_labels", payment.methodLabels());
        }
        if (include.contains("user")) {
            json.put("user", user(payment.getUser()));
        }
        if (include.contains("session")) {
            json.put("session", sessionReference(payment.getSession()));
        }

        json.put("cancelled_at", Formats.iso(payment.getCancelledAt()));

        if (include.contains("canceller")) {
            json.put("canceller", user(payment.getCanceller()));
        }

        json.put("cancellation_reason", payment.getCancellationReason());
        json.put("can_cancel", policy.cancelPayment(user, payment));

        if (include.contains("bill")) {
            json.put("bill", bill(payment.getBill(), user, Set.of("guarantor")));
        } else if (include.contains("bill_visit")) {
            Map<String, Object> bill = bill(payment.getBill(), user, Set.of("guarantor"));
            bill.put("visit", visit(payment.getBill().getVisit(), Set.of("medical_record")));
            json.put("bill", bill);
        }

        json.put("created_at", Formats.iso(payment.getCreatedAt()));

        return json;
    }

    private Map<String, Object> paymentDetail(PaymentDetail detail) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("method", detail.getMethod());
        json.put("method_label", detail.methodLabel());
        json.put("amount", Formats.num(detail.getAmount()));
        json.put("reference", detail.getReference());

        return json;
    }

    // ---------------------------------------------------------- cash sessions

    /**
     * Cashier session; the detail adds the summary of its money, its payments and its cash transactions.
     */
    public Map<String, Object> session(CashSession session, AuthUser user, boolean detail) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", session.getId());
        json.put("number", session.getNumber());
        json.put("status", session.getStatus());
        json.put("status_label", session.statusLabel());
        json.put("opened_at", Formats.iso(session.getOpenedAt()));
        json.put("opening_balance", Formats.num(session.getOpeningBalance()));
        json.put("opening_notes", session.getOpeningNotes());
        json.put("closed_at", Formats.iso(session.getClosedAt()));
        json.put("expected_cash", Formats.num(session.getExpectedCash()));
        json.put("counted_cash", Formats.num(session.getCountedCash()));
        json.put("difference", Formats.num(session.getDifference()));
        json.put("closing_notes", session.getClosingNotes());
        json.put("clinic", clinic(session.getClinic()));
        json.put("user", user(session.getUser()));

        if (detail) {
            json.put("summary", sessionService.summary(session).toJson());
            json.put("payments", payments.findByCashSessionIdOrderByPaidAtAscIdAsc(session.getId()).stream()
                    .map(payment -> payment(payment, user, Set.of("details", "bill_visit")))
                    .toList());
            json.put("cash_transactions", cashTransactions.findByCashSessionIdOrderById(session.getId()).stream()
                    .map(transaction -> cashTransaction(transaction, user, Set.of("user")))
                    .toList());
        }

        json.put("can_close", policy.closeSession(user, session));
        json.put("created_at", Formats.iso(session.getCreatedAt()));

        return json;
    }

    // ------------------------------------------------------ cash transactions

    public static final Set<String> TRANSACTION_RELATIONS = Set.of("clinic", "user", "session", "canceller");

    /**
     * Cash transaction with the relations named in include: "clinic", "user", "session", "canceller".
     */
    public Map<String, Object> cashTransaction(CashTransaction transaction, AuthUser user, Set<String> include) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", transaction.getId());
        json.put("number", transaction.getNumber());
        json.put("type", transaction.getType());
        json.put("type_label", transaction.typeLabel());
        json.put("category", transaction.getCategory());
        json.put("category_label", transaction.categoryLabel());
        json.put("method", transaction.getMethod());
        json.put("method_label", transaction.methodLabel());
        json.put("status", transaction.getStatus());
        json.put("status_label", transaction.statusLabel());
        json.put("transaction_date", Formats.date(transaction.getTransactionDate()));
        json.put("amount", Formats.num(transaction.getAmount()));
        json.put("description", transaction.getDescription());
        json.put("reference", transaction.getReference());

        if (include.contains("clinic")) {
            json.put("clinic", clinic(transaction.getClinic()));
        }
        if (include.contains("user")) {
            json.put("user", user(transaction.getUser()));
        }
        if (include.contains("session")) {
            json.put("session", sessionReference(transaction.getSession()));
        }

        json.put("cancelled_at", Formats.iso(transaction.getCancelledAt()));

        if (include.contains("canceller")) {
            json.put("canceller", user(transaction.getCanceller()));
        }

        json.put("cancellation_reason", transaction.getCancellationReason());
        json.put("can_cancel", policy.cancelTransaction(user, transaction));
        json.put("created_at", Formats.iso(transaction.getCreatedAt()));

        return json;
    }

    // ---------------------------------------------------------------- helpers

    private static Map<String, Object> clinic(Clinic clinic) {
        return clinic == null ? null : idName(clinic.getId(), clinic.getName());
    }

    private static Map<String, Object> user(User user) {
        return user == null ? null : idName(user.getId(), user.getName());
    }

    private static Map<String, Object> guarantor(Guarantor guarantor) {
        if (guarantor == null) {
            return null;
        }

        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", guarantor.getId());
        json.put("code", guarantor.getCode());
        json.put("name", guarantor.getName());

        return json;
    }

    private static Map<String, Object> sessionReference(CashSession session) {
        if (session == null) {
            return null;
        }

        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", session.getId());
        json.put("number", session.getNumber());
        json.put("status", session.getStatus());

        return json;
    }

    private static Map<String, Object> idName(Long id, String name) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", id);
        json.put("name", name);

        return json;
    }

    /**
     * Single object response {data, message}; the message is omitted when null.
     */
    public static Map<String, Object> wrap(Object data, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("data", data);

        if (message != null) {
            body.put("message", message);
        }

        return body;
    }

    public static Map<String, Object> wrap(Object data) {
        return wrap(data, null);
    }
}
