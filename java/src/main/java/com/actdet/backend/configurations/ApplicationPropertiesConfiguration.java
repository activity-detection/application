package com.actdet.backend.configurations;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@Validated
@ConfigurationProperties(prefix = "activity-detector")
public class ApplicationPropertiesConfiguration {
    private final List<String> detectedElements;


    @Valid
    private final VideoProperties video;

    public ApplicationPropertiesConfiguration(VideoProperties video, List<String> detectedElements) {
        this.video = video;
        this.detectedElements = detectedElements;
    }


    static class VideoProperties {
        @NotEmpty
        @Pattern(
            regexp = "^(?!.*\\\\).*$",
            message = "folderPath cannot contain the backslash character (\\\\)! Use '/' characters instead."
        )
        private final String folderPath;
        @Min(value = 0, message = "Depth cannot be smaller than 0!")
        @Max(value = 4, message = "Depth cannot be bigger than 4 to reduce WatcherService workload!")
        private final Integer subfolderDepth;

        public VideoProperties(String folderPath, Integer subfolderDepth) {
            this.folderPath = folderPath;
            this.subfolderDepth = subfolderDepth;
            Path baseDir = Paths.get("").toAbsolutePath();
            Path dirPath = baseDir.resolve(folderPath);
            if(!Files.exists(dirPath)) throw new IllegalArgumentException("Specified video.folderPath ("+dirPath+") does not exist!");
            if (!Files.isDirectory(dirPath)) throw new IllegalArgumentException("Specified video.folderPath ("+dirPath+") is not a path to directory!");

        }
    }

    public List<String> getDetectedElementsNames(){
        return detectedElements;
    }
}
