package com.actdet.backend.services.dtos;

import com.actdet.backend.data.entities.DetectionElement;
import lombok.Data;

@Data
public class DetectionElementDTO {
    private Integer id;
    private String name;

    public DetectionElementDTO(DetectionElement detectionElement) {
        this.id = detectionElement.getId();
        this.name = detectionElement.getName();
    }
}
