package com.actdet.backend.data.entities;

import jakarta.persistence.*;

import java.util.List;

@Entity
@Table(name = "detection_tags")
public class DetectionTag {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "detection_name", length = 100, unique = true, nullable = false)
    private String name;

    @OneToMany(fetch = FetchType.EAGER, mappedBy = "tag", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DetectionVector> detectionVectors;
}
