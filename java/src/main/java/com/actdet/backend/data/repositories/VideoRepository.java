package com.actdet.backend.data.repositories;

import com.actdet.backend.data.entities.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

@Repository
public interface VideoRepository extends JpaRepository<Video, UUID> {
    boolean existsVideoByPathToFile(String pathToFile);

    void deleteVideoByPathToFile(String pathToFile);

    @Query("SELECT v.pathToFile FROM Video v")
    Stream<String> streamAllVideoPaths();

    @Query("SELECT v.pathToFile FROM Video v WHERE v.id = :id")
    Optional<String> getPathById(UUID id);

    Video deleteVideoById(UUID id);
}
