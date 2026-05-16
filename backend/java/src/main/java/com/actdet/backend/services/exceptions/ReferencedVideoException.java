package com.actdet.backend.services.exceptions;

public class ReferencedVideoException extends RuntimeException {
    public ReferencedVideoException(String message) {
        super(message);
    }
}
