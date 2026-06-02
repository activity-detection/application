import { useMutation, useQuery } from "@tanstack/react-query";

import {
  createZone,
  deleteZone,
  getZones,
  updateZone,
} from "@/features/forbidden-zones/api/openapi-definition";
import type { ForbiddenZoneDTO, ForbiddenZoneRequest } from "@/types/api";

export const ZONES_QUERY_KEY = ["forbidden-zones"];

// The backend returns ResponseEntity, which springdoc exposes as `*/*`, so orval
// types the body as Blob (same pattern as the detection-rules client). Normalize
// it back to JSON here.
async function parseZones(response: unknown): Promise<ForbiddenZoneDTO[]> {
  let value: unknown = response;
  if (value instanceof Blob) {
    value = JSON.parse(await value.text());
  } else if (value && typeof value === "object" && "data" in value) {
    const inner = (value as { data: unknown }).data;
    value = inner instanceof Blob ? JSON.parse(await inner.text()) : inner;
  }
  return Array.isArray(value) ? (value as ForbiddenZoneDTO[]) : [];
}

export function useForbiddenZones() {
  return useQuery({
    queryKey: ZONES_QUERY_KEY,
    queryFn: async () => parseZones(await getZones()),
  });
}

export function useCreateZone() {
  return useMutation({
    mutationFn: (payload: ForbiddenZoneRequest) => createZone(payload),
  });
}

export function useUpdateZone() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ForbiddenZoneRequest }) =>
      updateZone(id, payload),
  });
}

export function useDeleteZone() {
  return useMutation({
    mutationFn: (id: number) => deleteZone(id),
  });
}
