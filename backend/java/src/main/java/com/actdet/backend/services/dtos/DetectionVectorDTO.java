package com.actdet.backend.services.dtos;

import com.actdet.backend.data.entities.DetectionVector;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@NoArgsConstructor
public class DetectionVectorDTO {
    @JsonProperty("vector_id")
    @Getter
    private Integer vectorId;

    @JsonProperty("rules")
    @Getter
    @NotEmpty
    private List<DetectionRuleDTO> rules;

    public static DetectionVectorDTO from(DetectionVector detectionVector){
        var dto = new DetectionVectorDTO();
        dto.vectorId = detectionVector.getId();
        dto.rules = DetectionRuleDTO.from(detectionVector.getRules());
        return dto;
    }

}
