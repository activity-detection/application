package com.actdet.backend.services.dtos;

import com.actdet.backend.data.entities.DetectionVector;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;

public class DetectionVectorDTO {
    public DetectionVectorDTO(String elementName, Short count){
        this.elementName = elementName;
        this.count = count;
    }

    public DetectionVectorDTO(String elementName, Short countFrom, Short countTo){
        this.elementName = elementName;
        this.countFrom = countFrom;
        this.countTo = countTo;
    }

    @JsonProperty(value = "element_name")
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


    public static DetectionVectorDTO from(DetectionVector detectionVector){
        return detectionVector.isRange() ?
                new DetectionVectorDTO(detectionVector.getElementName(), detectionVector.getCountFrom(), detectionVector.getCountTo()) :
                new DetectionVectorDTO((detectionVector.getElementName()), detectionVector.getCount());
    }


}
