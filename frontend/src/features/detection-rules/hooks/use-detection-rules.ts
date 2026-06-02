import { useMutation, useQuery } from "@tanstack/react-query";

import {
  addDetectionTemplate,
  deleteDetectionTemplate,
  editDetectionTemplate,
  getDetectedElements,
  getDetectionTemplates,
} from "@/features/detection-rules/api/openapi-definition";
import type { DetectionVectorDTO } from "@/types/api";

export type DetectionTemplateItem = {
  name: string;
  vector_count: number;
  vectors: {
    vector_id?: number;
    rules: {
      element_name: string;
      count?: number;
      count_from?: number;
      count_to?: number;
      range?: boolean;
    }[];
  }[];
};

type DetectionElementItem = {
  id?: number;
  name: string;
};

type DetectionTemplatesPage = {
  content: DetectionTemplateItem[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
};

const RULES_QUERY_KEY = ["detection-rules"];
const ELEMENTS_QUERY_KEY = ["detected-elements"];

export function useDetectionTemplates(page: number, pageSize: number = 8) {
  const queryKey = [...RULES_QUERY_KEY, page, pageSize];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = (await getDetectionTemplates({ page, size: pageSize })) as unknown;
      if (response instanceof Blob) {
        const rawText = await response.text();
        const parsed = JSON.parse(rawText) as unknown;
        if (
          parsed &&
          typeof parsed === "object" &&
          "content" in parsed &&
          Array.isArray((parsed as DetectionTemplatesPage).content)
        ) {
          return parsed as DetectionTemplatesPage;
        }
      }

      if (!response || typeof response !== "object") {
        throw new Error("Invalid response from API");
      }

      const data = response as unknown as DetectionTemplatesPage;

      if (!Array.isArray(data.content)) {
        throw new Error("Invalid response from API");
      }

      return data;
    },
  });
}

function extractElementNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (
        item &&
        typeof item === "object" &&
        "name" in item &&
        typeof (item as DetectionElementItem).name === "string"
      ) {
        return (item as DetectionElementItem).name;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

export function useDetectedElements() {
  return useQuery({
    queryKey: ELEMENTS_QUERY_KEY,
    queryFn: async () => {
      const response = (await getDetectedElements()) as unknown;
      let nextElements: string[] = [];

      // The orval mutator returns response.data directly, so a blob endpoint
      // resolves to a bare Blob. Older paths returned an array or { data: Blob }.
      const blob =
        response instanceof Blob
          ? response
          : response &&
              typeof response === "object" &&
              "data" in response &&
              (response as { data?: unknown }).data instanceof Blob
            ? (response as { data: Blob }).data
            : null;

      if (Array.isArray(response)) {
        nextElements = extractElementNames(response);
      } else if (blob) {
        const parsed = JSON.parse(await blob.text()) as unknown;
        nextElements = extractElementNames(parsed);
      }

      return Array.from(new Set(nextElements));
    },
  });
}

export function useCreateTemplate() {
  return useMutation({
    mutationFn: (payload: { name: string; vectors: DetectionVectorDTO[] }) =>
      addDetectionTemplate(payload),
  });
}

export function useUpdateTemplate() {
  return useMutation({
    mutationFn: (payload: {
      name: string;
      new_name?: string;
      vectors: DetectionVectorDTO[];
    }) => editDetectionTemplate(payload),
  });
}

export function useDeleteTemplate() {
  return useMutation({
    mutationFn: (name: string) => deleteDetectionTemplate({ name }),
  });
}
