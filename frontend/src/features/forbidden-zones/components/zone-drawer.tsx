"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { getVideoSequences } from "@/features/detection-explorer/api/openapi-definition";
import { getApiBaseUrl } from "@/lib/client";

export type ZoneDraft = {
  name: string;
  points: number[][]; // normalized [0..1] [[x,y],...]
  reference_video_id?: string;
  aspect_ratio?: number;
};

type PickerVideo = { id: string; name: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapPayload(value: unknown): unknown {
  if (isRecord(value) && "data" in value) return value.data;
  return value;
}

// Flatten the sequences page into individually playable clips we can draw over.
function extractVideos(payload: unknown): PickerVideo[] {
  if (!isRecord(payload) || !Array.isArray(payload.content)) return [];
  const videos: PickerVideo[] = [];
  for (const sequence of payload.content) {
    if (!isRecord(sequence) || !Array.isArray(sequence.parts)) continue;
    for (const part of sequence.parts) {
      if (isRecord(part) && typeof part.id === "string") {
        videos.push({ id: part.id, name: typeof part.name === "string" ? part.name : part.id });
      }
    }
  }
  return videos;
}

function buildMediaUrl(videoId: string): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  return `${base}/videos/${videoId}`;
}

type ZoneDrawerProps = {
  initialName?: string;
  saving: boolean;
  onSave: (draft: ZoneDraft) => void;
  onCancel: () => void;
};

export function ZoneDrawer({ initialName = "", saving, onSave, onCancel }: ZoneDrawerProps) {
  const [videos, setVideos] = useState<PickerVideo[]>([]);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [name, setName] = useState(initialName);
  const [points, setPoints] = useState<number[][]>([]);
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load the list of clips to draw over.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getVideoSequences({ page: 0, size: 50, sort: ["uploadDate,desc"] });
        const list = extractVideos(unwrapPayload(response));
        if (cancelled) return;
        setVideos(list);
        setSelectedVideoId((current) => current || list[0]?.id || "");
      } catch (error) {
        if (!cancelled) {
          setVideosError(error instanceof Error ? error.message : "Failed to load videos");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset the polygon when switching the underlying clip (handled on change
  // rather than in an effect to avoid a cascading-render lint warning).
  const handleVideoChange = (id: string) => {
    setSelectedVideoId(id);
    setPoints([]);
    setAspectRatio(undefined);
  };

  const mediaUrl = useMemo(
    () => (selectedVideoId ? buildMediaUrl(selectedVideoId) : null),
    [selectedVideoId],
  );

  // Keep the canvas backing store matched to its displayed size and redraw the
  // polygon. Points are stored normalized so they scale with the element.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      if (canvas.width !== Math.round(width) || canvas.height !== Math.round(height)) {
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (points.length === 0) return;

      const pixel = points.map(([x, y]) => [x * canvas.width, y * canvas.height] as const);

      ctx.beginPath();
      ctx.moveTo(pixel[0][0], pixel[0][1]);
      for (let i = 1; i < pixel.length; i += 1) ctx.lineTo(pixel[i][0], pixel[i][1]);
      if (pixel.length >= 3) ctx.closePath();
      ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      if (pixel.length >= 3) ctx.fill();
      ctx.stroke();

      pixel.forEach(([px, py], index) => {
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = index === 0 ? "#fbbf24" : "#ef4444";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#000";
        ctx.stroke();
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [points]);

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setPoints((prev) => [...prev, [nx, ny]]);
  };

  const handleVideoMetadata = () => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      setAspectRatio(video.videoWidth / video.videoHeight);
    }
  };

  const valid = name.trim().length > 0 && points.length >= 3 && Boolean(selectedVideoId);

  const handleSave = () => {
    if (!valid) return;
    onSave({
      name: name.trim(),
      points,
      reference_video_id: selectedVideoId,
      aspect_ratio: aspectRatio,
    });
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/30 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <Card className="border-border/50 flex max-h-[90vh] w-full max-w-3xl flex-col shadow-lg">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-foreground text-lg font-semibold">New Forbidden Area</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <CardContent className="space-y-3 overflow-y-auto px-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label className="text-muted-foreground mb-1 block text-sm font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. loading-dock"
                className="border-border bg-background focus-visible:border-ring h-10 w-full rounded-lg border px-3 text-sm outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-muted-foreground mb-1 block text-sm font-medium">
                Draw over video
              </label>
              <select
                value={selectedVideoId}
                onChange={(e) => handleVideoChange(e.target.value)}
                className="border-border bg-background focus-visible:border-ring h-10 w-full rounded-lg border px-2 text-sm outline-none"
              >
                <option value="" disabled>
                  {videos.length ? "Select a video" : "No videos available"}
                </option>
                {videos.map((video) => (
                  <option key={video.id} value={video.id}>
                    {video.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {videosError ? (
            <div className="rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
              {videosError}
            </div>
          ) : null}

          <p className="text-muted-foreground text-xs">
            Click on the frame to add polygon points (3 or more). Pause the video on a
            representative frame first. The first point is highlighted in yellow.
          </p>

          <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-lg bg-black"
            style={{ aspectRatio: aspectRatio ?? 16 / 9 }}
          >
            {mediaUrl ? (
              <video
                ref={videoRef}
                key={mediaUrl}
                src={mediaUrl}
                className="absolute inset-0 h-full w-full object-fill"
                controls
                muted
                playsInline
                preload="auto"
                onLoadedMetadata={handleVideoMetadata}
              />
            ) : (
              <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
                Select a video to start drawing
              </div>
            )}
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="absolute inset-0 h-full w-full cursor-crosshair"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPoints((prev) => prev.slice(0, -1))}
                disabled={points.length === 0}
                className="border-border bg-muted text-muted-foreground hover:bg-muted/80 inline-flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm disabled:pointer-events-none disabled:opacity-50"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => setPoints([])}
                disabled={points.length === 0}
                className="border-border bg-muted text-muted-foreground hover:bg-muted/80 inline-flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm disabled:pointer-events-none disabled:opacity-50"
              >
                Clear
              </button>
              <span className="text-muted-foreground text-xs">{points.length} points</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="border-border bg-muted text-muted-foreground hover:bg-muted/80 inline-flex h-10 cursor-pointer items-center rounded-lg border px-4 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!valid || saving}
                onClick={handleSave}
                className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-10 cursor-pointer items-center rounded-lg px-4 text-sm disabled:pointer-events-none disabled:opacity-50"
              >
                {saving ? "Saving..." : "Create Area"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
