package com.teguh.klinikamanah.klinikamanah_api.common;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Current date and time of the application, in the timezone configured by "app.timezone".
 */
@Component
public class AppTime {

    private final ZoneId zone;

    public AppTime(@Value("${app.timezone:UTC}") String timezone) {
        this.zone = ZoneId.of(timezone);
    }

    public LocalDate today() {
        return LocalDate.now(zone);
    }

    /**
     * Current instant at second precision, as stored in TIMESTAMP columns.
     */
    public Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.SECONDS);
    }

    public Instant startOfDay(LocalDate date) {
        return date.atStartOfDay(zone).toInstant();
    }
}
