package com.actdet.backend.services;

import com.actdet.backend.data.entities.Video;
import com.actdet.backend.data.entities.VideoDetails;
import com.actdet.backend.data.repositories.VideoDetailsRepository;
import com.actdet.backend.data.repositories.VideoRepository;
import com.actdet.backend.services.exceptions.RecordNotFoundException;
import com.actdet.backend.services.exceptions.RecordSavingException;
import com.actdet.backend.services.exceptions.VideoNotFoundException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VideoServiceTest {

    @Mock
    VideoRepository videoRepository;
    @Mock
    VideoDetailsRepository videoDetailsRepository;

    @TempDir
    Path tempDir;


    VideoService videoService;

    @BeforeEach
    void setUp() {
        this.videoService = new VideoService(tempDir.toString(), 1, videoRepository, videoDetailsRepository);
    }

    @Nested
    class GetVideoPathForIdentifierTest {
        @Test
        void shouldReturnFilePath_IfRecordForIdExists() {
            // given
            UUID uuid = UUID.randomUUID();
            String path = "/path/to/file";
            Path baseDir = Paths.get("").toAbsolutePath();

            when(videoRepository.getPathById(uuid)).thenReturn(Optional.of(path));
            // when
            Path result = videoService.getVideoPathForIdentifier(uuid.toString());

            // then
            assertEquals(baseDir.resolve(Paths.get(path)), result);
        }

        @Test
        void shouldThrowDeticatedException_WhenRecordDoesNotExist() {
            // given
            UUID wrongUUID = UUID.randomUUID();
            // when+then
            assertThrows(RecordNotFoundException.class, () -> videoService.getVideoPathForIdentifier(wrongUUID.toString()));
        }

        @Test
        void shouldThrowIllegalArgumentExceptionWithSpecialMessage_WhenInvalidUUIDStringPassed() {
            // given
            String invalidUUIDString = "invalid";
            // when+then
            Exception exception = assertThrows(IllegalArgumentException.class, () -> videoService.getVideoPathForIdentifier(invalidUUIDString));
            assertTrue(exception.getMessage().contains("UUID"));
        }
    }

    @Nested
    class SaveVideoDatabaseRecord {
        @Test
        void shouldSaveVideoRecord_IfEverythingIsCorrect() {
            // given
            String videoName = "nazwa";
            String description = "opis";
            Path path = Path.of("path", "to", "video");
            String detailsJson = """
                    {
                    "events": [
                        {
                        "label": "DETECTION_LABEL",
                        "timestamp": {
                            "from": "PT0S",
                            "to": "PT1S"
                            }
                        }
                    ],
                    "detections": [
                        {
                        "objects": [
                            {
                            "name": "human",
                            "count": 1
                            }
                        ],
                        "timestamp": {
                            "from": "PT0S",
                            "to": "PT1S"
                            }
                        }
                    ]
                    }
                    """;

            ObjectMapper objectMapper = Jackson2ObjectMapperBuilder.json().build();
            VideoDetails.Details details = null;
            try {
                details = objectMapper.readValue(detailsJson, VideoDetails.Details.class);
            } catch (JsonProcessingException e) {
                fail("ObjectMapper fail at mapping json to object. Chceck if detailsJson is correct.");
            }

            when(videoRepository.existsVideoByPathToFile(any())).thenReturn(false);
            when(videoRepository.save(any())).thenReturn(new Video());
            when(videoDetailsRepository.save(any())).thenReturn(new VideoDetails());
            // when
            videoService.saveVideoDatabaseRecord(videoName, description, path, null, details);
            // then
            verify(videoRepository, times(1)).save(any());
            verify(videoDetailsRepository, times(1)).save(any());

        }

        @Test
        void shouldNotAllowSavingUnderExistingPath() {
            // given
            String videoName = "nazwa";
            String description = "opis";
            Path path = Path.of("path", "to", "video");
            VideoDetails.Details details = new VideoDetails.Details();

            when(videoRepository.existsVideoByPathToFile(any())).thenReturn(true);
            // when+then
            assertThrows(RecordSavingException.class, () -> videoService.saveVideoDatabaseRecord(videoName, description, path, null, details));
            verify(videoRepository, never()).save(any());
        }

        @Test
        void shouldNotSaveDetails_IfPassedDetailsAreNull() {
            // given
            String videoName = "nazwa";
            String description = "opis";
            Path path = Path.of("path", "to", "video");
            VideoDetails.Details details = null;

            when(videoRepository.existsVideoByPathToFile(any())).thenReturn(false);
            when(videoRepository.save(any())).thenReturn(new Video());
            // when
            videoService.saveVideoDatabaseRecord(videoName, description, path, null, details);
            // then
            verify(videoRepository, times(1)).save(any());
            verify(videoDetailsRepository, never()).save(any());
        }
    }


    @Nested
    class DeleteVideoByFileIdentifierTest {
        @Test
        void shouldDeleteFile_IfEverythingIsRight() throws IOException {
            // given
            UUID videoId = UUID.randomUUID();
            String fileName = "test_video.mov";
            Path fileToDelete = tempDir.resolve(fileName);
            Files.createFile(fileToDelete);

            Assertions.assertThat(fileToDelete).exists();

            Video video = new Video("", "", fileToDelete.toString(), null, null);
            when(videoRepository.findById(any())).thenReturn(Optional.of(video));

            //when
            videoService.deleteVideoByFileIdentifier((videoId.toString()));

            //then
            Assertions.assertThat(fileToDelete).doesNotExist();
        }

        @Test
        void shouldThrowException_IfVideoIsInRepositoryButDoesNotExistInLocalStorage() {
            // given
            UUID videoId = UUID.randomUUID();
            String uuidString = videoId.toString();
            String fileName = "test_video.mov";
            Path fileToDelete = tempDir.resolve(fileName);

            Assertions.assertThat(fileToDelete).doesNotExist();

            Video video = new Video("", "", fileToDelete.toString(), null, null);
            when(videoRepository.findById(any())).thenReturn(Optional.of(video));

            //when+then
            assertThrows(VideoNotFoundException.class, () -> videoService.deleteVideoByFileIdentifier((uuidString)));
        }


        @Test
        void shouldThrowException_IfIdDoesNotExist() {
            // given
            UUID videoId = UUID.randomUUID();
            String uuidString = videoId.toString();
            when(videoRepository.findById(any())).thenReturn(Optional.empty());

            //when+then
            assertThrows(RecordNotFoundException.class, () -> videoService.deleteVideoByFileIdentifier((uuidString)));
        }

    }


    @Nested
    class DeleteNonExistentVideoRecords {
        @Test
        void shouldDeleteAndCountCorrectNumberOfUntrackedFiles() throws IOException {
            // given
            String fileName1 = "film1_wbazenieistniejacynadysku.mov";
            String fileName2 = "film2_wbazenieistniejacynadysku.mov";
            String fileName3 = "film3.mov";


            Path fileToDelete1 = tempDir.resolve(fileName1);
            Path fileToDelete2 = tempDir.resolve(fileName2);
            Path fileToDelete3 = tempDir.resolve(fileName3);
            Files.createFile(fileToDelete3);

            Assertions.assertThat(fileToDelete1).doesNotExist();
            Assertions.assertThat(fileToDelete2).doesNotExist();
            Assertions.assertThat(fileToDelete3).exists();

            when(videoRepository.streamAllVideoPaths()).thenReturn(Stream.of(fileName1, fileName2, fileName3));

            // when
            long numberOfDeletedFiles = videoService.deleteNonExistentVideoRecords();
            // then
            Assertions.assertThat(fileToDelete1).doesNotExist();
            Assertions.assertThat(fileToDelete2).doesNotExist();
            Assertions.assertThat(fileToDelete3).exists();
            verify(videoRepository, times(1)).deleteVideoByPathToFile(fileName1);
            verify(videoRepository, times(1)).deleteVideoByPathToFile(fileName2);
            assertEquals(2, numberOfDeletedFiles, "Number of deleted files is incorrect");
        }

    }


}