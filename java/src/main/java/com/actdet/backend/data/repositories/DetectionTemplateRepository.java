package com.actdet.backend.data.repositories;

import com.actdet.backend.data.entities.DetectionTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DetectionTemplateRepository extends JpaRepository<DetectionTemplate, Integer> {
    Optional<DetectionTemplate> findByName(String name);
}
