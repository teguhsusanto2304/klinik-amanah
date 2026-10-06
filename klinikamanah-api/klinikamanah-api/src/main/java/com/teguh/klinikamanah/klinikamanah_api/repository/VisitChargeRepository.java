package com.teguh.klinikamanah.klinikamanah_api.repository;

import java.util.List;

import org.springframework.stereotype.Repository;

import com.teguh.klinikamanah.klinikamanah_api.domain.Labels;
import com.teguh.klinikamanah.klinikamanah_api.domain.VisitCharges.LabOrderItem;
import com.teguh.klinikamanah.klinikamanah_api.domain.VisitCharges.MedicalAction;
import com.teguh.klinikamanah.klinikamanah_api.domain.VisitCharges.NursingAction;
import com.teguh.klinikamanah.klinikamanah_api.domain.VisitCharges.PharmacySale;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;

/**
 * Charges of a visit recorded by the clinical modules, brought onto its bill.
 */
@Repository
@RequiredArgsConstructor
public class VisitChargeRepository {

    private final EntityManager em;

    public List<MedicalAction> medicalActions(Long visitId) {
        return em.createQuery("select a from MedicalAction a where a.visitId = :visitId order by a.id", MedicalAction.class)
                .setParameter("visitId", visitId)
                .getResultList();
    }

    public List<NursingAction> nursingActions(Long visitId) {
        return em.createQuery("select a from NursingAction a where a.visitId = :visitId order by a.id", NursingAction.class)
                .setParameter("visitId", visitId)
                .getResultList();
    }

    /**
     * Laboratory examinations of the visit not cancelled, from orders not cancelled.
     */
    public List<LabOrderItem> laboratoryItems(Long visitId) {
        return em.createQuery("""
                        select i from LabOrderItem i join fetch i.order o
                        where o.visitId = :visitId and o.status <> :cancelled and i.status <> :cancelled
                        order by i.id""", LabOrderItem.class)
                .setParameter("visitId", visitId)
                .setParameter("cancelled", Labels.LAB_CANCELLED)
                .getResultList();
    }

    public List<PharmacySale> completedPharmacySales(Long visitId) {
        return em.createQuery("select s from PharmacySale s where s.visitId = :visitId and s.status = :status order by s.id", PharmacySale.class)
                .setParameter("visitId", visitId)
                .setParameter("status", Labels.PHARMACY_COMPLETED)
                .getResultList();
    }
}
