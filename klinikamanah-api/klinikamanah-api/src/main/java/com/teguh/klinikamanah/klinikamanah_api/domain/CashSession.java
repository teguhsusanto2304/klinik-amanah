package com.teguh.klinikamanah.klinikamanah_api.domain;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Working session of a cashier: opened with the starting cash in the drawer, closed by reporting the cash
 * counted at the end, compared with the cash expected from the money received and paid during the session.
 */
@Entity
@Table(name = "cash_sessions")
@Getter
@Setter
public class CashSession extends BaseEntity {

    @Column(name = "clinic_id")
    private Long clinicId;

    @Column(name = "user_id")
    private Long userId;

    private String number;

    private String status;

    private Instant openedAt;

    private BigDecimal openingBalance;

    private String openingNotes;

    private Instant closedAt;

    private BigDecimal expectedCash;

    private BigDecimal countedCash;

    private BigDecimal difference;

    private String closingNotes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", insertable = false, updatable = false)
    private Clinic clinic;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    public boolean isOpen() {
        return Labels.SESSION_OPEN.equals(status);
    }

    public String statusLabel() {
        return Labels.SESSION_STATUSES.get(status);
    }
}
