package com.actdet.backend.services.dtos;

import com.actdet.backend.data.entities.ForbiddenZone;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;

import java.util.UUID;

public class ForbiddenZoneDTO {
    @Getter
    private Integer id;
    @Getter
    private String name;
    @Getter
    private String policy;
    // Polygon vertices as normalized [0..1] coordinates: each element is [x, y].
    @Getter
    private double[][] points;
    @JsonProperty("reference_video_id")
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @Getter
    private UUID referenceVideoId;
    @JsonProperty("aspect_ratio")
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @Getter
    private Float aspectRatio;
    @Getter
    private boolean active;

    public static ForbiddenZoneDTO from(ForbiddenZone zone) {
        ForbiddenZoneDTO dto = new ForbiddenZoneDTO();
        dto.id = zone.getId();
        dto.name = zone.getName();
        dto.policy = zone.getPolicy();
        dto.points = zone.getPoints() == null ? null : zone.getPoints().toArray(new double[0][]);
        dto.referenceVideoId = zone.getReferenceVideoId();
        dto.aspectRatio = zone.getAspectRatio();
        dto.active = zone.isActive();
        return dto;
    }
}
