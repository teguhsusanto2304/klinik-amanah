package com.teguh.klinikamanah.klinikamanah_api.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Cash expense of a clinic, or income outside of patient bills. Cash taken from or put in the drawer is
 * recorded in the open cashier session of the user.
 */
@Entity
@Table(name = "cash_transactions")
@Getter
@Setter
public class CashTransaction extends BaseEntity {

    @Column(name = "clinic_id")
    private Long clinicId;

    @Column(name = "cash_session_id")
    private Long cashSessionId;

    @Column(name = "user_id")
    private Long userId;

    private String number;

    private String type;

    private String category;

    private String method;

    private String status;

    private LocalDate transactionDate;

    private BigDecimal amount;

    private String description;

    private String reference;

    private Instant cancelledAt;

    @Column(name = "cancelled_by")
    private Long cancelledBy;

    private String cancellationReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", insertable = false, updatable = false)
    private Clinic clinic;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cash_session_id", insertable = false, updatable = false)
    private CashSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by", insertable = false, updatable = false)
    private User canceller;

    public boolean isCancelled() {
        return Labels.CASH_CANCELLED.equals(status);
    }

    public String typeLabel() {
        return Labels.CASH_TYPES.get(type);
    }

    public String categoryLabel() {
        return Labels.CASH_CATEGORIES.getOrDefault(type, Map.of()).get(category);
    }

    public String methodLabel() {
        return Labels.CASH_METHODS.get(method);
    }

    public String statusLabel() {
        return Labels.CASH_STATUSES.get(status);
    }
}
