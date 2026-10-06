package com.teguh.klinikamanah.klinikamanah_api.common;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Failed validation or broken business rule, rendered as 422 with the messages per field.
 */
public class ValidationException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public ValidationException(Map<String, List<String>> errors) {
        super(summary(errors));
        this.errors = errors;
    }

    /**
     * Business rule broken on a single field, e.g. {"details": ["Buka sesi kasir terlebih dahulu ..."]}.
     */
    public static ValidationException of(String field, String message) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        errors.put(field, List.of(message));
        return new ValidationException(errors);
    }

    public Map<String, List<String>> getErrors() {
        return errors;
    }

    /**
     * First message, followed by the count of the other ones, the way Laravel summarizes validation errors.
     */
    private static String summary(Map<String, List<String>> errors) {
        List<String> messages = errors.values().stream().flatMap(List::stream).toList();

        if (messages.isEmpty()) {
            return "The given data was invalid.";
        }

        int others = messages.size() - 1;

        return others == 0
                ? messages.getFirst()
                : messages.getFirst() + " (and " + others + " more error" + (others > 1 ? "s" : "") + ")";
    }
}
