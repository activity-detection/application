package com.actdet.backend.services;

import com.actdet.backend.data.entities.ForbiddenZone;
import com.actdet.backend.data.repositories.ForbiddenZoneRepository;
import com.actdet.backend.services.dtos.ForbiddenZoneDTO;
import com.actdet.backend.services.exceptions.RecordNotFoundException;
import com.actdet.backend.services.exceptions.RequestException;
import com.actdet.backend.web.controllers.bodies.ForbiddenZoneRequest;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
public class ForbiddenZoneService {

    private final ForbiddenZoneRepository forbiddenZoneRepository;

    @Autowired
    public ForbiddenZoneService(ForbiddenZoneRepository forbiddenZoneRepository) {
        this.forbiddenZoneRepository = forbiddenZoneRepository;
    }

    public List<ForbiddenZoneDTO> getAllZones() {
        return forbiddenZoneRepository.findAll().stream().map(ForbiddenZoneDTO::from).toList();
    }

    @Transactional
    public ForbiddenZoneDTO createZone(ForbiddenZoneRequest request) {
        validatePoints(request.getPoints());
        ForbiddenZone zone = new ForbiddenZone();
        applyRequest(zone, request);
        return ForbiddenZoneDTO.from(forbiddenZoneRepository.save(zone));
    }

    @Transactional
    public ForbiddenZoneDTO updateZone(Integer id, ForbiddenZoneRequest request) {
        validatePoints(request.getPoints());
        ForbiddenZone zone = forbiddenZoneRepository.findById(id)
                .orElseThrow(() -> new RecordNotFoundException("Forbidden zone " + id + " does not exist"));
        applyRequest(zone, request);
        return ForbiddenZoneDTO.from(forbiddenZoneRepository.save(zone));
    }

    @Transactional
    public void deleteZone(Integer id) {
        if (!forbiddenZoneRepository.existsById(id)) {
            throw new RecordNotFoundException("Forbidden zone " + id + " does not exist");
        }
        forbiddenZoneRepository.deleteById(id);
    }

    private void applyRequest(ForbiddenZone zone, ForbiddenZoneRequest request) {
        zone.setName(request.getName());
        zone.setPoints(Arrays.asList(request.getPoints()));
        zone.setReferenceVideoId(request.getReferenceVideoId());
        zone.setAspectRatio(request.getAspectRatio());
    }

    private void validatePoints(double[][] points) {
        if (points == null || points.length < 3) {
            throw new RequestException("A forbidden zone polygon must have at least 3 points");
        }
        for (double[] point : points) {
            if (point == null || point.length != 2) {
                throw new RequestException("Each polygon point must be a [x, y] pair");
            }
            for (double coord : point) {
                if (coord < 0.0 || coord > 1.0) {
                    throw new RequestException("Polygon point coordinates must be normalized to the [0, 1] range");
                }
            }
        }
    }
}
