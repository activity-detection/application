package com.actdet.backend.web.controllers;

import com.actdet.backend.data.entities.Video;
import com.actdet.backend.services.VideoFileStorageService;
import com.actdet.backend.services.VideoService;
import com.actdet.backend.web.controllers.bodies.VideoDetailsRequestBody;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/videos")
public class MediaController {

    private final VideoFileStorageService videoFileStorageService;
    private final VideoService videoService;


    @Autowired
    public MediaController(VideoFileStorageService videoFileStorageService, VideoService videoService) {
        this.videoFileStorageService = videoFileStorageService;
        this.videoService = videoService;
    }

    @GetMapping("/{fileIdentifier}")
    public ResponseEntity<ResourceRegion> getVideoMedia(@RequestHeader HttpHeaders headers,
                                                        @PathVariable String fileIdentifier) throws IOException {
        ResourceRegion resource = videoFileStorageService.getVideoResourceRegion(fileIdentifier, headers);

        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .contentType(MediaTypeFactory.getMediaType(resource.getResource()).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .contentLength(resource.getResource().contentLength())
                .body(resource);
    }

    @GetMapping(value = "/{fileIdentifier}/manifest.mpd", produces = "application/dash+xml")
    public ResponseEntity<String> getVideoDashManifest(@PathVariable String fileIdentifier) {
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("application/dash+xml"))
                .body(videoService.getDashManifestForVideo(fileIdentifier));
    }

    @GetMapping(value = "/sequences/{originId}/manifest.mpd", produces = "application/dash+xml")
    public ResponseEntity<String> getSequenceManifest(@PathVariable String originId) {
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("application/dash+xml"))
                .body(videoService.getDashManifestForSequence(originId));
    }

    @GetMapping(value = "/{fileIdentifier}/dash/{assetPath:.+}")
    public ResponseEntity<?> getVideoDashAsset(@PathVariable String fileIdentifier,
                                               @PathVariable String assetPath) {
        var resource = videoService.getDashAssetForVideo(fileIdentifier, assetPath);
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(resource).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .body(resource);
    }

    @GetMapping(value = "/sequences/{originId}/dash/{videoId}/{assetPath:.+}")
    public ResponseEntity<?> getSequenceDashAsset(@PathVariable String originId,
                                                  @PathVariable String videoId,
                                                  @PathVariable String assetPath) {
        var resource = videoService.getDashAssetForSequence(originId, videoId, assetPath);
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(resource).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .body(resource);
    }

    @DeleteMapping("/{fileIdentifier}")
    public ResponseEntity<?> deleteVideo(@PathVariable String fileIdentifier) {
        videoService.deleteVideoByFileIdentifier(fileIdentifier);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{fileIdentifier}/info")
    public ResponseEntity<?> getVideoInfo(@PathVariable("fileIdentifier") String fileIdentifier) {
        return ResponseEntity.ok(videoService.getVideoDetails(fileIdentifier));
    }

    @GetMapping("")
    public ResponseEntity<?> getVideos(
            @PageableDefault(size = 10, sort = {"uploadDate", "name"}, direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(value = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(value = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to
    ) {
        LocalDateTime fromDate = Optional.ofNullable(from).orElse(LocalDateTime.of(2000, 1, 1, 0, 0));
        LocalDateTime toDate = Optional.ofNullable(to).orElse(LocalDateTime.of(2200, 1, 1, 0, 0));
        return ResponseEntity.ok(videoService.getVideos(pageable, fromDate, toDate));
    }

    @GetMapping("/sequences")
    public ResponseEntity<?> getVideoSequences(
            @PageableDefault(size = 10, sort = {"uploadDate", "name"}, direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(value = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(value = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to
    ) {
        LocalDateTime fromDate = Optional.ofNullable(from).orElse(LocalDateTime.of(2000, 1, 1, 0, 0));
        LocalDateTime toDate = Optional.ofNullable(to).orElse(LocalDateTime.of(2200, 1, 1, 0, 0));
        return ResponseEntity.ok(videoService.getVideoSequences(pageable, fromDate, toDate));
    }

    @GetMapping("/sequences/{originId}")
    public ResponseEntity<?> getVideoSequences(@PathVariable("originId") String originId) {
        return ResponseEntity.ok(videoService.getVideoSequence(originId));
    }

    @GetMapping("/sequences/{originId}/info")
    public ResponseEntity<?> getVideoSequenceInfo(@PathVariable("originId") String originId) {
        return ResponseEntity.ok(videoService.getVideoSequenceDetails(originId));
    }


    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/plain")
    public ResponseEntity<?> uploadVideo(@RequestParam("file") MultipartFile file,
                                         @RequestParam("video-name") String videoName,
                                         @RequestParam(value = "description", required = false) String description,
                                         @RequestParam("relative-path") String pathToSaveIn,
                                         @RequestParam(value = "continuation-of", required = false) String continuatedVideoIdString,
                                         @RequestPart(value = "details") @Valid VideoDetailsRequestBody detailsJson) {
        if (!Video.hasSupportedExtension(Objects.requireNonNull(file.getOriginalFilename())))
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        UUID savedVideoUUID = videoFileStorageService.store(
                file, videoName, description, Paths.get(pathToSaveIn), continuatedVideoIdString, detailsJson.toDetails());
        return ResponseEntity.ok(savedVideoUUID.toString());
    }

}
