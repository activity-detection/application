"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import shaka from "shaka-player";

import { Card, CardContent } from "@/components/ui/card";
import {
  getVideoInfo,
  getVideoSequenceInfo,
  getVideoSequences,
} from "@/features/detection-explorer/api/openapi-definition";
import { getApiBaseUrl } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { VideoSequence, VideoSequencePage, VideoSequencePart } from "@/types/api";

interface VideoPlayerProps {
  videoId: string | null;
  videoName?: string;
  videoDescription?: string;
  uploadDate?: string;
  className?: string;
  onClose: () => void;
}

interface DetectionTimestamp {
  from?: string;
  to?: string;
}

interface EventDetection {
  label?: string;
  timestamp?: DetectionTimestamp;
}

interface ObjectDetection {
  name?: string;
  count?: number;
}

interface ObjectDetections {
  timestamp?: DetectionTimestamp;
  objects?: ObjectDetection[];
}

interface VideoDetailsPayload {
  duration?: string;
  events?: EventDetection[];
  detections?: ObjectDetections[];
}

interface VideoAssetMeta {
  name: string;
  description: string;
  uploadDate: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapPayload(value: unknown): unknown {
  if (isRecord(value) && "data" in value) {
    return value.data;
  }
  return value;
}

function isVideoSequencePart(value: unknown): value is VideoSequencePart {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.upload_date === "string"
  );
}

function isVideoSequence(value: unknown): value is VideoSequence {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.origin_id !== "string" ||
    typeof value.sequence_upload_date !== "string" ||
    !Array.isArray(value.parts)
  ) {
    return false;
  }

  return value.parts.every((part) => isVideoSequencePart(part));
}

function isVideoSequencePage(value: unknown): value is VideoSequencePage {
  if (!isRecord(value) || !Array.isArray(value.content) || !isRecord(value.page)) {
    return false;
  }

  const page = value.page;
  if (
    typeof page.size !== "number" ||
    typeof page.number !== "number" ||
    typeof page.totalElements !== "number" ||
    typeof page.totalPages !== "number"
  ) {
    return false;
  }

  return value.content.every((sequence) => isVideoSequence(sequence));
}

function buildApiUrl(path: string) {
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, `${baseUrl}/`).toString();
}

function getVideoDashManifestUrl(fileIdentifier: string) {
  return `/videos/${fileIdentifier}/manifest.mpd`;
}

function getSequenceManifestUrl(originId: string) {
  return `/videos/sequences/${originId}/manifest.mpd`;
}

function getSequenceDescription(
  resolvedSequence: VideoSequence | null,
  selectedPart: VideoSequencePart | undefined,
  videoDescription?: string,
) {
  const sequenceDescription = resolvedSequence?.parts.find(
    (part) => typeof part.description === "string" && part.description.trim(),
  )?.description;

  return sequenceDescription ?? selectedPart?.description ?? videoDescription ?? "No description";
}

async function resolveVideoSequence(videoId: string): Promise<VideoSequence | null> {
  const pageSize = 50;
  let currentPage = 0;
  let totalPages = 1;

  while (currentPage < totalPages) {
    const response = await getVideoSequences({
      page: currentPage,
      size: pageSize,
      sort: ["uploadDate,desc"],
    });

    const payload = unwrapPayload(response);
    if (!isVideoSequencePage(payload)) {
      throw new Error("Invalid video page payload");
    }

    const found = payload.content.find(
      (sequence) =>
        sequence.origin_id === videoId || sequence.parts.some((part) => part.id === videoId),
    );
    if (found) {
      return found;
    }

    totalPages = payload.page.totalPages;
    currentPage += 1;
  }

  return null;
}

export function VideoPlayer({
  videoId,
  videoName,
  videoDescription,
  uploadDate,
  className,
  onClose,
}: VideoPlayerProps) {
  const [assetMeta, setAssetMeta] = useState<VideoAssetMeta | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [sequenceError, setSequenceError] = useState<string | null>(null);
  const [videoDetails, setVideoDetails] = useState<VideoDetailsPayload | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<shaka.Player | null>(null);

  useEffect(() => {
    shaka.polyfill.installAll();

    if (!videoId) {
      setAssetMeta(null);
      setManifestUrl(null);
      setSequenceError(null);
      setVideoDetails(null);
      setSequenceLoading(false);
      setDetailsLoading(false);
      setPlayerLoading(false);
      return;
    }

    let cancelled = false;

    const loadVideo = async () => {
      try {
        setSequenceLoading(true);
        setDetailsLoading(true);
        setSequenceError(null);
        setAssetMeta(null);
        setManifestUrl(null);
        setVideoDetails(null);
        setPlayerLoading(false);

        const resolvedSequence = await resolveVideoSequence(videoId);
        const hasSequence = (resolvedSequence?.parts.length ?? 0) > 1;
        const selectedPart =
          resolvedSequence?.parts.find((part) => part.id === videoId) ?? resolvedSequence?.parts[0];
        const manifestId = resolvedSequence?.origin_id ?? videoId;

        const detailsResponse = hasSequence
          ? await getVideoSequenceInfo(manifestId)
          : await getVideoInfo(manifestId);
        
        let detailsPayload: VideoDetailsPayload;
        if (detailsResponse instanceof Blob) {
          const jsonText = await detailsResponse.text();
          detailsPayload = JSON.parse(jsonText) as VideoDetailsPayload;
        } else {
          detailsPayload = unwrapPayload(detailsResponse) as VideoDetailsPayload;
        }

        if (cancelled) {
          return;
        }

        setAssetMeta({
          name: selectedPart?.name || videoName || "Video",
          description: getSequenceDescription(resolvedSequence, selectedPart, videoDescription),
          uploadDate:
            (hasSequence ? resolvedSequence?.sequence_upload_date : selectedPart?.upload_date) ||
            uploadDate ||
            "—",
        });
        setVideoDetails(detailsPayload ?? null);

        const manifestPath = hasSequence
          ? getSequenceManifestUrl(manifestId)
          : getVideoDashManifestUrl(manifestId);
        const resolvedManifestUrl = buildApiUrl(manifestPath);
        setManifestUrl(resolvedManifestUrl);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSequenceError(error instanceof Error ? error.message : "Failed to load video");
        setAssetMeta(null);
        setManifestUrl(null);
        setVideoDetails(null);
      } finally {
        if (!cancelled) {
          setSequenceLoading(false);
          setDetailsLoading(false);
        }
      }
    };

    void loadVideo();

    return () => {
      cancelled = true;
    };
  }, [uploadDate, videoDescription, videoId, videoName]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || playerRef.current || !videoId) {
      return;
    }

    if (!shaka.Player.isBrowserSupported()) {
      setSequenceError("Shaka Player not supported in this browser");
      return;
    }

    const player = new shaka.Player();
    playerRef.current = player;
    let cancelled = false;

    void player.attach(videoElement).then(() => {
      if (!cancelled) {
        setPlayerReady(true);
      }
    });

    const onError = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setSequenceError(detail instanceof Error ? detail.message : "Failed to play video");
    };

    player.addEventListener("error", onError);

    return () => {
      cancelled = true;
      setPlayerReady(false);
      player.removeEventListener("error", onError);
      playerRef.current = null;
      void player.destroy();
    };
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReady || !manifestUrl) {
      return;
    }

    let cancelled = false;
    setPlayerLoading(true);
    setSequenceError(null);

    void player
      .unload()
      .then(() => {
        return player.load(manifestUrl, 0, "application/dash+xml");
      })
      .catch((error) => {
        if (!cancelled) {
          setSequenceError(error instanceof Error ? error.message : "Failed to load manifest");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPlayerLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [manifestUrl, playerReady]);

  const events = useMemo(() => videoDetails?.events ?? [], [videoDetails]);
  const detections = useMemo(() => videoDetails?.detections ?? [], [videoDetails]);

  if (!videoId) {
    return null;
  }

  const currentName = assetMeta?.name || videoName || "Video";
  const currentDescription = assetMeta?.description || videoDescription || "No description";
  const currentUploadDate = assetMeta?.uploadDate || uploadDate || "—";

  return (
    <Card className={cn("border-border/50 bg-background flex h-full flex-col shadow-sm", className)}>
      <div className="border-border/50 flex items-center justify-between gap-3 border-b p-4 pt-0">
        <h2 className="text-foreground truncate text-lg font-semibold">
          <span className="sr-only">Selected video:</span>
          {currentName}
        </h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          aria-label="Close preview"
        >
          <svg
            className="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <CardContent className="space-y-4 p-4">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            className="h-full w-full"
            controls
            playsInline
            preload="auto"
          />
          {(sequenceLoading || playerLoading) && (
            <div className="text-muted-foreground absolute inset-0 flex items-center justify-center bg-black/60">
              Loading video...
            </div>
          )}
          {sequenceError && (
            <div className="text-muted-foreground absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center">
              {sequenceError}
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="text-foreground font-semibold">Description</h3>
          <p className="text-muted-foreground wrap-break-word">{currentDescription}</p>

          <details className="border-border/50 bg-muted/20 rounded-md border p-3">
            <summary className="text-foreground cursor-pointer font-semibold select-none">
              Events ({events.length})
            </summary>
            <div className="mt-2">
              {detailsLoading ? (
                <p className="text-muted-foreground">Loading details...</p>
              ) : events.length ? (
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div
                      key={`event-${event.label ?? "event"}-${event.timestamp?.from ?? ""}-${index}`}
                      className="border-border/50 bg-muted/30 rounded-md border p-3"
                    >
                      <div className="text-foreground text-xs">Label: {event.label ?? "—"}</div>
                      <div className="text-muted-foreground text-xs">
                        Timestamp: {event.timestamp?.from ?? "—"} {"->"}{" "}
                        {event.timestamp?.to ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No events</p>
              )}
            </div>
          </details>

          <details className="border-border/50 bg-muted/20 rounded-md border p-3">
            <summary className="text-foreground cursor-pointer font-semibold select-none">
              Detections ({detections.length})
            </summary>
            <div className="mt-2">
              {detailsLoading ? (
                <p className="text-muted-foreground">Loading details...</p>
              ) : detections.length ? (
                <div className="space-y-2">
                  {detections.map((detection, index) => (
                    <div
                      key={`detection-${detection.timestamp?.from ?? ""}-${index}`}
                      className="border-border/50 bg-muted/30 rounded-md border p-3"
                    >
                      <div className="text-muted-foreground text-xs">
                        Timestamp: {detection.timestamp?.from ?? "—"} {"->"}{" "}
                        {detection.timestamp?.to ?? "—"}
                      </div>
                      <div className="text-foreground mt-1 text-xs wrap-break-word">
                        Objects:{" "}
                        {detection.objects
                          ?.map((object) => `${object.name ?? "Object"} (${object.count ?? 1})`)
                          .join(", ") || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No detections</p>
              )}
            </div>
          </details>

          <div className="text-muted-foreground pt-2 text-xs">Uploaded: {currentUploadDate}</div>
        </div>
      </CardContent>
    </Card>
  );
}
