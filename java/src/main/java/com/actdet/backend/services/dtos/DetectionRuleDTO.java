package com.actdet.backend.services.dtos;

import com.actdet.backend.data.entities.DetectionRule;
import com.actdet.backend.data.entities.DetectionVector;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@NoArgsConstructor
public class DetectionRuleDTO {
    public DetectionRuleDTO(String elementName, Short count){
        this.elementName = elementName;
        this.count = count;
    }

    public DetectionRuleDTO(String elementName, Short countFrom, Short countTo){
        this.elementName = elementName;
        this.countFrom = countFrom;
        this.countTo = countTo;
    }

    @JsonProperty(value = "element_name")
    @NotNull
    @Getter
    private String elementName;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @Getter
    private Short count;
    @JsonProperty(value = "count_from")
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @Getter
    private Short countFrom;
    @JsonProperty(value = "count_to")
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @Getter
    private Short countTo;

    public boolean isRange(){
        return count == null && (countFrom!=null || countTo!=null);
    }


    public static DetectionRuleDTO from(DetectionRule detectionRule){
        return detectionRule.isRange() ?
                new DetectionRuleDTO(detectionRule.getElementName(), detectionRule.getCountFrom(), detectionRule.getCountTo()) :
                new DetectionRuleDTO((detectionRule.getElementName()), detectionRule.getCount());
    }

    public static List<DetectionRuleDTO> from(List<DetectionRule> detectionRules){
        return detectionRules.stream().map(DetectionRuleDTO::from).toList();
    }
}
