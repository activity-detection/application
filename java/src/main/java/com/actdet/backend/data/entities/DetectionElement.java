package com.actdet.backend.data.entities;

import jakarta.persistence.*;

@Entity
@Table(name = "detection_elements")
public class DetectionElement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "element_name", length = 100, unique = true, nullable = false)
    private String name;

}
