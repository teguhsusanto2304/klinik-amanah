package com.teguh.klinikamanah.klinikamanah_api.common;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Request input with Laravel-like validation: strings are trimmed and blank strings become null
 * (TrimStrings + ConvertEmptyStringsToNull), each rule records an error under the field key, and
 * {@link #validate()} throws all of them at once as a 422 response.
 */
public class Input {

    private static final Pattern NUMERIC = Pattern.compile("^[+-]?(\\d+(\\.\\d*)?|\\.\\d+)([eE][+-]?\\d+)?$");
    private static final Pattern INTEGER = Pattern.compile("^[+-]?\\d+$");
    private static final Pattern DATE_YMD = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final Set<String> UNTRIMMED = Set.of("password", "password_confirmation", "current_password");

    private final Map<String, Object> data;
    private final Map<String, String> attributes = new HashMap<>();
    private final Map<String, String> messages = new HashMap<>();
    private final Map<String, List<String>> errors = new LinkedHashMap<>();

    private Input(Map<String, Object> data) {
        this.data = data;
    }

    @SuppressWarnings("unchecked")
    public static Input of(Map<String, ?> raw) {
        return new Input(raw == null ? new LinkedHashMap<>() : (Map<String, Object>) normalize(null, raw));
    }

    /**
     * Human readable name of a field used in the messages; the key may use "*" for list indexes, e.g. "details.*.amount".
     */
    public Input attribute(String key, String label) {
        attributes.put(key, label);
        return this;
    }

    /**
     * Custom message of a rule of a field, e.g. message("details.required", "...").
     */
    public Input message(String keyAndRule, String message) {
        messages.put(keyAndRule, message);
        return this;
    }

    /**
     * Raw value at a dotted path, e.g. "details.0.amount".
     */
    public Object get(String path) {
        Object current = data;

        for (String segment : path.split("\\.")) {
            if (current instanceof Map<?, ?> map) {
                current = map.get(segment);
            } else if (current instanceof List<?> list && INTEGER.matcher(segment).matches()) {
                int index = Integer.parseInt(segment);
                current = index >= 0 && index < list.size() ? list.get(index) : null;
            } else {
                return null;
            }
        }

        return current;
    }

    public void put(String key, Object value) {
        data.put(key, value);
    }

    public boolean filled(String path) {
        return isFilled(get(path));
    }

    public static boolean isFilled(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof String s) {
            return !s.isBlank();
        }
        if (value instanceof Collection<?> c) {
            return !c.isEmpty();
        }
        if (value instanceof Map<?, ?> m) {
            return !m.isEmpty();
        }
        return true;
    }

    // ---------------------------------------------------------------- rules

    public String string(String key, boolean required, int max) {
        Object value = get(key);

        if (!present(key, value, required)) {
            return null;
        }
        if (!(value instanceof String s)) {
            fail(key, "string", "The %s field must be a string.");
            return null;
        }
        if (s.codePointCount(0, s.length()) > max) {
            fail(key, "max", "The %s field must not be greater than " + max + " characters.");
            return null;
        }

        return s;
    }

    public BigDecimal numeric(String key, boolean required, String min, String max) {
        Object value = get(key);

        if (!present(key, value, required)) {
            return null;
        }

        BigDecimal number = toNumber(value);

        if (number == null) {
            fail(key, "numeric", "The %s field must be a number.");
            return null;
        }

        return withinBounds(key, number, min, max) ? number : null;
    }

    public Integer integer(String key, boolean required, String min, String max) {
        Object value = get(key);

        if (!present(key, value, required)) {
            return null;
        }

        BigDecimal number = toNumber(value);

        if (number == null || !isIntegral(value, number)) {
            fail(key, "integer", "The %s field must be an integer.");
            return null;
        }

        return withinBounds(key, number, min, max) ? number.intValueExact() : null;
    }

    public String in(String key, boolean required, Collection<String> allowed) {
        Object value = get(key);

        if (!present(key, value, required)) {
            return null;
        }

        String text = value instanceof Map || value instanceof Collection ? null : String.valueOf(value);

        if (text == null || !allowed.contains(text)) {
            fail(key, "in", "The selected %s is invalid.");
            return null;
        }

        return text;
    }

    /**
     * Rule "date_format:Y-m-d".
     */
    public LocalDate dateFormat(String key, boolean required) {
        Object value = get(key);

        if (!present(key, value, required)) {
            return null;
        }

        LocalDate date = value instanceof String s && DATE_YMD.matcher(s).matches() ? parseDate(s) : null;

        if (date == null) {
            fail(key, "date_format", "The %s field must match the format Y-m-d.");
        }

        return date;
    }

    /**
     * Rule "date": a date, optionally with a time.
     */
    public LocalDate date(String key, boolean required) {
        Object value = get(key);

        if (!present(key, value, required)) {
            return null;
        }

        LocalDate date = value instanceof String s ? parseDateTime(s) : null;

        if (date == null) {
            fail(key, "date", "The %s field must be a valid date.");
        }

        return date;
    }

    /**
     * Rule "array" (a JSON list) with an optional minimum amount of items.
     */
    public List<Object> list(String key, boolean required, int min) {
        Object value = get(key);

        if (!present(key, value, required)) {
            return null;
        }
        if (!(value instanceof List<?> list)) {
            fail(key, "array", "The %s field must be an array.");
            return null;
        }
        if (list.size() < min) {
            fail(key, "min", "The %s field must have at least " + min + " items.");
            return null;
        }

        return new ArrayList<>(list);
    }

    public void beforeOrEqual(String key, LocalDate value, LocalDate limit, String limitLabel) {
        if (value != null && !hasError(key) && value.isAfter(limit)) {
            fail(key, "before_or_equal", "The %s field must be a date before or equal to " + limitLabel + ".");
        }
    }

    public void afterOrEqual(String key, LocalDate value, LocalDate limit, String limitLabel) {
        if (value != null && limit != null && !hasError(key) && value.isBefore(limit)) {
            fail(key, "after_or_equal", "The %s field must be a date after or equal to " + limitLabel + ".");
        }
    }

    public void addError(String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }

    public boolean hasError(String key) {
        return errors.containsKey(key);
    }

    /**
     * Throw the collected errors as a 422 response.
     */
    public void validate() {
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }

    public String label(String key) {
        if (attributes.containsKey(key)) {
            return attributes.get(key);
        }

        String wildcard = key.replaceAll("\\.\\d+(?=\\.|$)", ".*");

        return attributes.getOrDefault(wildcard, key.replace('_', ' '));
    }

    // ---------------------------------------------------------------- helpers

    /**
     * Whether the remaining rules should run: records "required" when a required value is missing,
     * and skips the rules of an empty optional value.
     */
    private boolean present(String key, Object value, boolean required) {
        if (isFilled(value)) {
            return true;
        }
        if (required) {
            fail(key, "required", "The %s field is required.");
        }
        return false;
    }

    private boolean withinBounds(String key, BigDecimal number, String min, String max) {
        if (min != null && number.compareTo(new BigDecimal(min)) < 0) {
            fail(key, "min", "The %s field must be at least " + min + ".");
            return false;
        }
        if (max != null && number.compareTo(new BigDecimal(max)) > 0) {
            fail(key, "max", "The %s field must not be greater than " + max + ".");
            return false;
        }
        return true;
    }

    private void fail(String key, String rule, String template) {
        String wildcard = key.replaceAll("\\.\\d+(?=\\.|$)", ".*");
        String custom = messages.getOrDefault(key + "." + rule, messages.get(wildcard + "." + rule));

        addError(key, custom != null ? custom : template.formatted(label(key)));
    }

    private static BigDecimal toNumber(Object value) {
        if (value instanceof Boolean) {
            return null;
        }
        if (value instanceof Number n) {
            try {
                return new BigDecimal(n.toString());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        if (value instanceof String s && NUMERIC.matcher(s).matches()) {
            return new BigDecimal(s);
        }
        return null;
    }

    private static boolean isIntegral(Object value, BigDecimal number) {
        if (value instanceof String s) {
            return INTEGER.matcher(s).matches();
        }
        return number.stripTrailingZeros().scale() <= 0 && number.abs().compareTo(BigDecimal.valueOf(Integer.MAX_VALUE)) <= 0;
    }

    private static LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static LocalDate parseDateTime(String value) {
        LocalDate date = parseDate(value);

        if (date != null) {
            return date;
        }
        try {
            return OffsetDateTime.parse(value).toLocalDate();
        } catch (DateTimeParseException ignored) {
            // try without offset
        }
        try {
            return LocalDateTime.parse(value.replace(' ', 'T')).toLocalDate();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static Object normalize(String key, Object value) {
        if (value instanceof String s) {
            if (key != null && UNTRIMMED.contains(key)) {
                return s;
            }
            String trimmed = s.strip();
            return trimmed.isEmpty() ? null : trimmed;
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> copy = new LinkedHashMap<>();
            map.forEach((k, v) -> copy.put(String.valueOf(k), normalize(String.valueOf(k), v)));
            return copy;
        }
        if (value instanceof Collection<?> list) {
            List<Object> copy = new ArrayList<>();
            list.forEach(v -> copy.add(normalize(null, v)));
            return copy;
        }
        return value;
    }
}
