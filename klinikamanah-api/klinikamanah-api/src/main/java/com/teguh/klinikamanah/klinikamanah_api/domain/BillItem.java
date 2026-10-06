package com.teguh.klinikamanah.klinikamanah_api.domain;

import java.math.BigDecimal;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Line of a visit bill. Its kind follows the filled foreign key; a line without any of them is a service
 * of the tariff master entered by the cashier.
 */
@Entity
@Table(name = "bill_items")
@Getter
@Setter
public class BillItem extends BaseEntity {

    private Long billId;

    private Long serviceTariffId;

    private Long pharmacySaleId;

    private Long nursingActionId;

    private Long medicalActionId;

    private Long labOrderItemId;

    private String description;

    private Integer quantity;

    private BigDecimal unitPrice;

    private BigDecimal subtotal;

    public String type() {
        if (medicalActionId != null) {
            return "medical";
        }
        if (nursingActionId != null) {
            return "nursing";
        }
        if (labOrderItemId != null) {
            return "laboratory";
        }
        if (pharmacySaleId != null) {
            return "pharmacy";
        }
        return "service";
    }
}
