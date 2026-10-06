package com.teguh.klinikamanah.klinikamanah_api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import com.teguh.klinikamanah.klinikamanah_api.domain.CashTransaction;

public interface CashTransactionRepository extends JpaRepository<CashTransaction, Long>, JpaSpecificationExecutor<CashTransaction> {

    List<CashTransaction> findByCashSessionIdOrderById(Long cashSessionId);

    /**
     * Total of the recorded cash transactions of the session per type: [type, total].
     */
    @Query("""
            select t.type, sum(t.amount) from CashTransaction t
            where t.cashSessionId = :sessionId and t.status = 'completed' and t.method = 'cash'
            group by t.type""")
    List<Object[]> sumCashBySessionGroupedByType(Long sessionId);
}
