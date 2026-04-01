package com.actdet.backend.data.repositories;

import com.actdet.backend.data.entities.Video;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
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

    Page<Video> findAllByUploadDateGreaterThanEqualAndUploadDateLessThanEqual(Pageable pageable, LocalDateTime uploadDateIsGreaterThan, LocalDateTime uploadDateIsLessThan);

    Optional<UUID> findByPathToFile(String pathToFile);
}
