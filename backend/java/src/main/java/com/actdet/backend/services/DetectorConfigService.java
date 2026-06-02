package com.actdet.backend.services;

import com.actdet.backend.data.entities.DetectionRule;
import com.actdet.backend.data.entities.DetectionTemplate;
import com.actdet.backend.data.entities.DetectionVector;
import com.actdet.backend.data.entities.ForbiddenZone;
import com.actdet.backend.data.repositories.DetectionTemplateRepository;
import com.actdet.backend.data.repositories.ForbiddenZoneRepository;
import com.actdet.backend.services.dtos.DetectorConfigDTO;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds the consolidated detector config (see {@link DetectorConfigDTO}). The
 * detector polls this and live-reloads without restart, so the payload is shaped
 * for the detector (flat action classes with ">=" thresholds) rather than for
 * the paginated, UI-oriented {@code /rules} endpoint.
 */
@Service
public class DetectorConfigService {

    private final DetectionTemplateRepository detectionTemplateRepository;
    private final ForbiddenZoneRepository forbiddenZoneRepository;
    private final ObjectMapper objectMapper;

    @Autowired
    public DetectorConfigService(DetectionTemplateRepository detectionTemplateRepository,
                                 ForbiddenZoneRepository forbiddenZoneRepository,
                                 ObjectMapper objectMapper) {
        this.detectionTemplateRepository = detectionTemplateRepository;
        this.forbiddenZoneRepository = forbiddenZoneRepository;
        this.objectMapper = objectMapper;
    }

    public DetectorConfigDTO getDetectorConfig() {
        DetectorConfigDTO config = new DetectorConfigDTO();
        config.setActionClasses(buildActionClasses());
        config.setZones(buildZones());
        config.setCrowd(null); // crowd config is not persisted yet
        config.setVersion(hash(config));
        return config;
    }

    private List<DetectorConfigDTO.ActionClass> buildActionClasses() {
        List<DetectorConfigDTO.ActionClass> result = new ArrayList<>();

        List<DetectionTemplate> templates = detectionTemplateRepository.findAll().stream()
                .sorted(Comparator.comparing(DetectionTemplate::getName))
                .toList();

        for (DetectionTemplate template : templates) {
            List<DetectionVector> vectors = template.getDetectionVectors().stream()
                    .sorted(Comparator.comparing(DetectionVector::getId))
                    .toList();
            boolean multiVector = vectors.size() > 1;
            int index = 0;
            for (DetectionVector vector : vectors) {
                index++;
                String name = multiVector ? template.getName() + " #" + index : template.getName();
                result.add(buildActionClass(name, template.getName(), vector));
            }
        }
        return result;
    }

    private DetectorConfigDTO.ActionClass buildActionClass(String name, String templateName, DetectionVector vector) {
        Map<String, Integer> thresholds = new LinkedHashMap<>();
        List<String> warnings = new ArrayList<>();

        List<DetectionRule> rules = vector.getRules().stream()
                .sorted(Comparator.comparing(DetectionRule::getElementName))
                .toList();

        for (DetectionRule rule : rules) {
            String element = rule.getElementName();
            if (!rule.isRange()) {
                thresholds.put(element, (int) rule.getCount());
            } else if (rule.getCountFrom() != null) {
                // detector comparison is ">=" only: honor the lower bound, drop the upper.
                thresholds.put(element, (int) rule.getCountFrom());
                if (rule.getCountTo() != null) {
                    warnings.add("range upper bound on '" + element + "' dropped (detector uses >= thresholds)");
                }
            } else {
                // count_to-only would match everything as a ">=" threshold — skip it.
                warnings.add("count_to-only rule on '" + element + "' skipped (cannot map to a >= threshold)");
            }
        }
        return new DetectorConfigDTO.ActionClass(name, templateName, thresholds, warnings);
    }

    private List<DetectorConfigDTO.Zone> buildZones() {
        return forbiddenZoneRepository.findByActiveTrue().stream()
                .sorted(Comparator.comparing(ForbiddenZone::getId))
                .map(z -> new DetectorConfigDTO.Zone(
                        z.getName(),
                        z.getPolicy(),
                        z.getPoints() == null ? new double[0][] : z.getPoints().toArray(new double[0][])))
                .toList();
    }

    private String hash(DetectorConfigDTO config) {
        try {
            byte[] payload = objectMapper.writeValueAsBytes(
                    Map.of("a", config.getActionClasses(), "z", config.getZones(), "c", config.getCrowd() == null ? "" : config.getCrowd()));
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(payload));
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            throw new IllegalStateException("Failed to hash detector config", e);
        }
    }
}
