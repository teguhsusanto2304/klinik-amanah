package com.teguh.klinikamanah.klinikamanah_api.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Payment of a visit bill, received from the patient at the cashier or from the guarantor settling its
 * receivable. A payment may combine several methods, e.g. part cash and part QRIS.
 */
@Entity
@Table(name = "payments")
@Getter
@Setter
public class Payment extends BaseEntity {

    private Long clinicId;

    @Column(name = "bill_id")
    private Long billId;

    @Column(name = "cash_session_id")
    private Long cashSessionId;

    @Column(name = "user_id")
    private Long userId;

    private String number;

    private String payerType;

    private String status;

    private Instant paidAt;

    private BigDecimal amount;

    private BigDecimal tendered;

    private BigDecimal changeAmount;

    private String notes;

    private Instant cancelledAt;

    @Column(name = "cancelled_by")
    private Long cancelledBy;

    private String cancellationReason;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "payment_id", nullable = false)
    @OrderBy("id")
    private List<PaymentDetail> details = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bill_id", insertable = false, updatable = false)
    private Bill bill;

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
        return Labels.PAYMENT_CANCELLED.equals(status);
    }

    public String statusLabel() {
        return Labels.PAYMENT_STATUSES.get(status);
    }

    /**
     * Human readable methods used, e.g. "QRIS, Tunai".
     */
    public String methodLabels() {
        Set<String> labels = new LinkedHashSet<>();

        details.stream().map(PaymentDetail::methodLabel).filter(Objects::nonNull).forEach(labels::add);

        return String.join(", ", labels);
    }
}
