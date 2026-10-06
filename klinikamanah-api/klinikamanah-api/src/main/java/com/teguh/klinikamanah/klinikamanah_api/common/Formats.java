package com.teguh.klinikamanah.klinikamanah_api.common;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Formatting of money, numbers and dates in API responses and messages.
 */
public final class Formats {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'").withZone(ZoneOffset.UTC);

    private Formats() {
    }

    /**
     * Money as a JSON number without trailing zeros: 90000.00 becomes 90000, 12500.50 becomes 12500.5.
     */
    public static Number num(BigDecimal value) {
        if (value == null) {
            return null;
        }

        BigDecimal stripped = value.stripTrailingZeros();

        // no ternary here: it would promote the long to a double
        if (stripped.scale() <= 0) {
            return stripped.longValueExact();
        }

        return stripped.doubleValue();
    }

    /**
     * Money in Indonesian notation without decimals, e.g. 90000 becomes "90.000" (PHP number_format($x, 0, ',', '.')).
     */
    public static String rupiah(BigDecimal value) {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols();
        symbols.setGroupingSeparator('.');
        symbols.setDecimalSeparator(',');

        DecimalFormat format = new DecimalFormat("#,##0", symbols);
        format.setRoundingMode(RoundingMode.HALF_UP);

        return format.format(value == null ? BigDecimal.ZERO : value);
    }

    /**
     * Timestamp in ISO 8601 UTC, e.g. "2026-10-06T09:15:00.000000Z".
     */
    public static String iso(Instant value) {
        return value == null ? null : ISO.format(value);
    }

    public static String date(LocalDate value) {
        return value == null ? null : value.toString();
    }

    /**
     * Round money to cents.
     */
    public static BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }
}
