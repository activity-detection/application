package com.actdet.backend.web.controllers;

import com.actdet.backend.data.entities.Video;
import com.actdet.backend.data.entities.VideoDetails;
import com.actdet.backend.data.repositories.VideoRepository;
import com.actdet.backend.services.VideoStorageService;
import com.actdet.backend.web.controllers.bodies.ResponseVideoBody;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Paths;
import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/videos")
public class MediaController {

    private final VideoStorageService videoStorageService;
    private final VideoRepository videoRepository;


    @Autowired
    public MediaController(VideoStorageService videoStorageService, VideoRepository videoRepository) {
        this.videoStorageService = videoStorageService;
        this.videoRepository = videoRepository;
    }

    @GetMapping("/{fileIdentifier}")
    public ResponseEntity<ResourceRegion> getVideoMedia(@RequestHeader HttpHeaders headers,
                                                        @PathVariable String fileIdentifier) throws IOException {
        ResourceRegion resource = videoStorageService.getVideoResourceRegion(fileIdentifier, headers);

        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .contentType(MediaTypeFactory.getMediaType(resource.getResource()).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .contentLength(resource.getResource().contentLength())
                .body(resource);
    }

    @GetMapping("/{fileIdentifier}/info")
    public ResponseEntity<?> getVideoInfo(@PathVariable("fileIdentifier") String fileIdentifier){
        return ResponseEntity.ok(videoStorageService.getVideoDetails(fileIdentifier));
    }


    //Tymczasowy endpoint do podgladu jakie pliki sie zapisaly
    @GetMapping("")
    public List<ResponseVideoBody> getAllVideos(){
        return videoRepository.findAll().stream().map(ResponseVideoBody::new).toList();
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadVideo(@RequestParam("file") MultipartFile file,
                                         @RequestParam("video-name") String videoName,
                                         @RequestParam(value = "description", required = false) String description,
                                         @RequestParam("relative-path") String pathToSaveIn,
                                         @RequestPart(value = "details") @Valid VideoDetails.Details detailsJson){
        if(!Video.hasSupportedExtension(Objects.requireNonNull(file.getOriginalFilename()))) return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();

        videoStorageService.store(file, videoName, description, Paths.get(pathToSaveIn), detailsJson);
        return ResponseEntity.ok().build();
    }

}
