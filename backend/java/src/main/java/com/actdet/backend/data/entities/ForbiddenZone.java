package com.actdet.backend.data.entities;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Type;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "forbidden_zones")
@Data
@NoArgsConstructor
public class ForbiddenZone {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 20)
    private String policy = "forbidden";

    // Polygon vertices as normalized [0..1] coordinates: each element is {x, y}.
    @Type(JsonType.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "points", columnDefinition = "jsonb", nullable = false)
    private List<double[]> points;

    @Column(name = "reference_video_id")
    private UUID referenceVideoId;

    @Column(name = "aspect_ratio")
    private Float aspectRatio;

    @Column(nullable = false)
    private boolean active = true;

    // Filled by the DB default (NOW()) and read back by Hibernate, matching the
    // is_range pattern in DetectionRule.
    @Generated
    @Column(name = "created_at", updatable = false, insertable = false)
    private LocalDateTime createdAt;
}
