package com.teguh.klinikamanah.klinikamanah_api.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "guarantors")
@Getter
@Setter
public class Guarantor extends BaseEntity {

    private Long clinicId;

    private String code;

    private String name;
}
