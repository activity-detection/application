"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import videojs from "video.js";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type {
  Details,
  VideoSequence,
  VideoSequencePage,
  VideoSequencePart,
} from "@/models";
import {
  getVideoInfo,
  getVideoSequenceInfo,
  getVideoSequences,
} from "@/lib/endpoints/media-controller/media-controller";
import { getApiBaseUrl } from "@/lib/client";
import {
  formatSecondsAsClock,
  parseIsoDurationToSeconds,
} from "@/utils/duration";

interface VideoPlayerProps {
  videoId: string | null;
  videoName?: string;
  videoDescription?: string;
  uploadDate?: string;
  className?: string;
  onClose: () => void;
}

interface VideoSourceCandidate {
  src: string;
  mimeType?: string;
}

interface VideoAssetMeta {
  name: string;
  description: string;
  uploadDate: string;
}

function formatTimestampRange(from?: string, to?: string) {
  if (!from && !to) {
    return "—";
  }
  return `${from || "—"} -> ${to || "—"}`;
}

function normalizeMimeType(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.split(";")[0]?.trim().toLowerCase();
  return normalized && normalized.startsWith("video/") ? normalized : undefined;
}

function guessMimeTypeFromName(name?: string): string | undefined {
  const normalized = name?.toLowerCase() ?? "";
  if (normalized.endsWith(".mp4")) {
    return "video/mp4";
  }
  if (normalized.endsWith(".mov")) {
    return "video/quicktime";
  }
  return undefined;
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
  if (
    !isRecord(value) ||
    !Array.isArray(value.content) ||
    !isRecord(value.page)
  ) {
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

async function resolveVideoSequence(
  videoId: string,
): Promise<VideoSequence | null> {
  const pageSize = 50;
  let currentPage = 0;
  let totalPages = 1;

  while (currentPage < totalPages) {
    const pageResponse = await getVideoSequences({
      page: currentPage,
      size: pageSize,
      sort: ["uploadDate,desc"],
    });

    const pagePayload = unwrapPayload(pageResponse);
    if (!isVideoSequencePage(pagePayload)) {
      throw new Error("Invalid video page payload");
    }

    const found = pagePayload.content.find(
      (sequence) =>
        sequence.origin_id === videoId ||
        sequence.parts.some((part) => part.id === videoId),
    );
    if (found) {
      return found;
    }

    totalPages = pagePayload.page.totalPages;
    currentPage += 1;
  }

  return null;
}

function buildSourceCandidatesForPath(
  sourcePath: string,
  preferredMime?: string,
): VideoSourceCandidate[] {
  const baseUrl = getApiBaseUrl();
  const altBaseUrl = baseUrl.replace(/\/api\/?$/, "");
  const srcs = [`${baseUrl}${sourcePath}`, `${altBaseUrl}${sourcePath}`];
  const candidates: VideoSourceCandidate[] = [];
  const seen = new Set<string>();

  const pushCandidate = (src: string, mimeType?: string) => {
    const key = `${src}::${mimeType ?? ""}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push({ src, mimeType });
  };

  const mimeOrder = [
    preferredMime,
    "video/mp4",
    "video/quicktime",
    undefined,
  ].filter((v, i, a) => v !== undefined);

  for (const s of srcs) {
    for (const mime of mimeOrder) {
      pushCandidate(s, mime as string | undefined);
    }
  }

  return candidates;
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
  const [sourceCandidates, setSourceCandidates] = useState<
    VideoSourceCandidate[]
  >([]);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [sequenceError, setSequenceError] = useState<string | null>(null);
  const [videoDetails, setVideoDetails] = useState<Details | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);
  const sourceCandidatesRef = useRef<VideoSourceCandidate[]>([]);
  const renderDetectionMarkersRef = useRef<() => void>(() => undefined);
  const markerRenderRetryCountRef = useRef(0);

  useEffect(() => {
    sourceCandidatesRef.current = sourceCandidates;
  }, [sourceCandidates]);

  useEffect(() => {
    if (!videoId) {
      setAssetMeta(null);
      setSourceCandidates([]);
      setActiveSourceIndex(0);
      setSequenceError(null);
      setVideoDetails(null);
      return;
    }

    let isMounted = true;
    setSequenceLoading(true);
    setDetailsLoading(true);
    setSequenceError(null);
    setAssetMeta(null);
    setSourceCandidates([]);
    setActiveSourceIndex(0);
    setVideoDetails(null);

    const loadVideo = async () => {
      try {
        const resolvedSequence = await resolveVideoSequence(videoId);
        const hasSequenceConcat =
          !!resolvedSequence && resolvedSequence.parts.length > 1;
        const selectedPart =
          resolvedSequence?.parts.find((part) => part.id === videoId) ??
          resolvedSequence?.parts[0];
        const sequenceOriginId = resolvedSequence?.origin_id ?? videoId;

        const sourceName = selectedPart?.name || videoName || "Video";
        const preferredMime = normalizeMimeType(
          guessMimeTypeFromName(sourceName),
        );

        const primaryPath = hasSequenceConcat
          ? `/videos/sequences/${sequenceOriginId}/concat`
          : `/videos/${videoId}`;
        const fallbackPath = `/videos/${selectedPart?.id ?? videoId}`;
        const candidates = [
          ...buildSourceCandidatesForPath(primaryPath, preferredMime),
          ...(hasSequenceConcat
            ? buildSourceCandidatesForPath(fallbackPath, preferredMime)
            : []),
        ];

        const descriptionSource = hasSequenceConcat
          ? resolvedSequence?.parts.find(
              (part) =>
                typeof part.description === "string" && part.description.trim(),
            )?.description
          : selectedPart?.description;

        const meta: VideoAssetMeta = {
          name: sourceName,
          description:
            descriptionSource ?? videoDescription ?? "No description",
          uploadDate:
            (hasSequenceConcat
              ? resolvedSequence?.sequence_upload_date
              : selectedPart?.upload_date) ||
            uploadDate ||
            "—",
        };

        const detailsResponse = hasSequenceConcat
          ? await getVideoSequenceInfo(sequenceOriginId)
          : await getVideoInfo(videoId);
        const detailsPayload = unwrapPayload(detailsResponse) as Details;

        if (!isMounted) {
          return;
        }

        setAssetMeta(meta);
        setSourceCandidates(candidates);
        setActiveSourceIndex(0);
        setVideoDetails(detailsPayload ?? null);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setSequenceError(
          error instanceof Error ? error.message : "Failed to load video",
        );
        setAssetMeta(null);
        setSourceCandidates([]);
        setVideoDetails(null);
      } finally {
        if (isMounted) {
          setSequenceLoading(false);
          setDetailsLoading(false);
        }
      }
    };

    void loadVideo();

    return () => {
      isMounted = false;
    };
  }, [videoDescription, videoId, videoName, uploadDate]);

  const detectionMarkers = useMemo(() => {
    if (!videoDetails?.detections?.length) {
      return [];
    }

    return videoDetails.detections
      .map((detection, index) => {
        const fromSeconds = parseIsoDurationToSeconds(
          detection.timestamp?.from,
        );
        const toSeconds = parseIsoDurationToSeconds(detection.timestamp?.to);
        if (
          fromSeconds === null ||
          !Number.isFinite(fromSeconds) ||
          fromSeconds < 0
        ) {
          return null;
        }

        const label =
          detection.objects
            .map((object) => `${object.name} (${object.count ?? 1})`)
            .join(", ") || "Detection";

        return {
          key: `detection-${index}-${detection.timestamp?.from ?? ""}`,
          fromSeconds,
          toSeconds:
            toSeconds !== null &&
            Number.isFinite(toSeconds) &&
            toSeconds >= fromSeconds
              ? toSeconds
              : null,
          label,
        };
      })
      .filter(
        (
          marker,
        ): marker is {
          key: string;
          fromSeconds: number;
          toSeconds: number | null;
          label: string;
        } => marker !== null,
      );
  }, [videoDetails?.detections]);

  const renderDetectionMarkers = useCallback(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) {
      return;
    }

    const root = player.el();
    if (!root) {
      return;
    }

    const progressHolder = root.querySelector(
      ".vjs-progress-holder",
    ) as HTMLElement | null;
    if (!progressHolder) {
      if (markerRenderRetryCountRef.current < 5) {
        markerRenderRetryCountRef.current += 1;
        window.setTimeout(() => {
          renderDetectionMarkersRef.current();
        }, 50);
      }
      return;
    }
    markerRenderRetryCountRef.current = 0;

    progressHolder
      .querySelectorAll(".vjs-detection-marker, .vjs-detection-marker-range")
      .forEach((marker) => {
        marker.remove();
      });

    const duration = player.duration();
    if (
      typeof duration !== "number" ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      return;
    }

    detectionMarkers.forEach((marker) => {
      const clampedFrom = Math.max(0, Math.min(marker.fromSeconds, duration));
      const clampedTo =
        marker.toSeconds !== null
          ? Math.max(clampedFrom, Math.min(marker.toSeconds, duration))
          : clampedFrom;
      const leftPercent = (clampedFrom / duration) * 100;
      const rangeWidthPercent = ((clampedTo - clampedFrom) / duration) * 100;
      const hasRange = rangeWidthPercent > 0.2;
      const element = document.createElement("button");
      element.type = "button";
      element.className = hasRange
        ? "vjs-detection-marker-range"
        : "vjs-detection-marker";
      const tooltip = hasRange
        ? `${formatSecondsAsClock(clampedFrom)} -> ${formatSecondsAsClock(clampedTo)} — ${marker.label}`
        : `${formatSecondsAsClock(clampedFrom)} — ${marker.label}`;
      element.title = tooltip;
      element.setAttribute("aria-label", tooltip);
      element.style.left = `${leftPercent}%`;
      if (hasRange) {
        element.style.width = `${Math.max(rangeWidthPercent, 0.8)}%`;
      }
      element.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        player.currentTime(clampedFrom);
        const playPromise = player.play();
        if (playPromise) {
          void playPromise.catch(() => {
            /* autoplay policy */
          });
        }
      };

      progressHolder.appendChild(element);
    });
  }, [detectionMarkers]);

  useEffect(() => {
    renderDetectionMarkersRef.current = renderDetectionMarkers;
  }, [renderDetectionMarkers]);

  const applyCurrentSource = useCallback(() => {
    const player = playerRef.current;
    const candidate = sourceCandidates[activeSourceIndex];
    if (!player || player.isDisposed() || !candidate) {
      return;
    }

    player.ready(() => {
      if (player.isDisposed()) {
        return;
      }
      player.pause();
      player.src([
        candidate.mimeType
          ? { src: candidate.src, type: candidate.mimeType }
          : { src: candidate.src },
      ]);
      player.load();
      setSequenceError(null);
    });
  }, [activeSourceIndex, sourceCandidates]);

  useEffect(() => {
    const host = playerHostRef.current;
    if (!host || !host.isConnected || playerRef.current) {
      return;
    }

    const videoElement = document.createElement("video-js");
    videoElement.className = "video-js vjs-big-play-centered w-full h-full";
    host.innerHTML = "";
    host.appendChild(videoElement);

    const player = videojs(videoElement, {
      controls: true,
      preload: "auto",
      fluid: true,
      responsive: true,
      aspectRatio: "16:9",
      html5: {
        vhs: {
          overrideNative: false,
        },
        nativeVideoTracks: true,
        nativeAudioTracks: true,
      },
    });
    playerRef.current = player;

    const onLoadedMetadata = () => {
      window.requestAnimationFrame(() => {
        renderDetectionMarkersRef.current();
      });
    };
    const onError = () => {
      setActiveSourceIndex((previousIndex) => {
        const nextIndex = previousIndex + 1;
        if (nextIndex < sourceCandidatesRef.current.length) {
          return nextIndex;
        }
        setSequenceError("Failed to play video source");
        return previousIndex;
      });
    };

    player.on("loadedmetadata", onLoadedMetadata);
    player.on("durationchange", onLoadedMetadata);
    player.on("error", onError);

    return () => {
      player.off("loadedmetadata", onLoadedMetadata);
      player.off("durationchange", onLoadedMetadata);
      player.off("error", onError);
      player.dispose();
      playerRef.current = null;
      host.innerHTML = "";
    };
  }, []);

  useEffect(() => {
    applyCurrentSource();
  }, [applyCurrentSource]);

  useEffect(() => {
    renderDetectionMarkers();
  }, [renderDetectionMarkers]);

  if (!videoId) return null;

  const currentName = assetMeta?.name || videoName || "Video";
  const currentDescription =
    assetMeta?.description || videoDescription || "No description";
  const currentUploadDate = assetMeta?.uploadDate || uploadDate || "—";
  const eventsCount = videoDetails?.events?.length ?? 0;
  const detectionsCount = videoDetails?.detections?.length ?? 0;

  return (
    <Card
      className={cn(
        "h-full border-border/50 shadow-sm bg-background flex flex-col",
        className,
      )}
    >
      <div className="flex justify-between items-center p-4 pt-0 border-b border-border/50 gap-3">
        <h2 className="text-lg font-semibold text-foreground truncate">
          <span className="sr-only">Selected video:</span>
          {currentName}
        </h2>
        <button
          onClick={onClose}
          className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close preview"
        >
          <svg
            className="w-5 h-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <CardContent className="p-4 space-y-4">
        <div className="aspect-video rounded-lg bg-black overflow-hidden relative">
          <div ref={playerHostRef} data-vjs-player className="w-full h-full" />
          {sequenceLoading ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-black/60">
              Loading video...
            </div>
          ) : sequenceError ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-black/60">
              Failed to load video
            </div>
          ) : sourceCandidates.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-black/60">
              Failed to load video
            </div>
          ) : null}
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-semibold text-foreground">Description</h3>
          <p className="text-muted-foreground wrap-break-word">
            {currentDescription}
          </p>

          <details className="rounded-md border border-border/50 bg-muted/20 p-3">
            <summary className="cursor-pointer select-none font-semibold text-foreground">
              Events ({eventsCount})
            </summary>
            <div className="mt-2">
              {detailsLoading ? (
                <p className="text-muted-foreground">Loading details...</p>
              ) : videoDetails?.events?.length ? (
                <div className="space-y-2">
                  {videoDetails.events.map((event, index) => (
                    <div
                      key={`event-${event.label}-${event.timestamp?.from ?? ""}-${index}`}
                      className="rounded-md border border-border/50 bg-muted/30 p-3"
                    >
                      <div className="text-xs text-foreground">
                        Label: {event.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Timestamp:{" "}
                        {formatTimestampRange(
                          event.timestamp?.from,
                          event.timestamp?.to,
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No events</p>
              )}
            </div>
          </details>

          <details className="rounded-md border border-border/50 bg-muted/20 p-3">
            <summary className="cursor-pointer select-none font-semibold text-foreground">
              Detections ({detectionsCount})
            </summary>
            <div className="mt-2">
              {detailsLoading ? (
                <p className="text-muted-foreground">Loading details...</p>
              ) : videoDetails?.detections?.length ? (
                <div className="space-y-2">
                  {videoDetails.detections.map((detection, index) => (
                    <div
                      key={`detection-${detection.timestamp?.from ?? ""}-${index}`}
                      className="rounded-md border border-border/50 bg-muted/30 p-3"
                    >
                      <div className="text-xs text-muted-foreground">
                        Timestamp:{" "}
                        {formatTimestampRange(
                          detection.timestamp?.from,
                          detection.timestamp?.to,
                        )}
                      </div>
                      <div className="mt-1 text-xs text-foreground wrap-break-word">
                        Objects:{" "}
                        {detection.objects
                          .map(
                            (object) => `${object.name} (${object.count ?? 1})`,
                          )
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

          <div className="pt-2 text-xs text-muted-foreground">
            Uploaded: {currentUploadDate}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
