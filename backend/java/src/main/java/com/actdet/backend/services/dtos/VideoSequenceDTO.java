package com.actdet.backend.services.dtos;

import com.actdet.backend.data.entities.Video;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Data
public class VideoSequenceDTO {
    @JsonProperty(value = "origin_id")
    private UUID originId;
    @JsonProperty(value = "sequence_upload_date")
    private LocalDateTime uploadDate;
    @JsonProperty(value = "parts")
    private List<VideoDTO> videos;

    public VideoSequenceDTO(List<Video> videoList) {
        this.originId = videoList.getFirst().getOriginId();
        this.uploadDate = videoList.getLast().getUploadDate();
        this.videos = sortLinkedVideos(videoList).stream().map(VideoDTO::new).toList();
    }

    private List<Video> sortLinkedVideos(List<Video> elements) {
        if (elements.isEmpty()) return elements;

        Map<UUID, Video> nextElementMap = elements.stream()
                .filter(v -> v.getReferencedVideoId() != null)
                .collect(Collectors.toMap(Video::getReferencedVideoId, v -> v));

        Video current = elements.stream()
                .filter(v -> v.getReferencedVideoId() == null)
                .findFirst()
                .orElse(elements.getFirst());

        List<Video> sorted = new ArrayList<>();
        while (current != null) {
            sorted.add(current);
            current = nextElementMap.get(current.getId());
        }
        return sorted;
    }
}
