package com.actdet.backend.data.repositories;

import com.actdet.backend.data.entities.DetectionElement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

public interface DetectionElementRepository extends JpaRepository<DetectionElement, Integer> {
    List<DetectionElement> findByNameIn(Collection<String> names);
    @Query(value = "SELECT d.name FROM DetectionElement d")
    Set<String> findAllNames();
}
