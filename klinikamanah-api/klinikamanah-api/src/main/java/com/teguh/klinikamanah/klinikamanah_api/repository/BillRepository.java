package com.teguh.klinikamanah.klinikamanah_api.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.teguh.klinikamanah.klinikamanah_api.domain.Bill;

import jakarta.persistence.LockModeType;

public interface BillRepository extends JpaRepository<Bill, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Bill b where b.visitId = :visitId")
    Optional<Bill> lockByVisitId(Long visitId);

    List<Bill> findByVisitIdIn(Collection<Long> visitIds);
}
