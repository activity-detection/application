package com.actdet.backend.data.entities;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "videos")
public class Video {
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of("mp4", "mov");

    public static boolean hasSupportedExtension(Path path) {
        return hasSupportedExtension(path.getFileName().toString());
    }

    public static boolean hasSupportedExtension(String pathString) {
        int dotIndex = pathString.lastIndexOf('.');
        String extension = (dotIndex == -1) ? "" : pathString.substring(dotIndex + 1);
        return SUPPORTED_EXTENSIONS.contains(extension);
    }

    @Id
    @GeneratedValue
    @Column(name = "video_id", columnDefinition = "uuid")
    private UUID id;

    @Column(name = "video_name", length = 255, nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "upload_date", insertable = false, updatable = false)
    private LocalDateTime uploadDate;

    @Column(name = "video_path", length = 255, nullable = false, unique = true)
    private String pathToFile;

    @Column(name = "referenced_video_id", columnDefinition = "uuid", nullable = true, unique = true)
    private UUID referencedVideoId;

    @Column(name = "origin_id", insertable = true, updatable = true)
    private UUID originId;

    @OneToOne(
            mappedBy = "video",
            orphanRemoval = true,
            cascade = CascadeType.ALL
    )
    private VideoDetails videoDetails;


    @Builder
    public Video(String name, String description, String pathToFile, UUID referencedVideoId, VideoDetails details) {
        this.name = name;
        this.description = description;
        this.pathToFile = pathToFile;
        this.videoDetails = details;
        this.referencedVideoId = referencedVideoId;
    }
}
