package com.teguh.klinikamanah.klinikamanah_api.finance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
import com.teguh.klinikamanah.klinikamanah_api.domain.CashSession;
import com.teguh.klinikamanah.klinikamanah_api.domain.CashTransaction;
import com.teguh.klinikamanah.klinikamanah_api.domain.Labels;
import com.teguh.klinikamanah.klinikamanah_api.repository.CashTransactionRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import lombok.RequiredArgsConstructor;

/**
 * Cash income and expenses outside of patient bills (dokumentasi bagian 6).
 */
@RestController
@RequestMapping("/api/cash-transactions")
@RequiredArgsConstructor
public class CashTransactionController {

    private static final int PER_PAGE = 15;

    private final CashTransactionService transactionService;
    private final CashSessionService sessionService;
    private final CashTransactionRepository transactions;
    private final FinancePolicy policy;
    private final FinanceJson json;
    private final Records records;
    private final AppTime time;
    private final EntityManager em;

    /**
     * Types, categories per type, methods and statuses of a transaction, along with the cashier session open for the user.
     */
    @GetMapping("/references")
    public Map<String, Object> references(AuthUser user) {
        ApiException.authorize(policy.viewAnyTransactions(user));

        Map<String, Object> categories = new LinkedHashMap<>();
        Labels.CASH_CATEGORIES.forEach((type, labels) -> categories.put(type, Labels.options(labels)));

        CashSession session = sessionService.currentFor(user);
        Map<String, Object> cashSession = null;

        if (session != null) {
            cashSession = new LinkedHashMap<>();
            cashSession.put("id", session.getId());
            cashSession.put("number", session.getNumber());
            cashSession.put("cash_in_drawer", Formats.num(sessionService.summary(session).expectedCash()));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("types", Labels.options(Labels.CASH_TYPES));
        data.put("categories", categories);
        data.put("methods", Labels.options(Labels.CASH_METHODS));
        data.put("statuses", Labels.options(Labels.CASH_STATUSES));
        data.put("cash_session", cashSession);

        return FinanceJson.wrap(data);
    }

    /**
     * Transactions visible to the user, the latest first, with the totals of the recorded ones per type.
     */
    @GetMapping
    public Map<String, Object> index(AuthUser user, @RequestParam Map<String, String> query) {
        ApiException.authorize(policy.viewAnyTransactions(user));

        Input input = Input.of(query)
                .attribute("type", "jenis transaksi")
                .attribute("from", "tanggal awal")
                .attribute("to", "tanggal akhir")
                .attribute("category", "kategori")
                .attribute("method", "metode")
                .attribute("status", "status")
                .attribute("search", "pencarian")
                .attribute("per_page", "jumlah per halaman");
        String type = input.in("type", false, Labels.CASH_TYPES.keySet());
        LocalDate from = input.dateFormat("from", false);
        LocalDate to = input.dateFormat("to", false);
        input.afterOrEqual("to", to, from, input.label("from"));
        String category = input.string("category", false, 50);
        String method = input.in("method", false, Labels.CASH_METHODS.keySet());
        String status = input.in("status", false, Labels.CASH_STATUSES.keySet());
        String search = input.string("search", false, 255);
        Integer perPage = input.integer("per_page", false, "1", "100");
        input.validate();

        Filters filters = new Filters(user, type, from, to, category, method, status, search);
        int page = Pagination.page(query);
        Page<CashTransaction> result = transactions.findAll((root, q, cb) -> filters.toPredicate(root, cb),
                PageRequest.of(page - 1, perPage != null ? perPage : PER_PAGE, Sort.by(Sort.Order.desc("transactionDate"), Sort.Order.desc("id"))));
        List<Map<String, Object>> data = result.getContent().stream()
                .map(transaction -> json.cashTransaction(transaction, user, FinanceJson.TRANSACTION_RELATIONS))
                .toList();

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("total_in", Formats.num(total(filters, Labels.TYPE_IN)));
        totals.put("total_out", Formats.num(total(filters, Labels.TYPE_OUT)));

        return Pagination.of(result, data, page, totals);
    }

    /**
     * Record the cash expense or other income; cash taken from or put in the drawer goes to the user's open session.
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> store(AuthUser user, @RequestBody(required = false) Map<String, Object> body) {
        ApiException.authorize(policy.createTransaction(user));

        Input input = Input.of(body)
                .attribute("type", "jenis transaksi")
                .attribute("category", "kategori")
                .attribute("method", "metode")
                .attribute("transaction_date", "tanggal")
                .attribute("amount", "jumlah")
                .attribute("description", "keterangan")
                .attribute("reference", "nomor bukti");
        String type = input.in("type", true, Labels.CASH_TYPES.keySet());
        Object rawType = input.get("type");
        String category = input.in("category", true,
                rawType instanceof String t ? Labels.CASH_CATEGORIES.getOrDefault(t, Map.of()).keySet() : List.of());
        String method = input.in("method", true, Labels.CASH_METHODS.keySet());
        LocalDate transactionDate = input.date("transaction_date", true);
        input.beforeOrEqual("transaction_date", transactionDate, time.today(), "today");
        BigDecimal amount = input.numeric("amount", true, "1", "9999999999");
        String description = input.string("description", true, 255);
        String reference = input.string("reference", false, 100);
        input.validate();

        CashTransaction transaction = transactionService.record(
                new CashTransactionService.Attributes(type, category, method, transactionDate, amount, description, reference), user);
        transaction = records.reload(CashTransaction.class, transaction.getId());
        String message = transaction.typeLabel() + " " + transaction.getNumber() + " sebesar Rp" + Formats.rupiah(transaction.getAmount()) + " berhasil dicatat.";

        return ResponseEntity.status(201).body(FinanceJson.wrap(json.cashTransaction(transaction, user, FinanceJson.TRANSACTION_RELATIONS), message));
    }

    @GetMapping("/{transactionId}")
    public Map<String, Object> show(AuthUser user, @PathVariable Long transactionId) {
        CashTransaction transaction = records.find(CashTransaction.class, transactionId);
        ApiException.authorize(policy.viewTransaction(user, transaction));

        return FinanceJson.wrap(json.cashTransaction(transaction, user, FinanceJson.TRANSACTION_RELATIONS));
    }

    @PatchMapping("/{transactionId}/cancel")
    public Map<String, Object> cancel(AuthUser user, @PathVariable Long transactionId, @RequestBody(required = false) Map<String, Object> body) {
        CashTransaction transaction = records.find(CashTransaction.class, transactionId);
        ApiException.authorize(policy.cancelTransaction(user, transaction));

        Input input = Input.of(body).attribute("cancellation_reason", "alasan pembatalan");
        String reason = input.string("cancellation_reason", true, 255);
        input.validate();

        transactionService.cancel(transactionId, reason, user);
        transaction = records.reload(CashTransaction.class, transactionId);

        return FinanceJson.wrap(json.cashTransaction(transaction, user, FinanceJson.TRANSACTION_RELATIONS),
                "Transaksi " + transaction.getNumber() + " dibatalkan.");
    }

    /**
     * Total amount of the recorded transactions of the type matching the filters.
     */
    private BigDecimal total(Filters filters, String type) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<BigDecimal> q = cb.createQuery(BigDecimal.class);
        Root<CashTransaction> root = q.from(CashTransaction.class);

        q.select(cb.coalesce(cb.sum(root.<BigDecimal>get("amount")), BigDecimal.ZERO))
                .where(filters.toPredicate(root, cb),
                        cb.equal(root.get("status"), Labels.CASH_COMPLETED),
                        cb.equal(root.get("type"), type));

        return em.createQuery(q).getSingleResult();
    }

    private record Filters(AuthUser user, String type, LocalDate from, LocalDate to, String category, String method, String status,
            String search) {

        Predicate toPredicate(Root<CashTransaction> root, CriteriaBuilder cb) {
            List<Predicate> predicates = new ArrayList<>();

            if (!user.managesAllClinics()) {
                predicates.add(user.clinicId() == null ? cb.disjunction() : cb.equal(root.get("clinicId"), user.clinicId()));
            }
            if (type != null) {
                predicates.add(cb.equal(root.get("type"), type));
            }
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("transactionDate"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("transactionDate"), to));
            }
            if (category != null) {
                predicates.add(cb.equal(root.get("category"), category));
            }
            if (method != null) {
                predicates.add(cb.equal(root.get("method"), method));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (search != null) {
                String like = "%" + search + "%";
                predicates.add(cb.or(cb.like(root.get("number"), like), cb.like(root.get("description"), like), cb.like(root.get("reference"), like)));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        }
    }
}
