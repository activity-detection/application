"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoPlayer } from "@/features/detection-explorer/components/video-player";
import { useDetectionExplorerContext } from "@/features/detection-explorer/context/detection-explorer-context";
import SettingsWindow from "@/features/detection-rules/components/settings-window";

const DeleteVideosComponent = dynamic(
  () =>
    import("./delete-videos-window").then(
      (module) => module.DeleteVideosComponent,
    ),
  {
    ssr: false,
    loading: () => null,
  },
);

type SortConfig = {
  key: "uploadDate";
  direction: "asc" | "desc";
};

type SelectedVideoDetails = {
  name: string;
  description?: string;
  uploadDate?: string;
};

function formatUploadDate(uploadDate?: string) {
  return uploadDate
    ? new Date(uploadDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : undefined;
}

export function VideoList() {
  const {
    videosLoading,
    videos,
    pageNumber,
    totalPages,
    totalElements,
    loadVideosPage,
    deleteVideos,
  } = useDetectionExplorerContext();

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "uploadDate",
    direction: "desc",
  });

  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedVideoDetails, setSelectedVideoDetails] =
    useState<SelectedVideoDetails | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const hasInvalidDateRange = Boolean(
    startDate && endDate && startDate > endDate,
  );

  const getDateFilters = () => ({
    from: startDate ? `${startDate}T00:00:00` : undefined,
    to: endDate ? `${endDate}T23:59:59` : undefined,
  });

  const handleSort = (key: SortConfig["key"]) => {
    const newDirection =
      sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction: newDirection });
    void loadVideosPage(0, [`${key},${newDirection}`], getDateFilters());
  };

  const handlePrevious = () => {
    if (pageNumber > 0) {
      void loadVideosPage(
        pageNumber - 1,
        [`${sortConfig.key},${sortConfig.direction}`],
        getDateFilters(),
      );
    }
  };

  const handleNext = () => {
    if (pageNumber + 1 < totalPages) {
      void loadVideosPage(
        pageNumber + 1,
        [`${sortConfig.key},${sortConfig.direction}`],
        getDateFilters(),
      );
    }
  };

  const applyDateFilter = () => {
    if (hasInvalidDateRange) {
      return;
    }
    void loadVideosPage(
      0,
      [`${sortConfig.key},${sortConfig.direction}`],
      getDateFilters(),
    );
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
    void loadVideosPage(0, [`${sortConfig.key},${sortConfig.direction}`], {
      from: undefined,
      to: undefined,
    });
  };

  const renderSortIcon = (key: SortConfig["key"]) => {
    if (sortConfig.key !== key) return " ↕";
    return sortConfig.direction === "asc" ? " ↑" : " ↓";
  };

  const currentPageVideoIds = useMemo(
    () => videos.map((video) => video.id),
    [videos],
  );
  const selectedOnCurrentPageCount = useMemo(
    () =>
      currentPageVideoIds.reduce(
        (count, id) => (selectedVideoIds.has(id) ? count + 1 : count),
        0,
      ),
    [currentPageVideoIds, selectedVideoIds],
  );
  const allOnCurrentPageSelected =
    currentPageVideoIds.length > 0 &&
    selectedOnCurrentPageCount === currentPageVideoIds.length;
  const someOnCurrentPageSelected =
    selectedOnCurrentPageCount > 0 && !allOnCurrentPageSelected;
  const selectAllAriaChecked: "true" | "false" | "mixed" =
    someOnCurrentPageSelected
      ? "mixed"
      : allOnCurrentPageSelected
        ? "true"
        : "false";
  const selectAllAriaLabel = allOnCurrentPageSelected
    ? "Deselect all videos on current page"
    : someOnCurrentPageSelected
      ? "Select all videos on current page, currently partially selected"
      : "Select all videos on current page";
  const anyVideoSelected = selectedVideoIds.size > 0;

  useEffect(() => {
    if (!selectedVideoId) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedVideoId(null);
        setSelectedVideoDetails(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedVideoId]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someOnCurrentPageSelected;
    }
  }, [someOnCurrentPageSelected]);

  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideoIds((previous) => {
      const next = new Set(previous);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const toggleSelectAllCurrentPage = () => {
    setSelectedVideoIds((previous) => {
      const next = new Set(previous);
      const pageFullySelected = currentPageVideoIds.every((id) => next.has(id));

      currentPageVideoIds.forEach((id) => {
        if (pageFullySelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });

      return next;
    });
  };

  const handleOpenDeleteModal = () => {
    if (!anyVideoSelected) {
      return;
    }
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    await deleteVideos(selectedVideoIds, {
      sort: [`${sortConfig.key},${sortConfig.direction}`],
      filters: getDateFilters(),
    });
    setSelectedVideoIds(new Set());
    setIsDeleteModalOpen(false);
    setSelectedVideoId(null);
    setSelectedVideoDetails(null);
  };

  const handleRowClick = (
    event: MouseEvent<HTMLTableRowElement>,
    video: (typeof videos)[number],
  ) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-checkbox-cell="true"]')) {
      return;
    }
    setSelectedVideoId(video.id);
    setSelectedVideoDetails({
      name: video.name,
      description: video.description,
      uploadDate: formatUploadDate(video.upload_date),
    });
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {selectedVideoId ? (
        <div className="lg:w-[42%] xl:w-[38%]">
          <VideoPlayer
            videoId={selectedVideoId}
            videoName={selectedVideoDetails?.name}
            videoDescription={selectedVideoDetails?.description}
            uploadDate={selectedVideoDetails?.uploadDate}
            onClose={() => {
              setSelectedVideoId(null);
              setSelectedVideoDetails(null);
            }}
          />
        </div>
      ) : null}

      <Card
        className={cn(
          "border-border/50 shadow-sm transition-all duration-300",
          selectedVideoId
            ? "lg:w-[58%] xl:w-[62%] hidden lg:block"
            : "w-full lg:ml-auto",
        )}
      >
        <CardContent className="p-8 pt-0">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-muted/70 px-3 text-sm text-muted-foreground">
                <span className="hidden md:inline">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="bg-transparent text-foreground outline-none"
                  aria-label="Start date"
                />
              </label>

              <span className="px-1 text-sm text-muted-foreground">to</span>

              <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-muted/70 px-3 text-sm text-muted-foreground">
                <span className="hidden md:inline">To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="bg-transparent text-foreground outline-none"
                  aria-label="End date"
                />
              </label>

              <button
                type="button"
                onClick={applyDateFilter}
                disabled={hasInvalidDateRange}
                className="inline-flex h-10 items-center rounded-lg border border-border bg-muted px-4 text-sm text-muted-foreground gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>

              <button
                type="button"
                onClick={clearDateFilter}
                className="inline-flex h-10 items-center rounded-lg border border-border bg-muted px-4 text-sm text-muted-foreground gap-1 cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleOpenDeleteModal}
                disabled={!anyVideoSelected}
                className={cn(
                  "inline-flex h-10 items-center rounded-lg border ease-in duration-200 px-4 text-sm gap-1 cursor-pointer transition-colors",
                  anyVideoSelected
                    ? "bg-red-900/70 text-foreground hover:bg-red-900/90"
                    : "border-border bg-red-900/50 text-muted-foreground disabled:opacity-70 disabled:cursor-not-allowed",
                )}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path
                    fill="none"
                    d="m14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48 48 0 0 0-3.478-.397m-12 .562q.51-.088 1.022-.165m0 0a48 48 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a52 52 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a49 49 0 0 0-7.5 0"
                  />
                </svg>
                <span className="md:block hidden">Delete video</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex h-10 items-center rounded-lg border border-border bg-muted px-4 text-sm text-muted-foreground gap-1 cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93c.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204s.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78c-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107c-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93c-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204s-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78c.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107s.71-.505.78-.929z" />
                  <path d="M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0" />
                </svg>
                <span className="md:block hidden">Settings</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-muted/70 border-border/50">
                  <TableHead className="p-4 w-12" data-checkbox-cell="true">
                    <label className="flex items-center justify-center cursor-pointer relative">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allOnCurrentPageSelected}
                        onChange={() => toggleSelectAllCurrentPage()}
                        onClick={(e) => e.stopPropagation()}
                        className="peer h-6 w-6 cursor-pointer transition-all appearance-none rounded bg-muted-100 shadow hover:shadow-md border border-muted-300 checked:bg-red-900 checked:border-red-900 indeterminate:bg-red-900 indeterminate:border-red-900"
                        aria-checked={selectAllAriaChecked}
                        aria-label={selectAllAriaLabel}
                      />
                      <span className="absolute text-white opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        {someOnCurrentPageSelected ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            className="w-5 h-5"
                            fill="currentColor"
                          >
                            <path d="M5.75 9.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5z" />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            className="w-6 h-6"
                            fill="currentColor"
                          >
                            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94z" />
                          </svg>
                        )}
                      </span>
                    </label>
                  </TableHead>
                  <TableHead className="p-4 font-mono text-xs font-bold">
                    Video ID
                  </TableHead>
                  <TableHead className="p-4 font-bold">Description</TableHead>
                  <TableHead
                    onClick={() => handleSort("uploadDate")}
                    className="cursor-pointer hover:bg-muted/90 p-4 font-bold"
                  >
                    Uploaded{renderSortIcon("uploadDate")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const totalRows = 10;

                  if (videosLoading) {
                    return Array.from({ length: totalRows }).map((_, index) => (
                      <TableRow
                        key={`skeleton-${index}`}
                        className="border-border/50 h-14.25"
                      >
                        <TableCell className="p-4">
                          <Skeleton className="h-4 w-4 rounded-sm" />
                        </TableCell>
                        <TableCell className="p-4">
                          <Skeleton className="h-5 w-20" />
                        </TableCell>
                        <TableCell className="p-4">
                          <Skeleton className="h-5 w-48" />
                        </TableCell>
                        <TableCell className="p-4">
                          <Skeleton className="h-5 w-24" />
                        </TableCell>
                      </TableRow>
                    ));
                  }

                  if (videos.length === 0) {
                    return (
                      <>
                        <TableRow className="hover:bg-muted/30 border-border/50 h-14.25">
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground"
                          >
                            No videos found
                          </TableCell>
                        </TableRow>
                        {Array.from({ length: totalRows - 1 }).map(
                          (_, index) => (
                            <TableRow
                              key={`empty-no-data-${index}`}
                              className="border-border/50 h-14.25"
                            >
                              <TableCell className="p-4"></TableCell>
                              <TableCell className="p-4"></TableCell>
                              <TableCell className="p-4"></TableCell>
                              <TableCell className="p-4"></TableCell>
                            </TableRow>
                          ),
                        )}
                      </>
                    );
                  }

                  const emptyRowsCount = Math.max(0, totalRows - videos.length);

                  return (
                    <>
                      {videos.map((video) => (
                        <TableRow
                          key={video.id}
                          className={cn(
                            "hover:bg-muted/20 border-border/50 cursor-pointer",
                            selectedVideoId === video.id ? "bg-muted/30" : "",
                          )}
                          onClick={(event) => handleRowClick(event, video)}
                        >
                          <TableCell className="p-4" data-checkbox-cell="true">
                            <label className="flex items-center cursor-pointer relative">
                              <input
                                type="checkbox"
                                checked={selectedVideoIds.has(video.id)}
                                onChange={() => toggleVideoSelection(video.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="peer h-6 w-6 cursor-pointer transition-all appearance-none rounded bg-muted-100 shadow hover:shadow-md border border-muted-300 checked:bg-red-900 checked:border-red-900 pointer-events-auto"
                              />
                              <span className="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  className="w-6 h-6"
                                  fill="currentColor"
                                >
                                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94z" />
                                </svg>
                              </span>
                            </label>
                          </TableCell>
                          <TableCell className="font-mono text-xs p-4 truncate max-w-40">
                            {video.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground p-4 truncate max-w-xs">
                            {video.description || "—"}
                          </TableCell>
                          <TableCell className="text-sm p-4">
                            {video.upload_date
                              ? new Date(video.upload_date).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {Array.from({ length: emptyRowsCount }).map(
                        (_, index) => (
                          <TableRow
                            key={`empty-${index}`}
                            className="border-border/50 h-14.25"
                          >
                            <TableCell className="p-4"></TableCell>
                            <TableCell className="p-4"></TableCell>
                            <TableCell className="p-4"></TableCell>
                            <TableCell className="p-4"></TableCell>
                          </TableRow>
                        ),
                      )}
                    </>
                  );
                })()}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Showing {videos.length} of {totalElements} videos
            </div>
            {hasInvalidDateRange ? (
              <div className="text-sm text-red-500">
                Start date must be before or equal to end date.
              </div>
            ) : null}

            <nav className="flex items-center gap-x-1" aria-label="Pagination">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={videosLoading || pageNumber === 0}
                className="cursor-pointer min-h-9.5 min-w-9.5 py-2 px-2.5 inline-flex justify-center items-center gap-x-2 text-sm rounded-lg text-gray-800 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-700 focus:outline-hidden focus:bg-gray-100 dark:focus:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none"
                aria-label="Previous"
              >
                <svg
                  className="shrink-0 size-3.5"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <span className="sr-only">Previous</span>
              </button>
              <div className="flex items-center gap-x-1">
                <span className="min-h-9.5 min-w-9.5 flex justify-center items-center border border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-200 py-2 px-3 text-sm rounded-lg focus:outline-hidden disabled:opacity-50 disabled:pointer-events-none">
                  {pageNumber + 1}
                </span>
                <span className="min-h-9.5 flex justify-center items-center text-gray-500 dark:text-neutral-400 py-2 px-1.5 text-sm">
                  of
                </span>
                <span className="min-h-9.5 flex justify-center items-center text-gray-500 dark:text-neutral-400 py-2 px-1.5 text-sm">
                  {totalPages}
                </span>
              </div>
              <button
                type="button"
                onClick={handleNext}
                disabled={videosLoading || pageNumber >= totalPages - 1}
                className="cursor-pointer min-h-9.5 min-w-9.5 py-2 px-2.5 inline-flex justify-center items-center gap-x-2 text-sm rounded-lg text-gray-800 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-700 focus:outline-hidden focus:bg-gray-100 dark:focus:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none"
                aria-label="Next"
              >
                <span className="sr-only">Next</span>
                <svg
                  className="shrink-0 size-3.5"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </nav>
          </div>
        </CardContent>
      </Card>

      {isDeleteModalOpen ? (
        <DeleteVideosComponent
          open={isDeleteModalOpen}
          selectedCount={selectedVideoIds.size}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      <SettingsWindow
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
