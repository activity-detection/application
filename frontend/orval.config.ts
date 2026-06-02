import { defineConfig } from "orval";

const sharedInput = {
  target: "http://localhost:8080/v3/api-docs",
  override: {
    transformer: "./orval.transformer.ts",
  },
} as const;

const sharedOutput = {
  client: "react-query",
  httpClient: "axios",
  namingConvention: "kebab-case",
  schemas: "./src/types/api",
  mock: {
    type: "msw",
    useExamples: true,
  },
  prettier: true,
  override: {
    mutator: {
      path: "./src/lib/orval-axios.ts",
      name: "orvalAxiosInstance",
    },
    query: {
      useQuery: true,
      useMutation: true,
      useInfinite: true,
      signal: true,
      shouldExportQueryKey: true,
      useOperationIdAsQueryKey: true,
    },
  },
} as const;

export default defineConfig({
  detectionRulesApi: {
    input: {
      ...sharedInput,
      filters: {
        mode: "include",
        tags: ["detection-rules-controller"],
      },
    },
    output: {
      ...sharedOutput,
      mode: "split",
      target: "./src/features/detection-rules/api",
      clean: true,
    },
  },
  mediaApi: {
    input: {
      ...sharedInput,
      filters: {
        mode: "include",
        tags: ["media-controller"],
      },
    },
    output: {
      ...sharedOutput,
      mode: "split",
      target: "./src/features/detection-explorer/api",
      clean: false,
    },
  },
  forbiddenZonesApi: {
    input: {
      ...sharedInput,
      filters: {
        mode: "include",
        tags: ["forbidden-zones-controller"],
      },
    },
    output: {
      ...sharedOutput,
      mode: "split",
      target: "./src/features/forbidden-zones/api",
      // clean must stay false: this config runs last and `schemas` points at the
      // shared ./src/types/api folder, so cleaning would wipe the media/rules
      // schema types the earlier configs generated.
      clean: false,
    },
  },
});
