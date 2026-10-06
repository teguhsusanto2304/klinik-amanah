package com.teguh.klinikamanah.klinikamanah_api.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Bill of a patient visit: the services charged from the tariff master plus the medical and nursing actions,
 * the laboratory examinations and the completed pharmacy sales of the visit. A bill without a guarantor is paid
 * by the patient at the cashier; a bill covered by a guarantor is finalized into a receivable, settled later.
 */
@Entity
@Table(name = "bills")
@Getter
@Setter
public class Bill extends BaseEntity {

    @Column(name = "clinic_id")
    private Long clinicId;

    @Column(name = "visit_id")
    private Long visitId;

    @Column(name = "guarantor_id")
    private Long guarantorId;

    @Column(name = "user_id")
    private Long userId;

    private String number;

    private LocalDate billDate;

    private String payerType;

    private String status;

    private BigDecimal servicesTotal = BigDecimal.ZERO;

    private BigDecimal medicalTotal = BigDecimal.ZERO;

    private BigDecimal nursingTotal = BigDecimal.ZERO;

    private BigDecimal laboratoryTotal = BigDecimal.ZERO;

    private BigDecimal pharmacyTotal = BigDecimal.ZERO;

    private BigDecimal discount = BigDecimal.ZERO;

    private BigDecimal total = BigDecimal.ZERO;

    private BigDecimal paidAmount = BigDecimal.ZERO;

    private String notes;

    private Instant finalizedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", insertable = false, updatable = false)
    private Clinic clinic;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "visit_id", insertable = false, updatable = false)
    private Visit visit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guarantor_id", insertable = false, updatable = false)
    private Guarantor guarantor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    public boolean isCoveredByGuarantor() {
        return Labels.PAYMENT_GUARANTOR.equals(payerType);
    }

    public boolean isDraft() {
        return Labels.BILL_DRAFT.equals(status);
    }

    /**
     * Whether the bill has been finalized, either paid or turned into a receivable.
     */
    public boolean isFinalized() {
        return !isDraft();
    }

    public boolean isReceivable() {
        return Labels.BILL_RECEIVABLE.equals(status);
    }

    /**
     * Amount still to be paid, never below zero.
     */
    public BigDecimal outstanding() {
        BigDecimal outstanding = total.subtract(paidAmount);

        return outstanding.signum() < 0 ? BigDecimal.ZERO.setScale(2) : outstanding.setScale(2);
    }

    public String statusLabel() {
        return Labels.BILL_STATUSES.get(status);
    }

    public String payerLabel() {
        return Labels.PAYMENT_TYPES.get(payerType);
    }
}
