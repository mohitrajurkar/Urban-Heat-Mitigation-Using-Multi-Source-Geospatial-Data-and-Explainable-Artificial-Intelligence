package com.mohit.urbanheatai.dto;

import java.util.Map;

public class ErrorResponse {

    private String error;
    private String message;
    private Map<String, String> errors;


    public ErrorResponse(String error, String message, Map<String, String> errors) {
        this.error = error;
        this.message = message;
        this.errors = errors;
    }

    public ErrorResponse(String error, String message) {
        this.error = error;
        this.message = message;
    }

    public Map<String, String> getErrors() {
        return errors;
    }

    public String getError() {
        return error;
    }

    public String getMessage() {
        return message;
    }
}