"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ZoneDrawer, type ZoneDraft } from "@/features/forbidden-zones/components/zone-drawer";
import {
  ZONES_QUERY_KEY,
  useCreateZone,
  useDeleteZone,
  useForbiddenZones,
} from "@/features/forbidden-zones/hooks/use-forbidden-zones";

export function ForbiddenAreasPanel() {
  const queryClient = useQueryClient();
  const { data: zones = [], isLoading, error } = useForbiddenZones();
  const createMutation = useCreateZone();
  const deleteMutation = useDeleteZone();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ZONES_QUERY_KEY });

  const handleSave = async (draft: ZoneDraft) => {
    try {
      await createMutation.mutateAsync({
        name: draft.name,
        points: draft.points,
        reference_video_id: draft.reference_video_id,
        aspect_ratio: draft.aspect_ratio,
      });
      setDrawerOpen(false);
      await refresh();
    } catch (err) {
      console.error("Failed to create forbidden area:", err);
    }
  };

  const handleDelete = async (id?: number) => {
    if (id == null) return;
    try {
      await deleteMutation.mutateAsync(id);
      await refresh();
    } catch (err) {
      console.error("Failed to delete forbidden area:", err);
    }
  };

  const totalRows = 8;
  const emptyRowsCount = Math.max(0, totalRows - zones.length);

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Areas where a person entering triggers a recording. Applied live to the detector.
        </p>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14m-7-7h14" />
          </svg>
          New Forbidden Area
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
          {error instanceof Error ? error.message : "Failed to load forbidden areas"}
        </div>
      ) : null}

      <div className="border-border/50 h-124 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/70 border-border/50">
              <TableHead className="p-4 font-bold">Name</TableHead>
              <TableHead className="w-24 p-4 text-center font-bold">Points</TableHead>
              <TableHead className="w-28 p-4 text-center font-bold">Policy</TableHead>
              <TableHead className="w-24 p-4 text-center font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: totalRows }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`} className="border-border/50 h-14.25">
                    <TableCell className="p-4">
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell className="p-4">
                      <Skeleton className="mx-auto h-5 w-8" />
                    </TableCell>
                    <TableCell className="p-4">
                      <Skeleton className="mx-auto h-5 w-16" />
                    </TableCell>
                    <TableCell className="p-4">
                      <Skeleton className="mx-auto h-5 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              : null}

            {!isLoading && zones.length === 0 ? (
              <>
                <TableRow className="hover:bg-muted/30 border-border/50 h-14.25">
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    No forbidden areas defined
                  </TableCell>
                </TableRow>
                {Array.from({ length: totalRows - 1 }).map((_, index) => (
                  <TableRow key={`empty-no-data-${index}`} className="border-border/50 h-14.25">
                    <TableCell className="p-4" />
                    <TableCell className="p-4" />
                    <TableCell className="p-4" />
                    <TableCell className="p-4" />
                  </TableRow>
                ))}
              </>
            ) : null}

            {!isLoading && zones.length > 0 ? (
              <>
                {zones.map((zone) => (
                  <TableRow key={zone.id} className="hover:bg-muted/20 border-border/50 h-14.25">
                    <TableCell className="p-4 text-sm font-medium">{zone.name}</TableCell>
                    <TableCell className="text-muted-foreground p-4 text-center text-sm">
                      {zone.points?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-muted-foreground p-4 text-center text-sm">
                      {zone.policy ?? "forbidden"}
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => void handleDelete(zone.id)}
                          disabled={deleteMutation.isPending}
                          className="text-muted-foreground cursor-pointer rounded p-1.5 transition-colors hover:bg-red-900/20 hover:text-red-400 disabled:pointer-events-none disabled:opacity-50"
                          aria-label={`Delete ${zone.name}`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48 48 0 0 0-3.478-.397m-12 .562q.51-.088 1.022-.165m0 0a48 48 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a52 52 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a49 49 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {Array.from({ length: emptyRowsCount }).map((_, index) => (
                  <TableRow key={`empty-${index}`} className="border-border/50 h-14.25">
                    <TableCell className="p-4" />
                    <TableCell className="p-4" />
                    <TableCell className="p-4" />
                    <TableCell className="p-4" />
                  </TableRow>
                ))}
              </>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {drawerOpen && (
        <ZoneDrawer
          saving={createMutation.isPending}
          onSave={(draft) => void handleSave(draft)}
          onCancel={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}
