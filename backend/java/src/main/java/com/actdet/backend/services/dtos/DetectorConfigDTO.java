package com.actdet.backend.services.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Everything the detector needs in a single poll: the active events-vectors
 * flattened into detector-friendly {@code action_classes} (element -> &gt;=
 * threshold), the active forbidden zones (normalized points), and optional crowd
 * config. {@code version} is a content hash used as the HTTP ETag so the detector
 * can short-circuit unchanged polls.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DetectorConfigDTO {
    private String version;

    @JsonProperty("action_classes")
    private List<ActionClass> actionClasses;

    private List<Zone> zones;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Crowd crowd;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActionClass {
        private String name;
        private String template;
        // element name -> minimum count (the detector treats these as ">=" thresholds)
        private Map<String, Integer> thresholds;
        private List<String> warnings;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Zone {
        private String name;
        private String policy;
        // polygon vertices as normalized [0..1] coordinates: each element is [x, y]
        private double[][] points;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Crowd {
        @JsonProperty("min_people")
        private int minPeople;
        @JsonProperty("radius_px")
        private double radiusPx;
    }
}
