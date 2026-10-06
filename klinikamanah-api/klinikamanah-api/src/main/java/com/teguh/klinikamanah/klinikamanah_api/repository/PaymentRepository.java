package com.teguh.klinikamanah.klinikamanah_api.repository;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.teguh.klinikamanah.klinikamanah_api.domain.Payment;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByBillIdOrderByIdDesc(Long billId);

    List<Payment> findByCashSessionIdOrderByPaidAtAscIdAsc(Long cashSessionId);

    List<Payment> findByCashSessionIdAndStatus(Long cashSessionId, String status);

    @Query("select coalesce(sum(p.amount), 0) from Payment p where p.billId = :billId and p.status = 'completed'")
    BigDecimal sumCompletedAmount(Long billId);
}
