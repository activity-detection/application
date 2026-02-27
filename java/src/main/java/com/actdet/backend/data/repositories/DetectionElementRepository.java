package com.actdet.backend.data.repositories;

import com.actdet.backend.data.entities.DetectionElement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface DetectionElementRepository extends JpaRepository<DetectionElement, Integer> {
    List<DetectionElement> findByNameIn(Collection<String> names);
}
