package com.teguh.klinikamanah.klinikamanah_api.finance;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.teguh.klinikamanah.klinikamanah_api.auth.AuthUser;
import com.teguh.klinikamanah.klinikamanah_api.common.AppTime;
import com.teguh.klinikamanah.klinikamanah_api.common.DocumentNumbers;
import com.teguh.klinikamanah.klinikamanah_api.common.Formats;
import com.teguh.klinikamanah.klinikamanah_api.common.ValidationException;
import com.teguh.klinikamanah.klinikamanah_api.domain.Bill;
import com.teguh.klinikamanah.klinikamanah_api.domain.BillItem;
import com.teguh.klinikamanah.klinikamanah_api.domain.Labels;
import com.teguh.klinikamanah.klinikamanah_api.domain.ServiceTariff;
import com.teguh.klinikamanah.klinikamanah_api.domain.Visit;
import com.teguh.klinikamanah.klinikamanah_api.domain.VisitCharges;
import com.teguh.klinikamanah.klinikamanah_api.repository.BillItemRepository;
import com.teguh.klinikamanah.klinikamanah_api.repository.BillRepository;
import com.teguh.klinikamanah.klinikamanah_api.repository.PaymentRepository;
import com.teguh.klinikamanah.klinikamanah_api.repository.ServiceTariffRepository;
import com.teguh.klinikamanah.klinikamanah_api.repository.VisitChargeRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;

/**
 * Bills of patient visits (port of the Laravel Bill model).
 */
@Service
@RequiredArgsConstructor
public class BillService {

    private final BillRepository bills;
    private final BillItemRepository items;
    private final PaymentRepository payments;
    private final ServiceTariffRepository tariffs;
    private final VisitChargeRepository visitCharges;
    private final DocumentNumbers numbers;
    private final Records records;
    private final AppTime time;
    private final EntityManager em;

    public record ServiceLine(Long serviceTariffId, int quantity) {
    }

    public record Saved(Long billId, boolean created) {
    }

    /**
     * Save the services charged on the bill of the visit, starting the bill on first save; the medical and nursing
     * actions, laboratory examinations and completed pharmacy sales of the visit are added automatically.
     */
    @Transactional
    public Saved upsert(Visit visit, AuthUser user, List<ServiceLine> services, BigDecimal discount, String notes) {
        Bill bill = bills.lockByVisitId(visit.getId()).orElse(null);
        boolean created = bill == null;

        if (created) {
            bill = new Bill();
            bill.setClinicId(visit.getClinicId());
            bill.setVisitId(visit.getId());
            bill.setGuarantorId(Labels.PAYMENT_GUARANTOR.equals(visit.getPaymentType()) ? visit.getGuarantorId() : null);
            bill.setUserId(user.id());
            bill.setNumber(numbers.next("bills", visit.getClinicId(), "INV", time.today()));
            bill.setBillDate(time.today());
            bill.setPayerType(visit.getPaymentType());
            bill.setStatus(Labels.BILL_DRAFT);
            bills.saveAndFlush(bill);
        }

        saveDraft(bill, services, discount, notes);

        return new Saved(bill.getId(), created);
    }

    /**
     * Replace the services charged on the draft bill, priced by the tariff master, and bring the visit charges up to date.
     */
    private void saveDraft(Bill bill, List<ServiceLine> services, BigDecimal discount, String notes) {
        ensureDraft(bill, "services");

        items.deleteServiceItems(bill.getId());

        Map<Long, ServiceTariff> prices = tariffs
                .findByClinicIdAndIsActiveTrueAndIdIn(bill.getClinicId(), services.stream().map(ServiceLine::serviceTariffId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(ServiceTariff::getId, Function.identity()));

        for (ServiceLine line : services) {
            ServiceTariff tariff = prices.get(line.serviceTariffId());

            addItem(bill, item -> item.setServiceTariffId(tariff.getId()), tariff.getName(), line.quantity(),
                    tariff.getPrice(), tariff.getPrice().multiply(BigDecimal.valueOf(line.quantity())));
        }

        bill.setDiscount(Formats.money(discount));
        bill.setNotes(notes);

        syncVisitCharges(bill);
    }

    /**
     * Finalize the draft bill covered by a guarantor into a receivable of the guarantor.
     */
    @Transactional
    public void finalizeToGuarantor(Long billId) {
        Bill bill = records.find(Bill.class, billId);
        ensureDraft(bill, "bill");

        if (!bill.isCoveredByGuarantor()) {
            throw ValidationException.of("bill", "Tagihan " + bill.getNumber() + " tidak ditanggung penjamin.");
        }

        syncVisitCharges(bill);

        if (bill.getTotal().signum() <= 0) {
            throw ValidationException.of("bill", "Tagihan belum memiliki item yang ditagihkan.");
        }

        bill.setStatus(Labels.BILL_RECEIVABLE);
        bill.setFinalizedAt(time.now());
    }

    /**
     * Turn a receivable not yet settled at all back into a draft, so its lines can be corrected.
     */
    @Transactional
    public void reopen(Long billId) {
        Bill bill = records.lock(Bill.class, billId);

        if (!bill.isReceivable() || bill.getPaidAmount().signum() > 0) {
            throw ValidationException.of("bill", "Tagihan " + bill.getNumber() + " tidak dapat dibuka kembali karena sudah dibayar.");
        }

        bill.setStatus(Labels.BILL_DRAFT);
        bill.setFinalizedAt(null);
    }

    /**
     * Replace the medical, nursing, laboratory and pharmacy lines with the charges of the visit and recalculate the
     * totals. Must be called inside a transaction while the bill is a draft.
     */
    public void syncVisitCharges(Bill bill) {
        Long visitId = bill.getVisitId();

        items.deleteVisitChargeItems(bill.getId());

        for (VisitCharges.MedicalAction action : visitCharges.medicalActions(visitId)) {
            addItem(bill, item -> {
                item.setMedicalActionId(action.getId());
                item.setServiceTariffId(action.getServiceTariffId());
            }, "Tindakan medis: " + action.getDescription(), action.getQuantity(), action.getUnitPrice(), action.getSubtotal());
        }

        for (VisitCharges.NursingAction action : visitCharges.nursingActions(visitId)) {
            addItem(bill, item -> {
                item.setNursingActionId(action.getId());
                item.setServiceTariffId(action.getServiceTariffId());
            }, "Tindakan keperawatan: " + action.getDescription(), action.getQuantity(), action.getUnitPrice(), action.getSubtotal());
        }

        for (VisitCharges.LabOrderItem labItem : visitCharges.laboratoryItems(visitId)) {
            addItem(bill, item -> {
                item.setLabOrderItemId(labItem.getId());
                item.setServiceTariffId(labItem.getServiceTariffId());
            }, "Laboratorium: " + labItem.getTestName() + " (" + labItem.getOrder().getNumber() + ")",
                    labItem.getQuantity(), labItem.getUnitPrice(), labItem.getTotalPrice());
        }

        for (VisitCharges.PharmacySale sale : visitCharges.completedPharmacySales(visitId)) {
            addItem(bill, item -> item.setPharmacySaleId(sale.getId()),
                    "Obat & alkes farmasi (" + sale.getNumber() + ")", 1, sale.getTotal(), sale.getTotal());
        }

        em.flush();

        Map<String, BigDecimal> totals = items.findByBillIdOrderById(bill.getId()).stream()
                .collect(Collectors.groupingBy(BillItem::type, Collectors.reducing(BigDecimal.ZERO, BillItem::getSubtotal, BigDecimal::add)));

        BigDecimal servicesTotal = totals.getOrDefault("service", BigDecimal.ZERO);
        BigDecimal medicalTotal = totals.getOrDefault("medical", BigDecimal.ZERO);
        BigDecimal nursingTotal = totals.getOrDefault("nursing", BigDecimal.ZERO);
        BigDecimal laboratoryTotal = totals.getOrDefault("laboratory", BigDecimal.ZERO);
        BigDecimal pharmacyTotal = totals.getOrDefault("pharmacy", BigDecimal.ZERO);
        BigDecimal grossTotal = servicesTotal.add(medicalTotal).add(nursingTotal).add(laboratoryTotal).add(pharmacyTotal);

        if (bill.getDiscount().compareTo(grossTotal) > 0) {
            throw ValidationException.of("discount", "Diskon tidak boleh melebihi jumlah tagihan.");
        }

        bill.setServicesTotal(Formats.money(servicesTotal));
        bill.setMedicalTotal(Formats.money(medicalTotal));
        bill.setNursingTotal(Formats.money(nursingTotal));
        bill.setLaboratoryTotal(Formats.money(laboratoryTotal));
        bill.setPharmacyTotal(Formats.money(pharmacyTotal));
        bill.setTotal(Formats.money(grossTotal.subtract(bill.getDiscount())));
    }

    /**
     * Recalculate the amount paid from the completed payments and derive the status of the bill from it.
     * Must be called inside a transaction.
     */
    public void refreshPaymentStatus(Bill bill) {
        em.flush();

        BigDecimal paidAmount = Formats.money(payments.sumCompletedAmount(bill.getId()));
        String status;

        if (paidAmount.signum() > 0 && paidAmount.compareTo(bill.getTotal()) >= 0) {
            status = Labels.BILL_PAID;
        } else if (bill.isCoveredByGuarantor()) {
            status = Labels.BILL_RECEIVABLE;
        } else {
            status = Labels.BILL_DRAFT;
        }

        bill.setPaidAmount(paidAmount);
        bill.setStatus(status);
        bill.setFinalizedAt(Labels.BILL_DRAFT.equals(status) ? null : (bill.getFinalizedAt() != null ? bill.getFinalizedAt() : time.now()));
    }

    /**
     * Lock the bill and make sure it is still a draft.
     */
    private void ensureDraft(Bill bill, String errorKey) {
        em.refresh(bill, LockModeType.PESSIMISTIC_WRITE);

        if (!bill.isDraft()) {
            throw ValidationException.of(errorKey, "Tagihan " + bill.getNumber() + " sudah final dan tidak dapat diubah.");
        }
    }

    private void addItem(Bill bill, Consumer<BillItem> source, String description, Integer quantity,
            BigDecimal unitPrice, BigDecimal subtotal) {
        BillItem item = new BillItem();
        item.setBillId(bill.getId());
        source.accept(item);
        item.setDescription(description);
        item.setQuantity(quantity);
        item.setUnitPrice(Formats.money(unitPrice));
        item.setSubtotal(Formats.money(subtotal));
        items.save(item);
    }
}
