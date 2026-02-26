package com.actdet.backend.data.entities;

import com.actdet.backend.data.entities.ids.DetectionVectorId;
import jakarta.persistence.*;

@Entity
@Table(name = "detection_vectors")
public class DetectionVector {
    @EmbeddedId
    private DetectionVectorId id;

    @ManyToOne
    @MapsId("detectionTagId")
    @JoinColumn(name = "detection_tag_id")
    private DetectionTag tag;

    @ManyToOne
    @MapsId("detectionElementId")
    @JoinColumn(name= "detection_element_id")
    private DetectionElement element;

    private Short count;
    private Short countFrom;
    private Short countTo;
}
