package com.actdet.backend.data.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Entity
@Table(name = "detection_tags")
@NoArgsConstructor
public class DetectionTag {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "detection_name", length = 100, unique = true, nullable = false)
    @Getter
    @Setter
    private String name;

    @OneToMany(fetch = FetchType.EAGER, mappedBy = "tag", cascade = CascadeType.ALL, orphanRemoval = true)
    @Getter
    @Setter
    private List<DetectionVector> detectionVectors;

    public DetectionTag(String name, List<DetectionVector> detectionVectors) {
        this.name = name;
        this.detectionVectors = detectionVectors;
    }
}
