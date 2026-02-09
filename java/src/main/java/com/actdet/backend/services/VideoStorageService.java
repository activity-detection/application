package com.actdet.backend.services;

import com.actdet.backend.data.entities.Video;
import com.actdet.backend.data.entities.VideoDetails;
import com.actdet.backend.services.exceptions.FileSavingException;
import com.actdet.backend.services.exceptions.RecordSavingException;
import com.actdet.backend.services.exceptions.RequestException;
import com.actdet.backend.services.utils.VideoUtils;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class VideoStorageService {
    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    private final VideoService videoService;

    public VideoStorageService(VideoService videoService) {
        this.videoService = videoService;
    }

    public ResourceRegion getVideoResourceRegion(String fileIdentifier, HttpHeaders headers) {
        Resource videoMedia = new FileSystemResource(videoService.getVideoPathForIdentifier(fileIdentifier));
        return getVideoResourceRegion(videoMedia, headers);
    }

    private ResourceRegion getVideoResourceRegion(Resource media, HttpHeaders headers){
        List<HttpRange> rangeList = headers.getRange();
        HttpRange range;
        if(rangeList.isEmpty()){
            logger.error("Missing range header! Result not returned.");
            throw new RequestException("Missing range header! Result not returned.");
        } else if (rangeList.size()>1) logger.warn("Header has more than one range. Check if this is an appropriate behaviour.");
        range = rangeList.getFirst();
        return range.toResourceRegion(media);
    }

    @Transactional
    public void store(MultipartFile file, String videoName, String description, Path filePathToSaveIn, VideoDetails.Details details){
        if(file.isEmpty()){
            throw new FileSavingException("Cannot save empty file");
        }
        if(VideoUtils.getFileDepth(filePathToSaveIn)>videoService.getMaxDepth()){
            throw new FileSavingException("Specified store path is deeper than allowed in config file.");
        }
        if(!Video.hasSupportedExtension(filePathToSaveIn)){
            throw new FileSavingException("File extension is not supported.");
        }

        String filePathString = filePathToSaveIn.getFileName().toString();

        int extensionStartIndex = filePathString.lastIndexOf('.');

        String savedFileName = filePathString.substring(0, extensionStartIndex)+"-"+
                LocalTime.now().format(DateTimeFormatter.ofPattern("HHmmssSSS"))
                +filePathString.substring(extensionStartIndex);
        String timestampString = LocalDate.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));
        Path timestampedDirPath = this.videoService.getVideoFolderPath().resolve(Paths.get(timestampString));
        Path storePath = timestampedDirPath.resolve(savedFileName);

        boolean fileCreated = false;
        try(InputStream inputStream = file.getInputStream()){
            if(Files.exists(storePath)){
                logger.error("File {} already exists!", storePath);
                throw new IOException();
            }else{
                Files.createDirectories(timestampedDirPath);
                Files.copy(inputStream, storePath);
            }
            fileCreated = true;

            this.videoService.saveVideoDatabaseRecord(videoName, description, Paths.get(timestampString).resolve(savedFileName), details);
        } catch (IOException e) {
            throw new FileSavingException("Failed to store video file on local.");
        } catch (RuntimeException e){
           if(fileCreated){
               try{
                   Files.deleteIfExists(storePath);
               } catch (IOException ex) {
                   logger.error("Failed to delete file after record saving error.");
               }
           }
            throw new RecordSavingException("Failed to save video record in database.");
        }

        logger.debug("Video file has been stored: {}", storePath);

    }


}
