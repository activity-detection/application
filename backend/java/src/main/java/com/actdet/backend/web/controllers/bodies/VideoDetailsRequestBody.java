package com.actdet.backend.web.controllers.bodies;

import com.actdet.backend.data.entities.VideoDetails;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class VideoDetailsRequestBody {
    @JsonProperty("events")
    @Valid
    List<VideoDetails.Details.EventDetection> eventDetections = new ArrayList<>();
    @JsonProperty("detections")
    @Valid
    List<VideoDetails.Details.ObjectDetections> detectedObjects = new ArrayList<>();


    public VideoDetails.Details toDetails(){
        return new VideoDetails.Details(null, eventDetections, detectedObjects);
    }
}
