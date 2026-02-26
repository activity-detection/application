package com.actdet.backend.data.entities.ids;

import jakarta.persistence.Embeddable;
import lombok.EqualsAndHashCode;

import java.io.Serializable;

@Embeddable
@EqualsAndHashCode
public class DetectionVectorId implements Serializable {
    private Integer detectionTagId;
    private Integer detectionElementId;
}
