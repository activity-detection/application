import { create } from "zustand";

import {
  deleteVideoSequence,
  getVideoSequences,
} from "@/features/detection-explorer/api/openapi-definition";
import type { VideoSequencePage } from "@/types/api";

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

export type DetectionExplorerStore = {
  // State
  apiOk: boolean | null;
  apiLoading: boolean;
  videosLoading: boolean;
  error: string | null;
  videos: VideoItem[];
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;

  // Actions
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8080";

export const useDetectionExplorerStore = create<DetectionExplorerStore>((set, get) => ({
  // Initial state
  apiOk: null,
  apiLoading: true,
  videosLoading: false,
  error: null,
  videos: [],
  pageNumber: 0,
  pageSize: 10,
  totalPages: 0,
  totalElements: 0,

  // Actions
  checkApiHealth: async () => {
    set({ apiLoading: true });
    const maxAttempts = 10;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${API_BASE_URL}/v3/api-docs`, {
          method: "GET",
          cache: "no-store",
        });

        if (response.ok) {
          set({ apiOk: true, error: null, apiLoading: false });
          return;
        }

        lastError = `API health check failed with status ${response.status}`;
      } catch {
        lastError = "Failed to connect to backend API";
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }

    set({
      apiOk: false,
      error: lastError ?? "Failed to connect to backend API",
      apiLoading: false,
    });
  },

  loadVideosPage: async (
    page: number,
    sort: string[] = ["uploadDate,desc"],
    filters?: { from?: string; to?: string },
  ) => {
    try {
      set({ videosLoading: true, error: null });
      const pageSize = get().pageSize;

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

      const videos = (data.content ?? []).map((sequence) => {
        const firstPart = sequence.parts[0];
        const firstPartWithDescription = sequence.parts.find(
          (part) => typeof part.description === "string" && part.description.trim(),
        );

        return {
          id: sequence.origin_id,
          name: firstPart?.name || `Video ${sequence.origin_id.slice(0, 8)}`,
          description: firstPartWithDescription?.description ?? undefined,
          upload_date: sequence.sequence_upload_date,
        };
      });

      set({
        videos,
        pageNumber: data.page?.number ?? page,
        totalPages: data.page?.totalPages ?? 0,
        totalElements: data.page?.totalElements ?? 0,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error loading videos";
      set({ videos: [], error: errorMessage });
    } finally {
      set({ videosLoading: false });
    }
  },

  deleteVideos: async (
    set_ids: Set<string>,
    options?: { sort?: string[]; filters?: { from?: string; to?: string } },
  ) => {
    const ids = Array.from(set_ids);
    if (ids.length === 0) {
      return;
    }

    try {
      set({ videosLoading: true, error: null });

      await Promise.all(ids.map((id) => deleteVideoSequence(id)));

      const pageNumber = get().pageNumber;
      await get().loadVideosPage(pageNumber, options?.sort, options?.filters);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error deleting videos";
      set({ error: errorMessage });
    } finally {
      set({ videosLoading: false });
    }
  },
}));
