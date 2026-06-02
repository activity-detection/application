package com.actdet.backend.web.controllers;

import com.actdet.backend.services.DetectorConfigService;
import com.actdet.backend.services.dtos.DetectorConfigDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Machine-facing endpoint the detector polls for its live configuration. Kept
 * separate from the rules/zones controllers so it gets its own OpenAPI tag and
 * the frontend client generator ignores it.
 */
@RestController
@RequestMapping("/detector")
public class DetectorConfigController {

    private final DetectorConfigService detectorConfigService;

    @Autowired
    public DetectorConfigController(DetectorConfigService detectorConfigService) {
        this.detectorConfigService = detectorConfigService;
    }

    @GetMapping("/config")
    public ResponseEntity<DetectorConfigDTO> getConfig(
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) {
        DetectorConfigDTO config = detectorConfigService.getDetectorConfig();
        String etag = "\"" + config.getVersion() + "\"";

        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
        }
        return ResponseEntity.ok().eTag(etag).body(config);
    }
}
