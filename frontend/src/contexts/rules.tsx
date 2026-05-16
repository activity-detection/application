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
  addDetectionTemplate,
  deleteDetectionTemplate,
  editDetectionTemplate,
  getDetectedElements,
  getDetectionTemplates,
} from "@/lib/endpoints/detection-rules-controller/detection-rules-controller";
import type { DetectionVectorDTO } from "@/models";

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

type RulesContextValue = {
  templates: DetectionTemplateItem[];
  detectedElements: string[];
  loading: boolean;
  elementsLoading: boolean;
  saving: boolean;
  error: string | null;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;
  loadRulesPage: (page: number) => Promise<void>;
  loadDetectedElements: () => Promise<void>;
  createTemplate: (payload: {
    name: string;
    vectors: DetectionVectorDTO[];
  }) => Promise<void>;
  updateTemplate: (payload: {
    name: string;
    new_name?: string;
    vectors: DetectionVectorDTO[];
  }) => Promise<void>;
  removeTemplate: (name: string) => Promise<void>;
};

const RulesContext = createContext<RulesContextValue | undefined>(undefined);

export function RulesProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<DetectionTemplateItem[]>([]);
  const [detectedElements, setDetectedElements] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [elementsLoading, setElementsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize] = useState(8);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const loadDetectedElements = useCallback(async () => {
    try {
      setElementsLoading(true);
      setError(null);

      const response = (await getDetectedElements()) as unknown;
      let nextElements: string[] = [];

      if (Array.isArray(response)) {
        nextElements = response
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
      } else if (
        response &&
        typeof response === "object" &&
        "data" in response &&
        (response as { data?: unknown }).data instanceof Blob
      ) {
        const rawText = await (response as { data: Blob }).data.text();
        const parsed = JSON.parse(rawText) as unknown;
        if (Array.isArray(parsed)) {
          nextElements = parsed
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
      }

      setDetectedElements(Array.from(new Set(nextElements)));
    } catch (err) {
      setDetectedElements([]);
      setError(
        err instanceof Error ? err.message : "Error loading detected elements",
      );
    } finally {
      setElementsLoading(false);
    }
  }, []);

  const loadRulesPage = useCallback(
    async (page: number) => {
      try {
        setLoading(true);
        setError(null);

        const [response] = await Promise.all([
          getDetectionTemplates({ page, size: pageSize }),
          new Promise((resolve) => setTimeout(resolve, 100)),
        ]);

        if (!response || typeof response !== "object") {
          throw new Error("Invalid response from API");
        }

        const data = response as unknown as DetectionTemplatesPage;
        setTemplates(data.content ?? []);
        setPageNumber(data.page?.number ?? page);
        setTotalPages(data.page?.totalPages ?? 0);
        setTotalElements(data.page?.totalElements ?? 0);
      } catch (err) {
        setTemplates([]);
        setError(err instanceof Error ? err.message : "Error loading rules");
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  const createTemplate = useCallback(
    async (payload: { name: string; vectors: DetectionVectorDTO[] }) => {
      try {
        setSaving(true);
        setError(null);
        await addDetectionTemplate(payload);
        await loadRulesPage(pageNumber);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error creating template",
        );
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [loadRulesPage, pageNumber],
  );

  const updateTemplate = useCallback(
    async (payload: {
      name: string;
      new_name?: string;
      vectors: DetectionVectorDTO[];
    }) => {
      try {
        setSaving(true);
        setError(null);
        await editDetectionTemplate(payload);
        await loadRulesPage(pageNumber);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error updating template",
        );
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [loadRulesPage, pageNumber],
  );

  const removeTemplate = useCallback(
    async (name: string) => {
      try {
        setSaving(true);
        setError(null);
        await deleteDetectionTemplate({ name });

        const nextPage =
          templates.length === 1 && pageNumber > 0
            ? pageNumber - 1
            : pageNumber;
        await loadRulesPage(nextPage);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error deleting template",
        );
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [loadRulesPage, pageNumber, templates.length],
  );

  const value = useMemo<RulesContextValue>(
    () => ({
      templates,
      detectedElements,
      loading,
      elementsLoading,
      saving,
      error,
      pageNumber,
      pageSize,
      totalPages,
      totalElements,
      loadRulesPage,
      loadDetectedElements,
      createTemplate,
      updateTemplate,
      removeTemplate,
    }),
    [
      templates,
      detectedElements,
      loading,
      elementsLoading,
      saving,
      error,
      pageNumber,
      pageSize,
      totalPages,
      totalElements,
      loadRulesPage,
      loadDetectedElements,
      createTemplate,
      updateTemplate,
      removeTemplate,
    ],
  );

  return (
    <RulesContext.Provider value={value}>{children}</RulesContext.Provider>
  );
}

export function useRules() {
  const context = useContext(RulesContext);
  if (!context) {
    throw new Error("useRules must be used within RulesProvider");
  }
  return context;
}
