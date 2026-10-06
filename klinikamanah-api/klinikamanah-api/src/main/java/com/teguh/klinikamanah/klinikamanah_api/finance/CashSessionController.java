package com.teguh.klinikamanah.klinikamanah_api.finance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
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
import com.teguh.klinikamanah.klinikamanah_api.domain.Labels;
import com.teguh.klinikamanah.klinikamanah_api.repository.CashSessionRepository;

import lombok.RequiredArgsConstructor;

/**
 * Cashier sessions (dokumentasi bagian 5).
 */
@RestController
@RequestMapping("/api/cash-sessions")
@RequiredArgsConstructor
public class CashSessionController {

    private static final int PER_PAGE = 15;

    private final CashSessionService sessionService;
    private final CashSessionRepository sessions;
    private final FinancePolicy policy;
    private final FinanceJson json;
    private final Records records;
    private final AppTime time;

    /**
     * Cashier sessions visible to the user, the latest first.
     */
    @GetMapping
    public Map<String, Object> index(AuthUser user, @RequestParam Map<String, String> query) {
        ApiException.authorize(policy.viewAnySessions(user));

        Input input = Input.of(query)
                .attribute("date", "tanggal")
                .attribute("status", "status")
                .attribute("per_page", "jumlah per halaman");
        LocalDate date = input.dateFormat("date", false);
        String status = input.in("status", false, Labels.SESSION_STATUSES.keySet());
        Integer perPage = input.integer("per_page", false, "1", "100");
        input.validate();

        Specification<CashSession> spec = visibleTo(user);

        if (date != null) {
            spec = spec.and((root, q, cb) -> cb.and(
                    cb.greaterThanOrEqualTo(root.get("openedAt"), time.startOfDay(date)),
                    cb.lessThan(root.get("openedAt"), time.startOfDay(date.plusDays(1)))));
        }
        if (status != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        }

        int page = Pagination.page(query);
        Page<CashSession> result = sessions.findAll(spec,
                PageRequest.of(page - 1, perPage != null ? perPage : PER_PAGE, Sort.by(Sort.Order.desc("openedAt"), Sort.Order.desc("id"))));
        List<Map<String, Object>> data = result.getContent().stream().map(session -> json.session(session, user, false)).toList();

        return Pagination.of(result, data, page, Map.of());
    }

    /**
     * Session the user is currently working in with the money received so far; data is null when none is open.
     */
    @GetMapping("/current")
    public Map<String, Object> current(AuthUser user) {
        ApiException.authorize(policy.viewAnySessions(user));

        CashSession session = sessionService.currentFor(user);

        return FinanceJson.wrap(session == null ? null : json.session(session, user, true));
    }

    /**
     * Open a session of the user with the starting cash in the drawer.
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> store(AuthUser user, @RequestBody(required = false) Map<String, Object> body) {
        ApiException.authorize(policy.createSession(user));

        Input input = Input.of(body)
                .attribute("opening_balance", "uang tunai awal")
                .attribute("opening_notes", "catatan");
        BigDecimal openingBalance = input.numeric("opening_balance", true, "0", "9999999999");
        String openingNotes = input.string("opening_notes", false, 1000);
        input.validate();

        CashSession session = sessionService.open(user, openingBalance, openingNotes);
        session = records.reload(CashSession.class, session.getId());
        String message = "Sesi kasir " + session.getNumber() + " dibuka dengan uang tunai awal Rp" + Formats.rupiah(session.getOpeningBalance()) + ".";

        return ResponseEntity.status(201).body(FinanceJson.wrap(json.session(session, user, true), message));
    }

    /**
     * Session with its payments, cash transactions and the summary of its money.
     */
    @GetMapping("/{sessionId}")
    public Map<String, Object> show(AuthUser user, @PathVariable Long sessionId) {
        CashSession session = records.find(CashSession.class, sessionId);
        ApiException.authorize(policy.viewSession(user, session));

        return FinanceJson.wrap(json.session(session, user, true));
    }

    /**
     * Close the session with the cash counted in the drawer; only its own cashier closes it.
     */
    @PatchMapping("/{sessionId}/close")
    public Map<String, Object> close(AuthUser user, @PathVariable Long sessionId, @RequestBody(required = false) Map<String, Object> body) {
        CashSession session = records.find(CashSession.class, sessionId);
        ApiException.authorize(policy.closeSession(user, session));

        Input input = Input.of(body)
                .attribute("counted_cash", "uang tunai fisik")
                .attribute("closing_notes", "catatan penutupan");
        BigDecimal countedCash = input.numeric("counted_cash", true, "0", "9999999999");
        String closingNotes = input.string("closing_notes", false, 1000);
        input.validate();

        sessionService.close(sessionId, countedCash, closingNotes);
        session = records.reload(CashSession.class, sessionId);

        BigDecimal difference = session.getDifference();
        String message = "Sesi kasir " + session.getNumber() + " ditutup.";

        if (difference.signum() != 0) {
            message += " Terdapat selisih " + (difference.signum() > 0 ? "lebih" : "kurang") + " Rp" + Formats.rupiah(difference.abs()) + ".";
        }

        return FinanceJson.wrap(json.session(session, user, true), message);
    }

    private static Specification<CashSession> visibleTo(AuthUser user) {
        return (root, q, cb) -> user.managesAllClinics() ? cb.conjunction()
                : user.clinicId() == null ? cb.disjunction() : cb.equal(root.get("clinicId"), user.clinicId());
    }
}
