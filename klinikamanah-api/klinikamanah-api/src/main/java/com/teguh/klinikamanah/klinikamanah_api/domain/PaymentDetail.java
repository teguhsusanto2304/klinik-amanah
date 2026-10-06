package com.teguh.klinikamanah.klinikamanah_api.domain;

import java.math.BigDecimal;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Amount of a payment paid with one method, e.g. the QRIS part of a payment.
 */
@Entity
@Table(name = "payment_details")
@Getter
@Setter
public class PaymentDetail extends BaseEntity {

    private String method;

    private BigDecimal amount;

    private String reference;

    public String methodLabel() {
        return Labels.PAYMENT_METHODS.get(method);
    }
}
