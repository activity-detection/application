package com.actdet.backend.web.controllers.bodies;

import com.actdet.backend.services.dtos.DetectionVectorDTO;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class CreateDetectionTemplateRequest {
    @JsonProperty("name")
    @NotNull
    private String templateName;

    @JsonProperty("vectors")
    @NotEmpty
    List<DetectionVectorDTO> vectors;
}
