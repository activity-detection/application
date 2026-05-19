package com.actdet.backend.web.controllers.advice;

import com.actdet.backend.services.exceptions.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.io.IOException;

@ControllerAdvice
public class GlobalControllerExceptionHandler {
    @Value("${activity-detector.controllers.show-error-details-in-response:false}")
    private boolean showErrorDetails;

    private String getBody(Exception ex) {
        if (!showErrorDetails) {
            return null;
        }

        StringBuilder body = new StringBuilder(ex.getClass().getSimpleName());
        if (ex.getMessage() != null && !ex.getMessage().isBlank()) {
            body.append(": ").append(ex.getMessage());
        }

        Throwable cause = ex.getCause();
        if (cause != null && cause.getMessage() != null && !cause.getMessage().isBlank()) {
            body.append("; cause=").append(cause.getClass().getSimpleName()).append(": ").append(cause.getMessage());
        }
        return body.toString();
    }


    @ExceptionHandler({RequestException.class, RecordNotFoundException.class, RecordSavingException.class,
            VideoNotFoundException.class})
    public ResponseEntity<?> handleBadRequest(Exception ex){
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(getBody(ex));
    }

    @ExceptionHandler({IOException.class, FileSavingException.class, IllegalStateException.class})
    public ResponseEntity<?> handleIntervalServerError(Exception ex){
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(getBody(ex));
    }

}
