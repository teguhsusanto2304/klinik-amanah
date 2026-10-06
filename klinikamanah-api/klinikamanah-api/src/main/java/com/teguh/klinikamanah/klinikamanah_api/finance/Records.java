package com.teguh.klinikamanah.klinikamanah_api.finance;

import org.springframework.stereotype.Component;

import com.teguh.klinikamanah.klinikamanah_api.common.ApiException;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;

/**
 * Loading and locking of records by id.
 */
@Component
@RequiredArgsConstructor
public class Records {

    private final EntityManager em;

    /**
     * Find the record or answer 404.
     */
    public <T> T find(Class<T> type, Long id) {
        T record = id == null ? null : em.find(type, id);

        if (record == null) {
            throw ApiException.notFound();
        }

        return record;
    }

    /**
     * Reload the record with a row lock (SELECT ... FOR UPDATE) held until the transaction ends.
     */
    public <T> T lock(Class<T> type, Long id) {
        T record = find(type, id);
        em.refresh(record, LockModeType.PESSIMISTIC_WRITE);

        return record;
    }

    /**
     * Find the record again after a change, with its relations loaded fresh from the database.
     */
    public <T> T reload(Class<T> type, Long id) {
        em.clear();

        return find(type, id);
    }
}
