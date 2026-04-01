package com.actdet.backend.services;

import com.actdet.backend.data.entities.Video;
import com.actdet.backend.data.entities.VideoDetails;
import com.actdet.backend.data.repositories.VideoDetailsRepository;
import com.actdet.backend.data.repositories.VideoRepository;
import com.actdet.backend.services.dtos.VideoDTO;
import com.actdet.backend.services.exceptions.RecordNotFoundException;
import com.actdet.backend.services.exceptions.RecordSavingException;
import com.actdet.backend.services.exceptions.VideoNotFoundException;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Stream;

@Service
public class VideoService {
    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    private final Path videoFolderPath;
    private final int maxDepth;
    private final VideoRepository videoRepository;
    private final VideoDetailsRepository videoDetailsRepository;

    @Autowired
    public VideoService(@Value("${activity-detector.video.folderPath}") String relativeFolderPath,
                        @Value("${activity-detector.video.subfolderDepth}") int subfolderDepth,
                        VideoRepository videoRepository,
                        VideoDetailsRepository videoDetailsRepository) {
        this.maxDepth = subfolderDepth;
        this.videoRepository = videoRepository;
        this.videoDetailsRepository = videoDetailsRepository;
        //Aktualnie sciezka do katalogu jest wzgledem katalogu w ktorym uruchamiamy projekt
        Path baseDir = Paths.get("").toAbsolutePath();

        this.videoFolderPath =  baseDir.resolve(relativeFolderPath);
        logger.info("IdentifierToVideoMapperService has been initialized. Video files will be read from: {}", this.videoFolderPath);
    }

    public boolean exists(UUID videoIdentifier){
        return videoRepository.existsById(videoIdentifier);
    }

    public Path getVideoPathForIdentifier(String videoIdentifier){
        String fileName = getFilePathForId(videoIdentifier);
        return videoFolderPath.resolve(fileName);
    }

    private String getFilePathForId(String id){
        try{
            return videoRepository.getPathById(UUID.fromString(id))
                    .orElseThrow(() -> new RecordNotFoundException("Plik z podanym id ("+id+") nie istnieje!"));
        } catch(IllegalArgumentException e){
            throw new IllegalArgumentException("Invalid video UUID");
        }

    }
    @Transactional
    public UUID saveVideoDatabaseRecord(String videoName, Path videoPath){
        return saveVideoDatabaseRecord(videoName, null, videoPath);
    }
    @Transactional
    public UUID saveVideoDatabaseRecord(String videoName, Path videoPath, VideoDetails.Details detailsJson){
        return saveVideoDatabaseRecord(videoName, null, videoPath, null, detailsJson);
    }
    @Transactional
    public UUID saveVideoDatabaseRecord(String videoName, String description, Path videoPath){
        return saveVideoDatabaseRecord(videoName, description, videoPath, null, null);
    }

    @Transactional
    public UUID saveVideoDatabaseRecord(String videoName, String description, Path videoPath, UUID referencedVideoId){
        return saveVideoDatabaseRecord(videoName, description, videoPath, referencedVideoId, null);
    }

    @Transactional
    public UUID saveVideoDatabaseRecord(String videoName, String description, Path videoPath, UUID referencedVideoId, VideoDetails.Details details){
        String videoPathString = videoPath.toString();
        Video video = Video.builder().name(videoName).description(description).pathToFile(videoPathString).referencedVideoId(referencedVideoId).build();
        if(videoRepository.existsVideoByPathToFile(videoPathString)){
            throw new RecordSavingException("Cannot save file under already existing path");
        }
        if(referencedVideoId!=null && !videoRepository.existsById(referencedVideoId)){
            throw new RecordSavingException("Specified referenced video does not exist");
        }
        video = videoRepository.save(video);
        if(details!=null){
            VideoDetails vd = new VideoDetails(video, details);
            videoDetailsRepository.save(vd);
        }

        logger.debug("Record saved to database: {}", video);
        return video.getId();
    }

    @Transactional
    public void deleteVideoDatabaseRecord(String videoPath){
        videoRepository.deleteVideoByPathToFile(videoPath);
    }

    @Transactional
    public void deleteVideoByFileIdentifier(String fileIdentifier) {
        Video deletedVideo = videoRepository.findById(UUID.fromString(fileIdentifier))
                .orElseThrow(() -> new RecordNotFoundException("Specified record does not exist"));
        Path deletedVideoPath = videoFolderPath.resolve(Paths.get(deletedVideo.getPathToFile()));
        try{
            Files.delete(deletedVideoPath);
        }catch(IOException e){
            throw new VideoNotFoundException("Specified video does not exist");
        }
    }

    public boolean isVideoRecordRegistered(String videoPath){
        return videoRepository.existsVideoByPathToFile(videoPath);
    }


    @Transactional
    public long deleteNonExistentVideoRecords(){
        AtomicLong deletedRecordsCount = new AtomicLong();
        try(Stream<String> stream = videoRepository.streamAllVideoPaths()){
            stream.forEach(path -> {
                if(!Files.isRegularFile(this.videoFolderPath.resolve(path))){
                    videoRepository.deleteVideoByPathToFile(path);
                    deletedRecordsCount.getAndIncrement();
                }
            });
        }
        return deletedRecordsCount.get();
    }

    public Page<VideoDTO> getVideos(final Pageable pageable){
        final Page<Video> page = videoRepository.findAll(pageable);
        return new PageImpl<>(page.get().map(VideoDTO::new).toList(), pageable, page.getTotalElements());
    }

    public Page<VideoDTO> getVideos(final Pageable pageable, LocalDateTime from, LocalDateTime to){
        final Page<Video> page = videoRepository.findAllByUploadDateGreaterThanEqualAndUploadDateLessThanEqual(pageable, from, to);
        return new PageImpl<>(page.get().map(VideoDTO::new).toList(), pageable, page.getTotalElements());
    }

    public Optional<UUID> getVideoIdByRelativePathToFile(Path pathToFile){
        if(pathToFile==null){
            return Optional.empty();
        }
        return this.videoRepository.findByPathToFile(pathToFile.toString());
    }


    public Path getVideoFolderPath(){return this.videoFolderPath;}
    public int getMaxDepth(){return this.maxDepth;}

    public VideoDetails.Details getVideoDetails(String videoId){
        VideoDetails details = videoDetailsRepository.findById(UUID.fromString(videoId)).orElseThrow(() -> new RecordNotFoundException("Specified video does not exist"));
        return details.getDetails();
    }

}
