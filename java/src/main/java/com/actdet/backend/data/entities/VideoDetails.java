package com.actdet.backend.data.entities;


import com.fasterxml.jackson.annotation.JsonProperty;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Type;
import org.hibernate.type.SqlTypes;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "video_details")
@Data
@NoArgsConstructor
public class VideoDetails {
    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @OneToOne
    @JoinColumn(name = "video_id")
    @MapsId
    private Video video;

    @Type(JsonType.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "details_json", columnDefinition = "jsonb")
    @Getter
    private Details details;


    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Details {
        @JsonProperty(value = "duration")
        Duration duration;

        @JsonProperty("events")
        @Valid
        List<EventDetection> eventDetections = new ArrayList<>();
        @JsonProperty("detections")
        @Valid
        List<ObjectDetections> detectedObjects = new ArrayList<>();

        @Data
        @NoArgsConstructor
        @AllArgsConstructor
        public static class EventDetection {
            @JsonProperty("label")
            @NotBlank
            String eventLabel;
            @JsonProperty("timestamp")
            @Valid
            DetectionTimestamp detectionTimestamp;
        }

        //Musze ustawic ograniczenie zeby nie dalo sie podac wartosci czasowej poza granicami trwania filmu (zeby timestamp nie mogl byc np. dluzszy niz sam film)
        @Data
        @NoArgsConstructor
        @AllArgsConstructor
        public static class ObjectDetections {
            @JsonProperty(value = "objects")
            @NotNull
            @Valid
            List<ObjectDetection> detectedObjects = new ArrayList<>();
            @JsonProperty(value = "timestamp")
            @Valid
            DetectionTimestamp detectionTimestamp;

            record ObjectDetection(@NotBlank String name, @Min(1) int count) {
            }
        }

        public record DetectionTimestamp(@NotNull Duration from, @NotNull Duration to) {
        }

    }

    public VideoDetails(Video video, Details details) {
        this.video = video;
        this.details = details;
    }

}
