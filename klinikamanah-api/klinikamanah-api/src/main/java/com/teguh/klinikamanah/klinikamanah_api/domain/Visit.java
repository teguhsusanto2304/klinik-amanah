package com.teguh.klinikamanah.klinikamanah_api.domain;

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
 * Patient visit registered to a doctor, billed by the cashier.
 */
@Entity
@Table(name = "visits")
@Getter
@Setter
public class Visit extends BaseEntity {

    @Column(name = "clinic_id")
    private Long clinicId;

    @Column(name = "medical_record_id")
    private Long medicalRecordId;

    @Column(name = "doctor_id")
    private Long doctorId;

    @Column(name = "polyclinic_id")
    private Long polyclinicId;

    private String paymentType;

    @Column(name = "guarantor_id")
    private Long guarantorId;

    private String guarantorMemberNumber;

    private String referralType;

    private String referralFacility;

    private String referralNumber;

    private LocalDate referralDate;

    private boolean hasReferralDocument;

    private LocalDate visitDate;

    private Integer queueNumber;

    private String complaint;

    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", insertable = false, updatable = false)
    private Clinic clinic;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "medical_record_id", insertable = false, updatable = false)
    private MedicalRecord medicalRecord;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", insertable = false, updatable = false)
    private Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "polyclinic_id", insertable = false, updatable = false)
    private Polyclinic polyclinic;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guarantor_id", insertable = false, updatable = false)
    private Guarantor guarantor;

    public boolean isCancelled() {
        return Labels.VISIT_CANCELLED.equals(status);
    }

    public String formattedQueueNumber() {
        return queueNumber == null ? null : String.format("%03d", queueNumber);
    }
}
