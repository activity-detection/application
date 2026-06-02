package com.actdet.backend.web.controllers;

import com.actdet.backend.services.ForbiddenZoneService;
import com.actdet.backend.services.dtos.ForbiddenZoneDTO;
import com.actdet.backend.web.controllers.bodies.ForbiddenZoneRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRUD for forbidden areas drawn in the frontend over a video frame. Kept in its
 * own controller (tag) so Orval generates a clean, typed client separate from the
 * detection-rules client.
 */
@RestController
@RequestMapping("/zones")
public class ForbiddenZonesController {

    private final ForbiddenZoneService forbiddenZoneService;

    @Autowired
    public ForbiddenZonesController(ForbiddenZoneService forbiddenZoneService) {
        this.forbiddenZoneService = forbiddenZoneService;
    }

    @GetMapping("")
    public ResponseEntity<List<ForbiddenZoneDTO>> getZones() {
        return ResponseEntity.ok(forbiddenZoneService.getAllZones());
    }

    @PostMapping("")
    public ResponseEntity<ForbiddenZoneDTO> createZone(@Valid @RequestBody ForbiddenZoneRequest request) {
        return ResponseEntity.ok(forbiddenZoneService.createZone(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ForbiddenZoneDTO> updateZone(@PathVariable Integer id, @Valid @RequestBody ForbiddenZoneRequest request) {
        return ResponseEntity.ok(forbiddenZoneService.updateZone(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteZone(@PathVariable Integer id) {
        forbiddenZoneService.deleteZone(id);
        return ResponseEntity.ok().build();
    }
}
