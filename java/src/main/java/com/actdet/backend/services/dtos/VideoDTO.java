package com.actdet.backend.services.dtos;

import com.actdet.backend.data.entities.Video;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class VideoDTO {
    private UUID id;
    private String name;
    private String description;
    @JsonProperty(value = "upload_date")
    private LocalDateTime uploadDate;

    public VideoDTO(Video video) {
        this.id = video.getId();
        this.name = video.getName();
        this.description = video.getDescription();
        this.uploadDate = video.getUploadDate();
    }
}
