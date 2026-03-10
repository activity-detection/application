package com.actdet.backend.web.controllers.advice;

import com.actdet.backend.services.exceptions.*;
import com.actdet.backend.web.controllers.MediaController;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice(assignableTypes = MediaController.class)
public class MediaControllerExceptionHandler {

    @Value("${activity-detector.controllers.show-error-details-in-response:false}")
    private boolean showErrorDetails;

    private String getBody(Exception ex){
        return showErrorDetails ? String.format("%s: %s", ex.getClass().getSimpleName(), ex.getMessage()) : null;
    }


    @ExceptionHandler({RequestException.class, RecordNotFoundException.class, RecordSavingException.class,
            VideoNotFoundException.class})
    public ResponseEntity<?> handleBadRequest(Exception ex){
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(getBody(ex));
    }

    @ExceptionHandler({FileSavingException.class})
    public ResponseEntity<?> handleIntervalServerError(Exception ex){
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(getBody(ex));
    }

}
