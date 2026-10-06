package com.teguh.klinikamanah.klinikamanah_api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.teguh.klinikamanah.klinikamanah_api.domain.CashSession;

import jakarta.persistence.LockModeType;

public interface CashSessionRepository extends JpaRepository<CashSession, Long>, JpaSpecificationExecutor<CashSession> {

    Optional<CashSession> findFirstByUserIdAndStatusOrderByIdDesc(Long userId, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from CashSession s where s.userId = :userId and s.status = :status")
    List<CashSession> lockByUserIdAndStatus(Long userId, String status);
}
