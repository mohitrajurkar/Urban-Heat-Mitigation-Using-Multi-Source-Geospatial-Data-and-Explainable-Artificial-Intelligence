package com.urbanheat.exception;

import org.springframework.http.HttpStatus;

/** Raised when the Python AI service is unreachable or returns an error. */
public class AiServiceException extends ApiException {
    public AiServiceException(String message) {
        super(HttpStatus.BAD_GATEWAY, message);
    }

    public AiServiceException(HttpStatus status, String message) {
        super(status, message);
    }
}
