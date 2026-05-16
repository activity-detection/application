package com.actdet.backend.data.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Entity
@Table(name = "detection_vectors")
@NoArgsConstructor
public class DetectionVector {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Getter
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "detection_template_id")
    @Setter
    @Getter
    private DetectionTemplate template;

    @OneToMany(mappedBy = "vector", orphanRemoval = true, cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @Getter
    @Setter
    private List<DetectionRule> rules;



}
