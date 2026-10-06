package com.teguh.klinikamanah.klinikamanah_api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.teguh.klinikamanah.klinikamanah_api.domain.Visit;

public interface VisitRepository extends JpaRepository<Visit, Long>, JpaSpecificationExecutor<Visit> {
}
