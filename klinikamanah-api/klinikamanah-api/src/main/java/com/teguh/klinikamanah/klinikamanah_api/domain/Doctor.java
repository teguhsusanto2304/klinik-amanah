package com.teguh.klinikamanah.klinikamanah_api.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "doctors")
@Getter
@Setter
public class Doctor extends BaseEntity {

    private Long clinicId;

    /**
     * Account of the doctor; a doctor-only account sees only the visits registered to them.
     */
    private Long userId;

    private String name;
}
