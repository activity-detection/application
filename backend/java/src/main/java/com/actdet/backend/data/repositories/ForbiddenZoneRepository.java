package com.actdet.backend.data.repositories;

import com.actdet.backend.data.entities.ForbiddenZone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ForbiddenZoneRepository extends JpaRepository<ForbiddenZone, Integer> {
    List<ForbiddenZone> findByActiveTrue();
}
