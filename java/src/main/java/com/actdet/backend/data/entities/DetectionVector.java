package com.actdet.backend.data.entities;

import com.actdet.backend.data.entities.ids.DetectionVectorId;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Objects;

@Entity
@Table(name = "detection_vectors")
@NoArgsConstructor
public class DetectionVector {
    @EmbeddedId
    private DetectionVectorId id;

    @ManyToOne
    @MapsId("detectionTagId")
    @JoinColumn(name = "detection_tag_id")
    @Setter
    private DetectionTag tag;

    @ManyToOne
    @MapsId("detectionElementId")
    @JoinColumn(name= "detection_element_id")
    @Setter
    private DetectionElement element;

    @Column(name = "is_range", updatable = false)
    private Boolean isRange;

    @Column(name = "count")
    @Getter
    @Setter
    private Short count;
    @Column(name = "count_from")
    @Getter
    @Setter
    private Short countFrom;
    @Column(name = "count_to")
    @Getter
    @Setter
    private Short countTo;

    public boolean isRange() {
        return isRange;
    }

    public String getElementName(){
        return this.element.getName();
    }


    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        DetectionVector vector = (DetectionVector) o;
        return Objects.equals(tag, vector.tag) && Objects.equals(element, vector.element) && Objects.equals(count, vector.count) && Objects.equals(countFrom, vector.countFrom) && Objects.equals(countTo, vector.countTo);
    }

    @Override
    public int hashCode() {
        return Objects.hash(tag, element, count, countFrom, countTo);
    }
}
