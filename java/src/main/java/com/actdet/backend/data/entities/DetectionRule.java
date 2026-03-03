package com.actdet.backend.data.entities;

import com.actdet.backend.data.entities.ids.DetectionRuleId;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Generated;

import java.util.Objects;

@Entity
@Table(name = "detection_rule")
public class DetectionRule {
    @EmbeddedId
    private DetectionRuleId id;

    @ManyToOne
    @MapsId("detectionVectorId")
    @JoinColumn(name = "detection_vector_id")
    @Setter
    private DetectionVector vector;

    @ManyToOne
    @MapsId("detectionElementId")
    @JoinColumn(name= "detection_element_id")
    @Setter
    private DetectionElement element;

    @Column(name = "is_range", insertable = false, updatable = false)
    @Generated
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

    public DetectionRule() {
        this.id = new DetectionRuleId();
    }


    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        DetectionRule rule = (DetectionRule) o;
        return Objects.equals(vector, rule.vector) && Objects.equals(element, rule.element) && Objects.equals(count, rule.count) && Objects.equals(countFrom, rule.countFrom) && Objects.equals(countTo, rule.countTo);
    }

    @Override
    public int hashCode() {
        return Objects.hash(vector, element, count, countFrom, countTo);
    }
}
