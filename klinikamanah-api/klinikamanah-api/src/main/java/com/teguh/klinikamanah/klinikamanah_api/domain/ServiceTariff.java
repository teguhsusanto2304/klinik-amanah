package com.teguh.klinikamanah.klinikamanah_api.domain;

import java.math.BigDecimal;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Price of a service offered by a clinic, billed to patients on their visits.
 */
@Entity
@Table(name = "service_tariffs")
@Getter
@Setter
public class ServiceTariff extends BaseEntity {

    private Long clinicId;

    private String code;

    private String name;

    private String category;

    private BigDecimal price;

    private boolean isActive;

    public String categoryLabel() {
        return Labels.TARIFF_CATEGORIES.get(category);
    }
}
