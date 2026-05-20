import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDetectionExplorerStore } from "@/features/detection-explorer/stores/detection-explorer.store";
import * as mediaController from "@/lib/endpoints/media-controller/media-controller";

vi.mock("@/lib/endpoints/media-controller/media-controller", () => ({
  deleteVideo: vi.fn(),
  getVideoSequences: vi.fn(),
  getVideoSequences1: vi.fn(),
}));

describe("DetectionExplorerStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDetectionExplorerStore.setState({
      apiOk: null,
      apiLoading: true,
      videosLoading: false,
      error: null,
      videos: [],
      pageNumber: 0,
      pageSize: 10,
      totalPages: 0,
      totalElements: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      const state = useDetectionExplorerStore.getState();

      expect(state.apiOk).toBe(null);
      expect(state.apiLoading).toBe(true);
      expect(state.videosLoading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.videos).toEqual([]);
      expect(state.pageNumber).toBe(0);
      expect(state.pageSize).toBe(10);
      expect(state.totalPages).toBe(0);
      expect(state.totalElements).toBe(0);
    });
  });

  describe("checkApiHealth", () => {
    it("should set apiOk to true on successful health check", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      const store = useDetectionExplorerStore.getState();
      await store.checkApiHealth();

      const state = useDetectionExplorerStore.getState();
      expect(state.apiOk).toBe(true);
      expect(state.apiLoading).toBe(false);
      expect(state.error).toBe(null);
    });

    it("should retry on failed health check", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true });

      const store = useDetectionExplorerStore.getState();
      await store.checkApiHealth();

      const state = useDetectionExplorerStore.getState();
      expect(state.apiOk).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should set apiOk to false after max retries", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      const store = useDetectionExplorerStore.getState();
      await store.checkApiHealth();

      const state = useDetectionExplorerStore.getState();
      expect(state.apiOk).toBe(false);
      expect(state.apiLoading).toBe(false);
      expect(state.error).toBeTruthy();
    }, 30000); // Timeout for 10 retries with exponential backoff (~22.5s delays)
  });

  describe("loadVideosPage", () => {
    it("should load videos successfully", async () => {
      const mockResponse = {
        data: {
          content: [
            {
              origin_id: "video-1",
              parts: [
                {
                  id: "part-1",
                  name: "Video 1",
                  description: "Test video",
                },
              ],
              sequence_upload_date: "2024-01-01T00:00:00Z",
            },
          ],
          page: {
            number: 0,
            totalPages: 1,
            totalElements: 1,
          },
        },
      };

      vi.mocked(mediaController.getVideoSequences).mockResolvedValue(mockResponse);

      const store = useDetectionExplorerStore.getState();
      await store.loadVideosPage(0);

      const state = useDetectionExplorerStore.getState();
      expect(state.videosLoading).toBe(false);
      expect(state.videos).toHaveLength(1);
      expect(state.videos[0]).toEqual({
        id: "video-1",
        name: "Video 1",
        description: "Test video",
        upload_date: "2024-01-01T00:00:00Z",
      });
      expect(state.pageNumber).toBe(0);
      expect(state.totalPages).toBe(1);
      expect(state.totalElements).toBe(1);
    });

    it("should handle loading error", async () => {
      vi.mocked(mediaController.getVideoSequences).mockRejectedValue(
        new Error("API Error"),
      );

      const store = useDetectionExplorerStore.getState();
      await store.loadVideosPage(0);

      const state = useDetectionExplorerStore.getState();
      expect(state.videosLoading).toBe(false);
      expect(state.videos).toEqual([]);
      expect(state.error).toBe("API Error");
    });

    it("should apply sorting and filters", async () => {
      const mockResponse = {
        data: {
          content: [],
          page: { number: 0, totalPages: 0, totalElements: 0 },
        },
      };

      vi.mocked(mediaController.getVideoSequences).mockResolvedValue(mockResponse);

      const store = useDetectionExplorerStore.getState();
      await store.loadVideosPage(
        0,
        ["uploadDate,asc"],
        { from: "2024-01-01T00:00:00", to: "2024-12-31T23:59:59" },
      );

      expect(mediaController.getVideoSequences).toHaveBeenCalledWith({
        page: 0,
        size: 10,
        sort: ["uploadDate,asc"],
        from: "2024-01-01T00:00:00",
        to: "2024-12-31T23:59:59",
      });
    });

    it("should extract description from first part with description", async () => {
      const mockResponse = {
        data: {
          content: [
            {
              origin_id: "video-1",
              parts: [
                { id: "part-1", name: "Video 1" },
                { id: "part-2", name: "Video 1 Part 2", description: "This is the desc" },
              ],
              sequence_upload_date: "2024-01-01T00:00:00Z",
            },
          ],
          page: { number: 0, totalPages: 1, totalElements: 1 },
        },
      };

      vi.mocked(mediaController.getVideoSequences).mockResolvedValue(mockResponse);

      const store = useDetectionExplorerStore.getState();
      await store.loadVideosPage(0);

      const state = useDetectionExplorerStore.getState();
      expect(state.videos[0].description).toBe("This is the desc");
    });
  });

  describe("deleteVideos", () => {
    it("should delete videos successfully", async () => {
      const mockSequenceResponse = {
        data: {
          origin_id: "video-1",
          parts: [
            { id: "part-1", name: "Video 1" },
            { id: "part-2", name: "Video 1 Part 2" },
          ],
        },
      };

      vi.mocked(mediaController.getVideoSequences1).mockResolvedValue(mockSequenceResponse);
      vi.mocked(mediaController.deleteVideo).mockResolvedValue({});

      const mockListResponse = {
        data: {
          content: [],
          page: { number: 0, totalPages: 0, totalElements: 0 },
        },
      };

      vi.mocked(mediaController.getVideoSequences).mockResolvedValue(mockListResponse);

      const store = useDetectionExplorerStore.getState();
      const selectedIds = new Set(["video-1"]);

      await store.deleteVideos(selectedIds);

      expect(mediaController.getVideoSequences1).toHaveBeenCalledWith("video-1");
      expect(mediaController.deleteVideo).toHaveBeenCalledWith("part-1");
      expect(mediaController.deleteVideo).toHaveBeenCalledWith("part-2");

      const state = useDetectionExplorerStore.getState();
      expect(state.videosLoading).toBe(false);
    });

    it("should handle delete error", async () => {
      vi.mocked(mediaController.getVideoSequences1).mockResolvedValue({
        origin_id: "video-1",
        parts: [{ id: "part-1" }],
      });

      vi.mocked(mediaController.deleteVideo).mockRejectedValue(
        new Error("Delete failed"),
      );

      const store = useDetectionExplorerStore.getState();
      const selectedIds = new Set(["video-1"]);

      await store.deleteVideos(selectedIds);

      const state = useDetectionExplorerStore.getState();
      expect(state.videosLoading).toBe(false);
      expect(state.error).toBeTruthy();
      expect(state.error).toContain("Delete failed");
    });

    it("should do nothing if no videos selected", async () => {
      const store = useDetectionExplorerStore.getState();
      const selectedIds = new Set<string>();

      await store.deleteVideos(selectedIds);

      expect(mediaController.getVideoSequences1).not.toHaveBeenCalled();
      expect(mediaController.deleteVideo).not.toHaveBeenCalled();
    });

    it("should refetch videos after deletion", async () => {
      const mockSequenceResponse = {
        data: {
          origin_id: "video-1",
          parts: [{ id: "part-1" }],
        },
      };

      vi.mocked(mediaController.getVideoSequences1).mockResolvedValue(mockSequenceResponse);
      vi.mocked(mediaController.deleteVideo).mockResolvedValue({});

      const mockListResponse = {
        data: {
          content: [],
          page: { number: 0, totalPages: 0, totalElements: 0 },
        },
      };

      vi.mocked(mediaController.getVideoSequences).mockResolvedValue(mockListResponse);

      const store = useDetectionExplorerStore.getState();

      useDetectionExplorerStore.setState({ pageNumber: 1 });

      const selectedIds = new Set(["video-1"]);

      await store.deleteVideos(selectedIds, {
        sort: ["uploadDate,desc"],
      });

      expect(mediaController.getVideoSequences).toHaveBeenCalledWith({
        page: 1,
        size: 10,
        sort: ["uploadDate,desc"],
        from: undefined,
        to: undefined,
      });
    });
  });
});
