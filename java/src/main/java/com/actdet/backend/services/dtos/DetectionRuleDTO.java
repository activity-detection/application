package com.actdet.backend.services.dtos;

import com.actdet.backend.data.entities.DetectionTag;
import com.actdet.backend.data.entities.DetectionVector;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;

import java.util.List;

public class DetectionRuleDTO {
    private DetectionRuleDTO() {}
    @Getter
    private String name;
    @JsonProperty(value = "rules_count")
    @Getter
    private int rulesCount;
    @Getter
    private List<DetectionVectorDTO> rules;


    public static DetectionRuleDTO from(DetectionTag detectionTag){
        DetectionRuleDTO dto = new DetectionRuleDTO();
        dto.name = detectionTag.getName();
        dto.rulesCount = detectionTag.getDetectionVectors().size();
        dto.rules = detectionTag.getDetectionVectors().stream()
                .map(DetectionVectorDTO::from)
                .toList();
        return dto;
    }



}

