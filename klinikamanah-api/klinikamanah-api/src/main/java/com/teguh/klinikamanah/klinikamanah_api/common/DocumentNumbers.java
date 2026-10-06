package com.teguh.klinikamanah.klinikamanah_api.common;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Set;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/**
 * Numbers of finance documents per clinic, e.g. "INV-2610-0001" for the first bill of October 2026.
 * The sequence restarts every month for each clinic.
 */
@Component
@RequiredArgsConstructor
public class DocumentNumbers {

    private static final Set<String> TABLES = Set.of("bills", "payments", "cash_sessions", "cash_transactions");
    private static final DateTimeFormatter YEAR_MONTH = DateTimeFormatter.ofPattern("yyMM");

    private final JdbcTemplate jdbc;

    /**
     * Next number of the document; must be called inside the transaction creating the document,
     * the last number being locked until it commits.
     */
    public String next(String table, long clinicId, String prefix, LocalDate date) {
        if (!TABLES.contains(table)) {
            throw new IllegalArgumentException("Unknown document table " + table);
        }

        String pattern = prefix + "-" + date.format(YEAR_MONTH) + "-";
        String last = jdbc.queryForObject(
                "SELECT MAX(number) FROM " + table + " WHERE clinic_id = ? AND number LIKE ? FOR UPDATE",
                String.class, clinicId, pattern + "%");
        int sequence = last == null ? 1 : Integer.parseInt(last.substring(last.length() - 4)) + 1;

        return pattern + String.format("%04d", sequence);
    }
}
