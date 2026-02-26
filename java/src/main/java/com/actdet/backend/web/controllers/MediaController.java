package com.actdet.backend.web.controllers;

import com.actdet.backend.data.entities.Video;
import com.actdet.backend.data.entities.VideoDetails;
import com.actdet.backend.services.VideoService;
import com.actdet.backend.services.VideoFileStorageService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;


import java.io.IOException;
import java.nio.file.Paths;
import java.util.Objects;

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

    @GetMapping("/{fileIdentifier}/info")
    public ResponseEntity<?> getVideoInfo(@PathVariable("fileIdentifier") String fileIdentifier){
        return ResponseEntity.ok(videoService.getVideoDetails(fileIdentifier));
    }

    @GetMapping("")
    public ResponseEntity<?> getVideos(
            @PageableDefault(size = 10, sort = {"uploadDate", "name"}, direction = Sort.Direction.DESC) Pageable pageable
    ){
        return ResponseEntity.ok(videoService.getVideos(pageable));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadVideo(@RequestParam("file") MultipartFile file,
                                         @RequestParam("video-name") String videoName,
                                         @RequestParam(value = "description", required = false) String description,
                                         @RequestParam("relative-path") String pathToSaveIn,
                                         @RequestPart(value = "details") @Valid VideoDetails.Details detailsJson){
        if(!Video.hasSupportedExtension(Objects.requireNonNull(file.getOriginalFilename()))) return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();

        videoFileStorageService.store(file, videoName, description, Paths.get(pathToSaveIn), detailsJson);
        return ResponseEntity.ok().build();
    }

}
