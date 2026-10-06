package com.teguh.klinikamanah.klinikamanah_api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.teguh.klinikamanah.klinikamanah_api.domain.BillItem;

public interface BillItemRepository extends JpaRepository<BillItem, Long> {

    List<BillItem> findByBillIdOrderById(Long billId);

    /**
     * Remove the services of the tariff master entered by the cashier.
     */
    @Modifying(flushAutomatically = true)
    @Query("""
            delete from BillItem i where i.billId = :billId
              and i.pharmacySaleId is null and i.nursingActionId is null
              and i.medicalActionId is null and i.labOrderItemId is null""")
    int deleteServiceItems(Long billId);

    /**
     * Remove the lines brought from the visit: medical and nursing actions, laboratory and pharmacy.
     */
    @Modifying(flushAutomatically = true)
    @Query("""
            delete from BillItem i where i.billId = :billId
              and (i.pharmacySaleId is not null or i.nursingActionId is not null
                or i.medicalActionId is not null or i.labOrderItemId is not null)""")
    int deleteVisitChargeItems(Long billId);
}
