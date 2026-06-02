package com.actdet.backend.web.controllers.bodies;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ForbiddenZoneRequest {
    @NotBlank
    private String name;

    // Polygon vertices as normalized [0..1] coordinates: each element is [x, y].
    @NotNull
    private double[][] points;

    @JsonProperty("reference_video_id")
    private UUID referenceVideoId;

    @JsonProperty("aspect_ratio")
    private Float aspectRatio;
}
