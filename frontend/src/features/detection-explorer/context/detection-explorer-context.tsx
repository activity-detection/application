"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  deleteVideo,
  getVideoSequences,
  getVideoSequences1,
} from "@/lib/endpoints/media-controller/media-controller";
import type { VideoSequencePage } from "@/models";

type VideoItem = {
  id: string;
  name: string;
  description?: string;
  upload_date?: string;
};

type VideosPage = {
  content: VideoSequencePage["content"];
  page: VideoSequencePage["page"];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapPayload<T>(value: unknown): T {
  if (isRecord(value) && "data" in value) {
    return value.data as T;
  }
  return value as T;
}

type DetectionExplorerContextValue = {
  apiOk: boolean | null;
  apiLoading: boolean;
  videosLoading: boolean;
  error: string | null;
  videos: VideoItem[];
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;
  checkApiHealth: () => Promise<void>;
  loadVideosPage: (
    page: number,
    sort?: string[],
    filters?: { from?: string; to?: string },
  ) => Promise<void>;
  deleteVideos: (
    set: Set<string>,
    options?: { sort?: string[]; filters?: { from?: string; to?: string } },
  ) => Promise<void>;
};

const DetectionExplorerContext = createContext<
  DetectionExplorerContextValue | undefined
>(undefined);

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8080";

export function DetectionExplorerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const checkApiHealth = useCallback(async () => {
    setApiLoading(true);
    const maxAttempts = 3;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${API_BASE_URL}/v3/api-docs`, {
          method: "GET",
          cache: "no-store",
        });

        if (response.ok) {
          setApiOk(true);
          setError(null);
          setApiLoading(false);
          return;
        }

        lastError = `API health check failed with status ${response.status}`;
      } catch {
        lastError = "Failed to connect to backend API";
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }

    setApiOk(false);
    setError(lastError ?? "Failed to connect to backend API");
    setApiLoading(false);
  }, []);

  const loadVideosPage = useCallback(
    async (
      page: number,
      sort: string[] = ["uploadDate,desc"],
      filters?: { from?: string; to?: string },
    ) => {
      try {
        setVideosLoading(true);
        setError(null);

        const [response] = await Promise.all([
          getVideoSequences({
            page,
            size: pageSize,
            sort,
            from: filters?.from,
            to: filters?.to,
          }),
          new Promise((resolve) => setTimeout(resolve, 100)),
        ]);

        if (!response || typeof response !== "object") {
          throw new Error("Invalid response from API");
        }

        const data = unwrapPayload<VideosPage>(response);

        if (!Array.isArray(data.content) || typeof data.page !== "object") {
          throw new Error("Invalid response from API");
        }

        setVideos(
          (data.content ?? []).map((sequence) => {
            const firstPart = sequence.parts[0];
            const firstPartWithDescription = sequence.parts.find(
              (part) =>
                typeof part.description === "string" && part.description.trim(),
            );

            return {
              id: sequence.origin_id,
              name:
                firstPart?.name || `Video ${sequence.origin_id.slice(0, 8)}`,
              description: firstPartWithDescription?.description ?? undefined,
              upload_date: sequence.sequence_upload_date,
            };
          }),
        );
        setPageNumber(data.page?.number ?? page);
        setTotalPages(data.page?.totalPages ?? 0);
        setTotalElements(data.page?.totalElements ?? 0);
      } catch (err) {
        setVideos([]);
        setError(err instanceof Error ? err.message : "Error loading videos");
      } finally {
        setVideosLoading(false);
      }
    },
    [pageSize],
  );

  const deleteVideos = useCallback(
    async (
      set: Set<string>,
      options?: { sort?: string[]; filters?: { from?: string; to?: string } },
    ) => {
      const ids = Array.from(set);
      if (ids.length === 0) {
        return;
      }

      try {
        setVideosLoading(true);
        setError(null);

        const resolvedPartIds = await Promise.all(
          ids.map(async (id) => {
            try {
              const sequenceResponse = await getVideoSequences1(id);
              const sequence =
                unwrapPayload<VideoSequencePage["content"][number]>(
                  sequenceResponse,
                );
              return Array.isArray(sequence.parts)
                ? sequence.parts.map((part) => part.id)
                : [id];
            } catch {
              return [id];
            }
          }),
        );
        const uniquePartIds = Array.from(new Set(resolvedPartIds.flat()));

        await Promise.all(uniquePartIds.map((partId) => deleteVideo(partId)));
        await loadVideosPage(pageNumber, options?.sort, options?.filters);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error deleting videos");
      } finally {
        setVideosLoading(false);
      }
    },
    [loadVideosPage, pageNumber],
  );

  const value = useMemo<DetectionExplorerContextValue>(
    () => ({
      apiOk,
      apiLoading,
      videosLoading,
      error,
      videos,
      pageNumber,
      pageSize,
      totalPages,
      totalElements,
      checkApiHealth,
      loadVideosPage,
      deleteVideos,
    }),
    [
      apiOk,
      apiLoading,
      videosLoading,
      error,
      videos,
      pageNumber,
      pageSize,
      totalPages,
      totalElements,
      checkApiHealth,
      loadVideosPage,
      deleteVideos,
    ],
  );

  return (
    <DetectionExplorerContext.Provider value={value}>
      {children}
    </DetectionExplorerContext.Provider>
  );
}

export function useDetectionExplorerContext() {
  const context = useContext(DetectionExplorerContext);
  if (!context) {
    throw new Error(
      "useDetectionExplorerContext must be used within DetectionExplorerProvider",
    );
  }
  return context;
}
