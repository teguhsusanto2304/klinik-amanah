package com.teguh.klinikamanah.klinikamanah_api.domain;

import java.time.LocalDate;
import java.time.Period;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "patients")
@Getter
@Setter
public class Patient extends BaseEntity {

    private String nik;

    private String name;

    private LocalDate birthDate;

    private String gender;

    private String phone;

    public Integer age(LocalDate today) {
        return birthDate == null ? null : Period.between(birthDate, today).getYears();
    }

    public String genderLabel() {
        return Labels.GENDERS.get(gender);
    }
}
