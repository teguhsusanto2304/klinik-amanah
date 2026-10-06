package com.teguh.klinikamanah.klinikamanah_api.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "clinics")
@Getter
@Setter
public class Clinic extends BaseEntity {

    private String name;

    private boolean isActive;
}
