package com.actdet.backend.data.repositories;

import com.actdet.backend.data.entities.DetectionTag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DetectionTagRepository extends JpaRepository<DetectionTag, Integer> {
    Optional<DetectionTag> findByName(String name);
}
