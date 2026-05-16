package com.actdet.backend.services.dtos;

import com.actdet.backend.data.entities.DetectionTemplate;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;

import java.util.List;

public class DetectionTemplateDTO {
    public DetectionTemplateDTO() {}
    @JsonProperty("name")
    @Getter
    private String name;
    @JsonProperty("vector_count")
    @Getter
    private int vectorCount;
    @JsonProperty("vectors")
    @Getter
    private List<DetectionVectorDTO> vectors;

    public static DetectionTemplateDTO from(DetectionTemplate detectionTemplate){
        DetectionTemplateDTO dto = new DetectionTemplateDTO();
        dto.name = detectionTemplate.getName();
        dto.vectorCount = detectionTemplate.getDetectionVectors().size();
        dto.vectors = detectionTemplate.getDetectionVectors().stream()
                .map(DetectionVectorDTO::from)
                .toList();
        return dto;
    }

}

