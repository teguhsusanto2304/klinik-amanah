package com.teguh.klinikamanah.klinikamanah_api.domain;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Charges recorded by the clinical modules on a visit, brought onto the visit bill automatically.
 * Only the columns read by the finance module are mapped.
 */
public final class VisitCharges {

    private VisitCharges() {
    }

    /**
     * Service of the tariff master performed for a visit (medical or nursing action).
     */
    @MappedSuperclass
    @Getter
    @Setter
    public abstract static class Action extends BaseEntity {

        private Long visitId;

        private Long serviceTariffId;

        private String description;

        private Integer quantity;

        private BigDecimal unitPrice;

        private BigDecimal subtotal;
    }

    @Entity(name = "MedicalAction")
    @Table(name = "medical_actions")
    public static class MedicalAction extends Action {
    }

    @Entity(name = "NursingAction")
    @Table(name = "nursing_actions")
    public static class NursingAction extends Action {
    }

    @Entity(name = "LabOrder")
    @Table(name = "lab_orders")
    @Getter
    @Setter
    public static class LabOrder extends BaseEntity {

        private Long visitId;

        private String number;

        private String status;
    }

    @Entity(name = "LabOrderItem")
    @Table(name = "lab_order_items")
    @Getter
    @Setter
    public static class LabOrderItem extends BaseEntity {

        @Column(name = "lab_order_id")
        private Long labOrderId;

        private Long serviceTariffId;

        private String testName;

        private Integer quantity;

        private BigDecimal unitPrice;

        private BigDecimal totalPrice;

        private String status;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "lab_order_id", insertable = false, updatable = false)
        private LabOrder order;
    }

    @Entity(name = "PharmacySale")
    @Table(name = "pharmacy_sales")
    @Getter
    @Setter
    public static class PharmacySale extends BaseEntity {

        private Long visitId;

        private String number;

        private String status;

        private BigDecimal total;
    }
}
