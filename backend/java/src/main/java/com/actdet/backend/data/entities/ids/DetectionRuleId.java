package com.actdet.backend.data.entities.ids;

import jakarta.persistence.Embeddable;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.Setter;

import java.io.Serializable;

@Embeddable
@EqualsAndHashCode
@Data
public class DetectionRuleId implements Serializable {
    private Integer detectionVectorId;
    private Integer detectionElementId;
}
