package com.teguh.klinikamanah.klinikamanah_api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "medical_records")
@Getter
@Setter
public class MedicalRecord extends BaseEntity {

    private Long clinicId;

    @Column(name = "patient_id")
    private Long patientId;

    private String number;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", insertable = false, updatable = false)
    private Patient patient;
}
