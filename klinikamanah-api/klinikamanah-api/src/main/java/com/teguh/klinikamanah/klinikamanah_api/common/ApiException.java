package com.teguh.klinikamanah.klinikamanah_api.common;

import org.springframework.http.HttpStatus;

/**
 * Error with an HTTP status and a message, rendered as {"message": "..."}.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public static ApiException unauthenticated() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "Unauthenticated.");
    }

    public static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "This action is unauthorized.");
    }

    public static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Not Found");
    }

    /**
     * Abort with 403 unless the user is allowed to take the action.
     */
    public static void authorize(boolean allowed) {
        if (!allowed) {
            throw forbidden();
        }
    }

    public HttpStatus getStatus() {
        return status;
    }
}
