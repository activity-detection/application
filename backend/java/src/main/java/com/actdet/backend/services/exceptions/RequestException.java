package com.actdet.backend.services.exceptions;

public class RequestException extends RuntimeException {
    public RequestException(String message) {
        super(message);
    }
}
