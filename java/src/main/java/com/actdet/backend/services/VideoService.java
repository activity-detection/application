package com.actdet.backend.services;

import com.actdet.backend.data.entities.Video;
import com.actdet.backend.data.entities.VideoDetails;
import com.actdet.backend.data.repositories.VideoDetailsRepository;
import com.actdet.backend.data.repositories.VideoRepository;
import com.actdet.backend.services.exceptions.RecordNotFoundException;
import com.actdet.backend.services.exceptions.RecordSavingException;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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

    public Path getVideoPathForIdentifier(String videoIdentifier){
        String fileName = getFilePathForId(videoIdentifier);
        return videoFolderPath.resolve(fileName);
    }

    private String getFilePathForId(String id){
        return videoRepository.getPathById(UUID.fromString(id))
                .orElseThrow(() -> new RecordNotFoundException("Plik z podanym id ("+id+") nie istnieje!"));
    }

    public void saveVideoDatabaseRecord(String videoName, Path videoPath){
        saveVideoDatabaseRecord(videoName, null, videoPath);
    }

    public void saveVideoDatabaseRecord(String videoName, Path videoPath, VideoDetails.Details detailsJson){
        saveVideoDatabaseRecord(videoName, null, videoPath, detailsJson);
    }

    public void saveVideoDatabaseRecord(String videoName, String description, Path videoPath){
        saveVideoDatabaseRecord(videoName, description, videoPath, null);
    }

    public void saveVideoDatabaseRecord(String videoName, String description, Path videoPath, VideoDetails.Details details){
        String videoPathString = videoPath.toString();
        Video video = Video.builder().name(videoName).description(description).pathToFile(videoPathString).build();
        if(videoRepository.existsVideoByPathToFile(videoPathString)){
            throw new RecordSavingException("Cannot save file under already existing path");
        }
        video = videoRepository.save(video);
        if(details!=null){
            VideoDetails vd = new VideoDetails(video, details);
            videoDetailsRepository.save(vd);
        }

        logger.debug("Record saved to database: {}", video);
    }

    @Transactional
    public void deleteVideoDatabaseRecord(String videoPath){
        videoRepository.deleteVideoByPathToFile(videoPath);
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

    public Path getVideoFolderPath(){return this.videoFolderPath;}
    public int getMaxDepth(){return this.maxDepth;}

    public VideoDetails.Details getVideoDetails(String videoId){
        VideoDetails details = videoDetailsRepository.findById(UUID.fromString(videoId)).orElseThrow(() -> new RecordNotFoundException("Specified video does not exist"));
        return details.getDetails();
    }

}
