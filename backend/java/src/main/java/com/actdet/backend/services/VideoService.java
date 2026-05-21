package com.actdet.backend.services;

import com.actdet.backend.data.entities.Video;
import com.actdet.backend.data.entities.VideoDetails;
import com.actdet.backend.data.repositories.VideoDetailsRepository;
import com.actdet.backend.data.repositories.VideoRepository;
import com.actdet.backend.services.dtos.VideoDTO;
import com.actdet.backend.services.dtos.VideoSequenceDTO;
import com.actdet.backend.services.exceptions.RecordNotFoundException;
import com.actdet.backend.services.exceptions.RecordSavingException;
import com.actdet.backend.services.exceptions.ReferencedVideoException;
import com.actdet.backend.services.exceptions.VideoNotFoundException;
import jakarta.transaction.Transactional;
import org.jcodec.codecs.h264.mp4.AvcCBox;
import org.jcodec.containers.mp4.MP4Util;
import org.jcodec.containers.mp4.boxes.Box;
import org.jcodec.containers.mp4.boxes.NodeBox;
import org.jcodec.containers.mp4.boxes.SampleEntry;
import org.jcodec.containers.mp4.boxes.TrakBox;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class VideoService {
    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    private final Path videoFolderPath;
    private final Path dashCacheFolderPath;
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

        this.videoFolderPath = baseDir.resolve(relativeFolderPath);
        this.dashCacheFolderPath = Paths.get(System.getProperty("java.io.tmpdir"), "activity-detection-dash-cache");
        try {
            Files.createDirectories(this.dashCacheFolderPath);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot initialize DASH cache", e);
        }
        logger.info("IdentifierToVideoMapperService has been initialized. Video files will be read from: {}", this.videoFolderPath);
    }

    public boolean exists(UUID videoIdentifier) {
        return videoRepository.existsById(videoIdentifier);
    }

    public Path getVideoPathForIdentifier(String videoIdentifier) {
        String fileName = getFilePathForId(videoIdentifier);
        return videoFolderPath.resolve(fileName);
    }

    private String getFilePathForId(String id) {
        try {
            return videoRepository.getPathById(UUID.fromString(id))
                    .orElseThrow(() -> new RecordNotFoundException("Plik z podanym id (" + id + ") nie istnieje!"));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid video UUID");
        }

    }

    @Transactional
    public UUID saveVideoDatabaseRecord(String videoName, Path videoPath) {
        return saveVideoDatabaseRecord(videoName, null, videoPath);
    }

    @Transactional
    public UUID saveVideoDatabaseRecord(String videoName, Path videoPath, VideoDetails.Details detailsJson) {
        return saveVideoDatabaseRecord(videoName, null, videoPath, null, detailsJson);
    }

    @Transactional
    public UUID saveVideoDatabaseRecord(String videoName, String description, Path videoPath) {
        return saveVideoDatabaseRecord(videoName, description, videoPath, null, null);
    }

    @Transactional
    public UUID saveVideoDatabaseRecord(String videoName, String description, Path videoPath, UUID referencedVideoId) {
        return saveVideoDatabaseRecord(videoName, description, videoPath, referencedVideoId, null);
    }

    @Transactional
    public UUID saveVideoDatabaseRecord(String videoName, String description, Path videoPath, UUID referencedVideoId, VideoDetails.Details details) {
        String videoPathString = videoPath.toString();
        Video video = Video.builder().name(videoName).description(description).pathToFile(videoPathString).referencedVideoId(referencedVideoId).build();
        if (videoRepository.existsVideoByPathToFile(videoPathString)) {
            throw new RecordSavingException("Cannot save file under already existing path");
        }
        if (referencedVideoId != null && !videoRepository.existsById(referencedVideoId)) {
            throw new RecordSavingException("Specified referenced video does not exist");
        }
        video = videoRepository.save(video);
        if (details != null) {
            VideoDetails vd = new VideoDetails(video, details);
            videoDetailsRepository.save(vd);
        }

        logger.debug("Record saved to database: {}", video);
        return video.getId();
    }

    @Transactional
    protected void fixVideoReferencesAndDeleteItFromDatabase(Video videoToDelete) {
        var videosInSequence = videoRepository.findVideoSequenceByOriginId(videoToDelete.getOriginId());

        Optional<Video> videoBefore = Optional.empty();
        Video videoForDeletion = null;
        Optional<Video> videoAfter = Optional.empty();


        for (int i = 0; i < videosInSequence.size(); i++) {
            Video checkedVideo = videosInSequence.get(i);
            if (checkedVideo.getId().equals(videoToDelete.getId())) {
                videoForDeletion = checkedVideo;
                videosInSequence.remove(i);
                i--;
                if (videoForDeletion.getReferencedVideoId() != null && videoForDeletion.getId().equals(videoForDeletion.getOriginId()))
                    throw new ReferencedVideoException("Video references in sequence are corrupted. First video in sequence cannot be a continuation.");
            } else if (videoToDelete.getId().equals(checkedVideo.getReferencedVideoId())) {
                videoAfter = Optional.of(checkedVideo);
            }

            if (videoForDeletion != null && videoAfter.isPresent()) break;
        }
        if (videoForDeletion == null)
            throw new VideoNotFoundException("Could not find video for deletion in its sequence!");
        for (Video checkedVideo : videosInSequence) {
            if (checkedVideo.getId().equals(videoForDeletion.getReferencedVideoId()))
                videoBefore = Optional.of(checkedVideo);
        }

        //Jezeli usuniete video jest jedynym lub ostatnim w sekwencji to nie wymaga poprawek referencji
        //Jezeli usuniete video bylo pierwsze w sekwencji
        if (videoBefore.isEmpty() && videoAfter.isPresent()) {
            UUID newOriginId = videoAfter.get().getId();
            videosInSequence.forEach(video -> video.setOriginId(newOriginId));
            videoAfter.get().setReferencedVideoId(null);
            videoRepository.saveAllAndFlush(videosInSequence);
        }else
        //Jezeli usuniete video bylo w srodku sekwencji
        if (videoBefore.isPresent() && videoAfter.isPresent()) {
            Video fixedVideoAfter = videoAfter.get();
            fixedVideoAfter.setReferencedVideoId(videoBefore.get().getId());
            videoRepository.saveAndFlush(fixedVideoAfter);
        }

        videoRepository.delete(videoToDelete);
    }


    //Mozna ewentualnie dodac zeby jakos oznaczac ze video zostalo usuniete z sekwencji
    @Transactional
    public void deleteVideoDatabaseRecord(String videoPath) {
        Video deletedVideo = videoRepository.findByPathToFile(videoPath)
                .orElseThrow(() -> new RecordNotFoundException("Specified record does not exist"));

        fixVideoReferencesAndDeleteItFromDatabase(deletedVideo);
    }

    @Transactional
    public void deleteVideoSequenceFromDatabse(String originId){
        List<Video> deletedVideoSequence = videoRepository.findVideoSequenceByOriginId(UUID.fromString(originId));
        if(deletedVideoSequence.isEmpty()) throw new RecordNotFoundException("Video sequence with specified origin_id does not exist");

        for(Video v: deletedVideoSequence){
            Path deletedVideoPath = videoFolderPath.resolve(Paths.get(v.getPathToFile()));
            try {
                Files.delete(deletedVideoPath);

            } catch (IOException e) {
                throw new VideoNotFoundException("Specified video does not exist");
            }
        }
    }

    @Transactional
    public void deleteVideoByFileIdentifier(String fileIdentifier) {
        Video deletedVideo = videoRepository.findById(UUID.fromString(fileIdentifier))
                .orElseThrow(() -> new RecordNotFoundException("Specified record does not exist"));
        Path deletedVideoPath = videoFolderPath.resolve(Paths.get(deletedVideo.getPathToFile()));
        try {
            Files.delete(deletedVideoPath);

        } catch (IOException e) {
            throw new VideoNotFoundException("Specified video does not exist");
        }
    }

    public boolean isVideoRecordRegistered(String videoPath) {
        return videoRepository.existsVideoByPathToFile(videoPath);
    }


    @Transactional
    public long deleteNonExistentVideoRecords() {
        AtomicLong deletedRecordsCount = new AtomicLong();
        try (Stream<String> stream = videoRepository.streamAllVideoPaths()) {
            stream.forEach(path -> {
                if (!Files.isRegularFile(this.videoFolderPath.resolve(path))) {
                    deleteVideoDatabaseRecord(path);
                    deletedRecordsCount.getAndIncrement();
                }
            });
        }
        return deletedRecordsCount.get();
    }

    public Page<VideoDTO> getVideos(final Pageable pageable) {
        final Page<Video> page = videoRepository.findAll(pageable);
        return new PageImpl<>(page.get().map(VideoDTO::new).toList(), pageable, page.getTotalElements());
    }

    public Page<VideoDTO> getVideos(final Pageable pageable, LocalDateTime from, LocalDateTime to) {
        final Page<Video> page = videoRepository.findAllByUploadDateGreaterThanEqualAndUploadDateLessThanEqual(pageable, from, to);
        return new PageImpl<>(page.get().map(VideoDTO::new).toList(), pageable, page.getTotalElements());
    }


    public Page<VideoSequenceDTO> getVideoSequences(final Pageable pageable, LocalDateTime from, LocalDateTime to) {
        final Page<UUID> page = videoRepository.findVideoSequencesOriginIds(pageable, from, to);
        List<UUID> originIds = page.getContent();
        if (originIds.isEmpty()) return new PageImpl<>(Collections.emptyList(), pageable, 0);

        List<Video> allVideos = videoRepository.findAllVideoSequencesByOriginIds(originIds, pageable.getSort());
        if (!originIds.isEmpty() && allVideos.isEmpty())
            throw new ReferencedVideoException("Video origin_id references are corrupt and does not equal any existing video_id");
        Map<UUID, List<Video>> videoSequenceMap = allVideos.stream().collect(Collectors.groupingBy(Video::getOriginId));
        List<VideoSequenceDTO> videoSequencesList = originIds.stream().map(uuid -> {
            List<Video> videoList = videoSequenceMap.get(uuid);
            return new VideoSequenceDTO(videoList);
        }).toList();

        return new PageImpl<>(videoSequencesList, pageable, page.getTotalElements());
    }

    public VideoSequenceDTO getVideoSequence(String originVideoId) {
        UUID originVideoUUID;
        try {
            originVideoUUID = UUID.fromString(originVideoId);
        } catch (IllegalArgumentException e) {
            throw new RecordNotFoundException("Specified record does not exist");
        }

        List<Video> videoList = videoRepository.findVideoSequenceByOriginId(originVideoUUID);
        if (videoList.isEmpty()) throw new RecordNotFoundException("Specified record does not exist");

        return new VideoSequenceDTO(videoList);
    }

    private String escapeXml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private Duration getVideoDuration(String videoId) {
        VideoDetails.Details details = getVideoDetails(videoId);
        Duration duration = details.getDuration();
        if (duration == null) {
            throw new IllegalStateException("Video duration is required to build DASH manifest");
        }
        return duration;
    }

    private List<VideoDTO> getDashManifestVideos(String videoId) {
        try {
            return getVideoSequence(videoId).getVideos();
        } catch (RecordNotFoundException ignored) {
            UUID videoUUID;
            try {
                videoUUID = UUID.fromString(videoId);
            } catch (IllegalArgumentException e) {
                throw new RecordNotFoundException("Specified record does not exist");
            }

            Video video = videoRepository.findById(videoUUID)
                    .orElseThrow(() -> new RecordNotFoundException("Specified record does not exist"));
            return List.of(new VideoDTO(video));
        }
    }

    private String getCodecForSampleEntry(SampleEntry sampleEntry) {
        String fourcc = sampleEntry.getFourcc();
        if ("avc1".equals(fourcc)) {
            AvcCBox avcCBox = NodeBox.findFirstPath((NodeBox) sampleEntry, AvcCBox.class, Box.path("avcC"));
            if (avcCBox != null) {
                return String.format(Locale.ROOT, "avc1.%02x%02x%02x", avcCBox.getProfile(), avcCBox.getProfileCompat(), avcCBox.getLevel());
            }
            return "avc1";
        }
        if ("mp4a".equals(fourcc)) {
            return "mp4a.40.2";
        }
        return fourcc;
    }

    private String getCodecs(Path videoPath) {
        try {
            TrakBox[] tracks = MP4Util.parseMovie(videoPath.toFile()).getTracks();
            String videoCodec = null;
            String audioCodec = null;
            for (TrakBox track : tracks) {
                SampleEntry[] sampleEntries = track.getSampleEntries();
                if (sampleEntries.length == 0) {
                    continue;
                }

                String codec = getCodecForSampleEntry(sampleEntries[0]);
                if (track.isVideo() && videoCodec == null) {
                    videoCodec = codec;
                } else if (track.isAudio() && audioCodec == null) {
                    audioCodec = codec;
                }
            }
            List<String> codecs = new ArrayList<>();
            if (videoCodec != null) {
                codecs.add(videoCodec);
            }
            if (audioCodec != null) {
                codecs.add(audioCodec);
            }
            if (codecs.isEmpty()) {
                throw new IllegalStateException("Video codecs are required to build DASH manifest");
            }
            return String.join(",", codecs);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to inspect video codecs", e);
        }
    }

    private long estimateBandwidth(Path videoPath, Duration duration) {
        try {
            long fileSizeBytes = Files.size(videoPath);
            long durationMillis = Math.max(1L, duration.toMillis());
            return Math.max(1L, Math.round((fileSizeBytes * 8_000d) / durationMillis));
        } catch (IOException e) {
            logger.warn("Cannot estimate bandwidth. videoPath={}", videoPath, e);
            return 1L;
        }
    }

    private Path getDashPackageFolder(String cacheKey, String videoId) {
        return dashCacheFolderPath.resolve(cacheKey).resolve(videoId);
    }

    private String dashCacheKeyForVideo(String videoId) {
        return "video-" + videoId;
    }

    private String dashCacheKeyForSequence(String originId) {
        return "sequence-" + originId;
    }

    private Path getDashManifestPath(String cacheKey, String videoId) {
        return getDashPackageFolder(cacheKey, videoId).resolve("manifest.mpd");
    }

    private Path getDashAssetPath(String cacheKey, String videoId, String assetPath) {
        return getDashPackageFolder(cacheKey, videoId).resolve(assetPath).normalize();
    }

    private void generateDashPackage(Path sourceVideoPath, Path packageFolder) {
        Path manifestPath = packageFolder.resolve("manifest.mpd");
        if (Files.exists(manifestPath)) {
            return;
        }

        try {
            Files.createDirectories(packageFolder);
            double segDurationSeconds = Math.max(2d, Math.min(6d, getVideoDurationFromSource(sourceVideoPath).toMillis() / 1000d));
            Process process = new ProcessBuilder(
                    "ffmpeg",
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-i",
                    sourceVideoPath.toString(),
                    "-map",
                    "0",
                    "-c",
                    "copy",
                    "-f",
                    "dash",
                    "-use_template",
                    "1",
                    "-use_timeline",
                    "1",
                    "-seg_duration",
                    String.valueOf(segDurationSeconds),
                    "-init_seg_name",
                    "init-$RepresentationID$.m4s",
                    "-media_seg_name",
                    "chunk-$RepresentationID$-$Number%05d$.m4s",
                    "manifest.mpd"
            ).directory(packageFolder.toFile()).redirectErrorStream(true).start();

            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (process.waitFor() != 0) {
                throw new IllegalStateException("Failed to generate DASH package for " + sourceVideoPath + ": " + output);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Failed to generate DASH package for " + sourceVideoPath, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Failed to generate DASH package for " + sourceVideoPath, e);
        }
    }

    private Duration getVideoDurationFromSource(Path sourceVideoPath) {
        try {
            VideoDetails.Details details = getVideoDetailsByPath(sourceVideoPath);
            if (details.getDuration() == null) {
                throw new IllegalStateException("Video duration is required to build DASH manifest");
            }
            return details.getDuration();
        } catch (RuntimeException e) {
            throw e;
        }
    }

    private VideoDetails.Details getVideoDetailsByPath(Path sourceVideoPath) {
        Optional<UUID> videoId = getVideoIdByRelativePathToFile(videoFolderPath.relativize(sourceVideoPath));
        if (videoId.isEmpty()) {
            throw new RecordNotFoundException("Specified video does not exist");
        }
        return getVideoDetails(videoId.get().toString());
    }

    private String extractDashPeriodBody(String dashManifest) {
        int periodStart = dashManifest.indexOf("<Period");
        int periodEnd = dashManifest.lastIndexOf("</Period>");
        if (periodStart < 0 || periodEnd < 0) {
            throw new IllegalStateException("Generated DASH package missing Period");
        }
        int bodyStart = dashManifest.indexOf('>', periodStart);
        if (bodyStart < 0 || bodyStart >= periodEnd) {
            throw new IllegalStateException("Generated DASH package missing Period body");
        }
        return dashManifest.substring(bodyStart + 1, periodEnd).trim();
    }

    private String buildDashManifest(List<VideoDTO> videos, boolean sequenceManifest, String cacheKey) {
        if (videos.isEmpty()) {
            throw new IllegalStateException("DASH manifest requires at least one video");
        }

        List<Duration> durations = new ArrayList<>(videos.size());
        Duration totalDuration = Duration.ZERO;
        for (VideoDTO video : videos) {
            Duration duration = getVideoDuration(video.getId().toString());
            durations.add(duration);
            totalDuration = totalDuration.plus(duration);
        }

        StringBuilder manifest = new StringBuilder();
        manifest.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        manifest.append("<MPD xmlns=\"urn:mpeg:dash:schema:mpd:2011\"")
                .append(" type=\"static\"")
                .append(" profiles=\"urn:mpeg:dash:profile:isoff-on-demand:2011\"")
                .append(" minBufferTime=\"PT1.5S\"")
                .append(" mediaPresentationDuration=\"").append(escapeXml(totalDuration.toString())).append("\">\n");

        Duration periodStart = Duration.ZERO;
        for (int index = 0; index < videos.size(); index++) {
            VideoDTO video = videos.get(index);
            Duration duration = durations.get(index);
            Path videoPath = getVideoPathForIdentifier(video.getId().toString());
            Path packageFolder = getDashPackageFolder(cacheKey, video.getId().toString());
            generateDashPackage(videoPath, packageFolder);
            String periodBody;
            try {
                periodBody = extractDashPeriodBody(Files.readString(getDashManifestPath(cacheKey, video.getId().toString())));
            } catch (IOException e) {
                throw new IllegalStateException("Failed to read DASH manifest for " + video.getId(), e);
            }

            manifest.append("  <Period id=\"period-").append(index + 1).append("\"")
                    .append(" start=\"").append(escapeXml(periodStart.toString())).append("\"")
                    .append(" duration=\"").append(escapeXml(duration.toString())).append("\">\n");
            manifest.append("    <BaseURL>")
                    .append(sequenceManifest ? "dash/" + escapeXml(video.getId().toString()) + "/" : "dash/")
                    .append("</BaseURL>\n");
            manifest.append(periodBody).append("\n");
            manifest.append("  </Period>\n");
            periodStart = periodStart.plus(duration);
        }

        manifest.append("</MPD>\n");
        return manifest.toString();
    }

    public String getDashManifestForVideo(String videoId) {
        UUID videoUUID;
        try {
            videoUUID = UUID.fromString(videoId);
        } catch (IllegalArgumentException e) {
            throw new RecordNotFoundException("Specified record does not exist");
        }

        Video video = videoRepository.findById(videoUUID)
                .orElseThrow(() -> new RecordNotFoundException("Specified record does not exist"));
        return buildDashManifest(List.of(new VideoDTO(video)), false, dashCacheKeyForVideo(videoId));
    }

    public String getDashManifestForSequence(String originId) {
        return buildDashManifest(getDashManifestVideos(originId), true, dashCacheKeyForSequence(originId));
    }

    public org.springframework.core.io.Resource getDashAssetForVideo(String videoId, String assetPath) {
        Path asset = getDashAssetPath(dashCacheKeyForVideo(videoId), videoId, assetPath);
        if (!Files.exists(asset)) {
            throw new RecordNotFoundException("Specified DASH asset does not exist: " + asset);
        }
        return new org.springframework.core.io.FileSystemResource(asset);
    }

    public org.springframework.core.io.Resource getDashAssetForSequence(String originId, String videoId, String assetPath) {
        Path asset = getDashAssetPath(dashCacheKeyForSequence(originId), videoId, assetPath);
        if (!Files.exists(asset)) {
            throw new RecordNotFoundException("Specified DASH asset does not exist: " + asset);
        }
        return new org.springframework.core.io.FileSystemResource(asset);
    }

    public Optional<UUID> getVideoIdByRelativePathToFile(Path pathToFile) {
        if (pathToFile == null) {
            return Optional.empty();
        }
        return this.videoRepository.findVideoIdByPathToFile(pathToFile.toString());
    }


    public Path getVideoFolderPath() {
        return this.videoFolderPath;
    }

    public int getMaxDepth() {
        return this.maxDepth;
    }

    public VideoDetails.Details getVideoDetails(String videoId) {
        VideoDetails details = videoDetailsRepository.findById(UUID.fromString(videoId)).orElseThrow(() -> new RecordNotFoundException("Specified video does not exist"));
        return details.getDetails();
    }

    public VideoDetails.Details getVideoSequenceDetails(String originId) {
        VideoSequenceDTO videoSequenceDTO = getVideoSequence(originId);

        List<UUID> ids = videoSequenceDTO.getVideos().stream()
                .map(VideoDTO::getId)
                .toList();

        List<VideoDetails> unorderedDetails = videoDetailsRepository.findAllById(ids);
        Map<UUID, VideoDetails> detailsMap = unorderedDetails.stream()
                .collect(Collectors.toMap(VideoDetails::getId, d -> d));

        List<VideoDetails.Details> orderedDetails = ids.stream()
                .map(uuid -> detailsMap.get(uuid).getDetails())
                .toList();

        VideoDetails.Details sequenceDetails = new VideoDetails.Details();
        Duration sequenceDuration = Duration.ZERO;

        for (VideoDetails.Details details : orderedDetails) {
            Duration sd = sequenceDuration;
            details.getDetectedObjects().forEach(objectDetections -> {
                VideoDetails.Details.DetectionTimestamp dt = objectDetections.getDetectionTimestamp();
                objectDetections.setDetectionTimestamp(new VideoDetails.Details.DetectionTimestamp(dt.from().plus(sd), dt.to().plus(sd)));
            });

            details.getEventDetections().forEach(eventDetection -> {
                VideoDetails.Details.DetectionTimestamp dt = eventDetection.getDetectionTimestamp();
                eventDetection.setDetectionTimestamp(new VideoDetails.Details.DetectionTimestamp(dt.from().plus(sd), dt.to().plus(sd)));
            });


            sequenceDetails.getEventDetections().addAll(details.getEventDetections());
            sequenceDetails.getDetectedObjects().addAll(details.getDetectedObjects());
            sequenceDuration = sequenceDuration.plus(details.getDuration());
        }
        sequenceDetails.setDuration(sequenceDuration);
        return sequenceDetails;
    }

}
