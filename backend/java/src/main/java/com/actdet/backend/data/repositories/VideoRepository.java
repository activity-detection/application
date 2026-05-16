package com.actdet.backend.data.repositories;

import com.actdet.backend.data.entities.Video;
import org.springframework.cglib.core.Local;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
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

    @Query("SELECT v.id FROM Video v WHERE v.referencedVideoId IS NULL " +
            "AND v.uploadDate >= :dateFrom AND v.uploadDate <= :dateTo")
    Page<UUID> findVideoSequencesOriginIds(Pageable pageable, @Param("dateFrom") LocalDateTime uploadDateIsGreaterThan, @Param("dateTo") LocalDateTime uploadDateIsLessThan);


    @Query("SELECT v FROM Video v WHERE v.originId IN :originIds")
    List<Video> findAllVideoSequencesByOriginIds(@Param("originIds") List<UUID> originIds, Sort sort);

    @Query("SELECT v FROM Video v WHERE v.originId = :originId")
    List<Video> findVideoSequenceByOriginId(@Param("originId") UUID originId);
}
