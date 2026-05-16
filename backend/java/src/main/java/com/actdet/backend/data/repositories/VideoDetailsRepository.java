package com.actdet.backend.data.repositories;

import com.actdet.backend.data.entities.VideoDetails;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface VideoDetailsRepository extends JpaRepository<VideoDetails, UUID> {
}
