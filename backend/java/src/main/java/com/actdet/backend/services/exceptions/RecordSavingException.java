package com.actdet.backend.services.exceptions;

public class RecordSavingException extends RuntimeException {
    public RecordSavingException(String message) {
        super(message);
    }
}
