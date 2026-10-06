package com.teguh.klinikamanah.klinikamanah_api.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.teguh.klinikamanah.klinikamanah_api.domain.ServiceTariff;

public interface ServiceTariffRepository extends JpaRepository<ServiceTariff, Long> {

    List<ServiceTariff> findByClinicIdAndIsActiveTrueOrderByCategoryAscNameAsc(Long clinicId);

    List<ServiceTariff> findByClinicIdAndIsActiveTrueAndIdIn(Long clinicId, Collection<Long> ids);
}
