package com.teguh.klinikamanah.klinikamanah_api.finance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.teguh.klinikamanah.klinikamanah_api.auth.AuthUser;
import com.teguh.klinikamanah.klinikamanah_api.common.ApiException;
import com.teguh.klinikamanah.klinikamanah_api.common.AppTime;
import com.teguh.klinikamanah.klinikamanah_api.common.Formats;
import com.teguh.klinikamanah.klinikamanah_api.common.Input;
import com.teguh.klinikamanah.klinikamanah_api.common.Pagination;
import com.teguh.klinikamanah.klinikamanah_api.domain.Bill;
import com.teguh.klinikamanah.klinikamanah_api.domain.CashSession;
import com.teguh.klinikamanah.klinikamanah_api.domain.Doctor;
import com.teguh.klinikamanah.klinikamanah_api.domain.Labels;
import com.teguh.klinikamanah.klinikamanah_api.domain.ServiceTariff;
import com.teguh.klinikamanah.klinikamanah_api.domain.Visit;
import com.teguh.klinikamanah.klinikamanah_api.repository.BillRepository;
import com.teguh.klinikamanah.klinikamanah_api.repository.ServiceTariffRepository;
import com.teguh.klinikamanah.klinikamanah_api.repository.VisitRepository;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;

/**
 * Bills of patient visits (dokumentasi bagian 3).
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class BillController {

    private static final int PER_PAGE = 20;
    private static final String UNBILLED = "unbilled";

    private final BillService billService;
    private final CashSessionService sessionService;
    private final FinancePolicy policy;
    private final FinanceJson json;
    private final Records records;
    private final VisitRepository visits;
    private final BillRepository bills;
    private final ServiceTariffRepository tariffs;
    private final AppTime time;

    /**
     * Options needed to bill a visit and receive its payment, along with the cashier session open for the user.
     */
    @GetMapping("/bills/references")
    public Map<String, Object> references(AuthUser user) {
        ApiException.authorize(policy.viewAnyBills(user));

        List<Map<String, Object>> serviceTariffs = user.clinicId() == null ? List.of()
                : tariffs.findByClinicIdAndIsActiveTrueOrderByCategoryAscNameAsc(user.clinicId()).stream().map(this::tariff).toList();
        CashSession session = sessionService.currentFor(user);
        Map<String, Object> cashSession = null;

        if (session != null) {
            cashSession = new LinkedHashMap<>();
            cashSession.put("id", session.getId());
            cashSession.put("number", session.getNumber());
            cashSession.put("opened_at", Formats.iso(session.getOpenedAt()));
            cashSession.put("summary", sessionService.summary(session).toJson());
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("payment_methods", Labels.options(Labels.PAYMENT_METHODS));
        data.put("statuses", Labels.options(Labels.BILL_STATUSES));
        data.put("payment_types", Labels.options(Labels.PAYMENT_TYPES));
        data.put("service_tariffs", serviceTariffs);
        data.put("cash_session", cashSession);

        return FinanceJson.wrap(data);
    }

    /**
     * Patient visits of a day (today by default) with the state of their bills and the next billing step of the user.
     */
    @GetMapping("/bills")
    public Map<String, Object> index(AuthUser user, @RequestParam Map<String, String> query) {
        ApiException.authorize(policy.viewAnyBills(user));

        Input input = Input.of(query)
                .attribute("date", "tanggal kunjungan")
                .attribute("search", "pencarian")
                .attribute("status", "status tagihan")
                .attribute("payment_type", "jenis penjamin")
                .attribute("per_page", "jumlah per halaman");
        LocalDate date = input.dateFormat("date", false);
        String search = input.string("search", false, 255);
        List<String> statuses = new ArrayList<>(List.of(UNBILLED));
        statuses.addAll(Labels.BILL_STATUSES.keySet());
        String status = input.in("status", false, statuses);
        String paymentType = input.in("payment_type", false, Labels.PAYMENT_TYPES.keySet());
        Integer perPage = input.integer("per_page", false, "1", "100");
        input.validate();

        LocalDate visitDate = date != null ? date : time.today();
        int page = Pagination.page(query);
        int size = perPage != null ? perPage : PER_PAGE;

        Specification<Visit> spec = visibleVisits(user)
                .and((root, q, cb) -> cb.notEqual(root.get("status"), Labels.VISIT_CANCELLED))
                .and((root, q, cb) -> cb.equal(root.get("visitDate"), visitDate));

        if (search != null) {
            String like = "%" + search + "%";
            spec = spec.and((root, q, cb) -> {
                Join<Object, Object> record = root.join("medicalRecord");
                return cb.or(cb.like(record.get("number"), like), cb.like(record.join("patient").get("name"), like));
            });
        }
        if (status != null) {
            spec = spec.and((root, q, cb) -> {
                Subquery<Long> bill = q.subquery(Long.class);
                var billRoot = bill.from(Bill.class);
                bill.select(billRoot.get("id")).where(cb.equal(billRoot.get("visitId"), root.get("id")),
                        UNBILLED.equals(status) ? cb.conjunction() : cb.equal(billRoot.get("status"), status));
                return UNBILLED.equals(status) ? cb.not(cb.exists(bill)) : cb.exists(bill);
            });
        }
        if (paymentType != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("paymentType"), paymentType));
        }

        Page<Visit> result = visits.findAll(spec, PageRequest.of(page - 1, size, Sort.by("queueNumber", "id")));
        Map<Long, Bill> billsByVisit = bills.findByVisitIdIn(result.getContent().stream().map(Visit::getId).toList()).stream()
                .collect(Collectors.toMap(Bill::getVisitId, Function.identity()));
        List<Map<String, Object>> data = result.getContent().stream()
                .map(visit -> json.billingVisit(visit, billsByVisit.get(visit.getId()), user))
                .toList();

        return Pagination.of(result, data, page, Map.of("date", visitDate.toString()));
    }

    /**
     * Save the services charged on the bill of the visit, starting the bill on first save.
     */
    @PutMapping("/visits/{visitId}/bill")
    public ResponseEntity<Map<String, Object>> upsert(AuthUser user, @PathVariable Long visitId,
            @RequestBody(required = false) Map<String, Object> body) {
        Visit visit = records.find(Visit.class, visitId);
        ApiException.authorize(policy.createBill(user));

        Input input = Input.of(body)
                .attribute("services.*.service_tariff_id", "layanan")
                .attribute("services.*.quantity", "jumlah")
                .attribute("discount", "diskon")
                .attribute("notes", "catatan");

        // drop the blank rows left in the form, and treat a blank discount as zero
        List<?> rawServices = input.get("services") instanceof List<?> list ? list : List.of();
        input.put("services", rawServices.stream()
                .filter(row -> row instanceof Map<?, ?> map && (Input.isFilled(map.get("service_tariff_id")) || Input.isFilled(map.get("quantity"))))
                .toList());
        if (!input.filled("discount")) {
            input.put("discount", 0);
        }

        List<Object> rows = input.list("services", false, 0);
        List<Integer> tariffIds = new ArrayList<>();
        List<Integer> quantities = new ArrayList<>();

        for (int i = 0; rows != null && i < rows.size(); i++) {
            tariffIds.add(input.integer("services." + i + ".service_tariff_id", true, null, null));
            quantities.add(input.integer("services." + i + ".quantity", true, "1", "1000"));
        }

        Set<Long> validTariffs = new HashSet<>();
        List<Long> requested = tariffIds.stream().filter(id -> id != null).map(Integer::longValue).distinct().toList();

        if (!requested.isEmpty()) {
            tariffs.findByClinicIdAndIsActiveTrueAndIdIn(visit.getClinicId(), requested).forEach(t -> validTariffs.add(t.getId()));
        }
        for (int i = 0; i < tariffIds.size(); i++) {
            if (tariffIds.get(i) != null && !validTariffs.contains(tariffIds.get(i).longValue())) {
                input.addError("services." + i + ".service_tariff_id", "The selected " + input.label("services." + i + ".service_tariff_id") + " is invalid.");
            }
        }

        BigDecimal discount = input.numeric("discount", false, "0", "9999999999");
        String notes = input.string("notes", false, 1000);
        input.validate();

        ApiException.authorize(user.belongsToClinic(visit.getClinicId()));
        if (visit.isCancelled()) {
            throw ApiException.notFound();
        }

        List<BillService.ServiceLine> services = new ArrayList<>();
        for (int i = 0; i < tariffIds.size(); i++) {
            services.add(new BillService.ServiceLine(tariffIds.get(i).longValue(), quantities.get(i)));
        }

        BillService.Saved saved = billService.upsert(visit, user, services, discount, notes);
        Bill bill = records.reload(Bill.class, saved.billId());
        String message = "Tagihan " + bill.getNumber() + " sebesar Rp" + Formats.rupiah(bill.getTotal()) + " berhasil disimpan.";

        return ResponseEntity.status(saved.created() ? 201 : 200).body(FinanceJson.wrap(detail(bill, user), message));
    }

    /**
     * Bill with its lines and payments, the latest payment first.
     */
    @GetMapping("/bills/{billId}")
    public Map<String, Object> show(AuthUser user, @PathVariable Long billId) {
        Bill bill = records.find(Bill.class, billId);
        ApiException.authorize(policy.viewBill(user, bill));

        return FinanceJson.wrap(detail(bill, user));
    }

    /**
     * Finalize the bill into a receivable of its guarantor.
     */
    @PatchMapping("/bills/{billId}/finalize")
    public Map<String, Object> finalizeBill(AuthUser user, @PathVariable Long billId) {
        Bill bill = records.find(Bill.class, billId);
        ApiException.authorize(policy.finalizeBill(user, bill));

        billService.finalizeToGuarantor(billId);
        bill = records.reload(Bill.class, billId);
        String guarantor = bill.getGuarantor() == null ? "" : bill.getGuarantor().getName();

        return FinanceJson.wrap(detail(bill, user), "Tagihan " + bill.getNumber() + " dicatat sebagai piutang " + guarantor + ".");
    }

    /**
     * Turn the unsettled receivable back into a draft.
     */
    @PatchMapping("/bills/{billId}/reopen")
    public Map<String, Object> reopen(AuthUser user, @PathVariable Long billId) {
        Bill bill = records.find(Bill.class, billId);
        ApiException.authorize(policy.reopenBill(user, bill));

        billService.reopen(billId);
        bill = records.reload(Bill.class, billId);

        return FinanceJson.wrap(detail(bill, user), "Tagihan " + bill.getNumber() + " dibuka kembali dan dapat diubah.");
    }

    private Map<String, Object> detail(Bill bill, AuthUser user) {
        return json.bill(bill, user, FinanceJson.BILL_DETAIL);
    }

    private Map<String, Object> tariff(ServiceTariff tariff) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", tariff.getId());
        data.put("code", tariff.getCode());
        data.put("name", tariff.getName());
        data.put("category", tariff.getCategory());
        data.put("category_label", tariff.categoryLabel());
        data.put("price", Formats.num(tariff.getPrice()));

        return data;
    }

    /**
     * Visits the user may see: those of their clinic (all clinics for the central admin), limited to their own
     * patients for a doctor account.
     */
    private Specification<Visit> visibleVisits(AuthUser user) {
        return (root, q, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (!user.managesAllClinics()) {
                predicates.add(user.clinicId() == null ? cb.disjunction() : cb.equal(root.get("clinicId"), user.clinicId()));
            }
            if (user.isLimitedToOwnPatients()) {
                Subquery<Long> doctor = q.subquery(Long.class);
                var doctorRoot = doctor.from(Doctor.class);
                doctor.select(doctorRoot.get("id")).where(cb.equal(doctorRoot.get("id"), root.get("doctorId")),
                        cb.equal(doctorRoot.get("userId"), user.id()));
                predicates.add(cb.exists(doctor));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
