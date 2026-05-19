import { defineTransformer } from "orval";

type SchemaObject = {
  properties?: Record<string, unknown>;
};

type ParameterObject = {
  name?: string;
  in?: string;
  required?: boolean;
  schema?: { $ref?: string } | Record<string, unknown>;
};

type OpenApiLike = Record<string, unknown> & {
  paths?: Record<string, Record<string, OperationObject>>;
  components?: {
    parameters?: Record<string, unknown>;
    schemas?: Record<string, unknown>;
  };
};

type OperationObject = {
  operationId?: string;
  tags?: string[];
  parameters?: unknown[];
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<string, { schema?: Record<string, unknown> }>;
    }
  >;
};

function resolveRef<T>(ref: string, spec: OpenApiLike): T | undefined {
  const parts = ref.split("/");
  const [, section, collection, key] = parts;

  if (section !== "components" || !collection || !key) {
    return undefined;
  }

  if (collection === "parameters") {
    return spec.components?.parameters?.[key] as T | undefined;
  }

  if (collection === "schemas") {
    return spec.components?.schemas?.[key] as T | undefined;
  }

  return undefined;
}

function resolveParameter(parameter: unknown, spec: OpenApiLike): ParameterObject | undefined {
  if (!parameter || typeof parameter !== "object") {
    return undefined;
  }

  const withRef = parameter as { $ref?: string };
  if (withRef.$ref) {
    return resolveRef<ParameterObject>(withRef.$ref, spec);
  }

  return parameter as ParameterObject;
}

function resolveSchema(
  schema: ParameterObject["schema"],
  spec: OpenApiLike,
): SchemaObject | undefined {
  if (!schema || typeof schema !== "object") {
    return undefined;
  }

  const withRef = schema as { $ref?: string };
  if (withRef.$ref) {
    return resolveRef<SchemaObject>(withRef.$ref, spec);
  }

  return schema as SchemaObject;
}

function getPropertySchema(
  schema: SchemaObject | undefined,
  key: string,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const value = schema?.properties?.[key];
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return fallback;
}

function flattenPageableQuery(operation: OperationObject, spec: OpenApiLike) {
  if (!operation.parameters?.length) {
    return;
  }

  const resolvedParameters = operation.parameters
    .map((parameter) => ({
      original: parameter,
      resolved: resolveParameter(parameter, spec),
    }))
    .filter((item) => item.resolved);

  const pageableEntry = resolvedParameters.find(
    ({ resolved }) => resolved?.in === "query" && resolved?.name?.toLowerCase() === "pageable",
  );

  if (!pageableEntry?.resolved) {
    return;
  }

  const pageableSchema = resolveSchema(pageableEntry.resolved.schema, spec);

  const pageSchema = getPropertySchema(pageableSchema, "page", {
    type: "integer",
    minimum: 0,
  });
  const sizeSchema = getPropertySchema(pageableSchema, "size", {
    type: "integer",
    minimum: 1,
  });
  const sortSchema = getPropertySchema(pageableSchema, "sort", {
    type: "array",
    items: { type: "string" },
  });

  operation.parameters = operation.parameters.filter(
    (parameter) => parameter !== pageableEntry.original,
  );

  operation.parameters.unshift(
    {
      in: "query",
      name: "sort",
      required: false,
      schema: sortSchema,
    },
    {
      in: "query",
      name: "size",
      required: false,
      schema: sizeSchema,
    },
    {
      in: "query",
      name: "page",
      required: false,
      schema: pageSchema,
    },
  );
}

function patchSequenceSchemas(spec: OpenApiLike) {
  if (!spec.components) {
    spec.components = {};
  }

  if (!spec.components.schemas) {
    spec.components.schemas = {};
  }

  spec.components.schemas.VideoSequencePart = {
    type: "object",
    properties: {
      id: {
        type: "string",
        format: "uuid",
      },
      name: {
        type: "string",
      },
      description: {
        type: "string",
        nullable: true,
      },
      upload_date: {
        type: "string",
        format: "date-time",
      },
      continuation_of: {
        type: "string",
        format: "uuid",
        nullable: true,
      },
    },
    required: ["id", "name", "upload_date"],
  };

  spec.components.schemas.VideoSequence = {
    type: "object",
    properties: {
      origin_id: {
        type: "string",
        format: "uuid",
      },
      sequence_upload_date: {
        type: "string",
        format: "date-time",
      },
      parts: {
        type: "array",
        items: {
          $ref: "#/components/schemas/VideoSequencePart",
        },
      },
    },
    required: ["origin_id", "sequence_upload_date", "parts"],
  };

  spec.components.schemas.VideoSequencePage = {
    type: "object",
    properties: {
      content: {
        type: "array",
        items: {
          $ref: "#/components/schemas/VideoSequence",
        },
      },
      page: {
        type: "object",
        properties: {
          size: {
            type: "integer",
          },
          number: {
            type: "integer",
          },
          totalElements: {
            type: "integer",
          },
          totalPages: {
            type: "integer",
          },
        },
        required: ["size", "number", "totalElements", "totalPages"],
      },
    },
    required: ["content", "page"],
  };

  const sequencesGet = spec.paths?.["/videos/sequences"]?.get;
  if (sequencesGet?.responses?.["200"]) {
    sequencesGet.responses["200"] = {
      ...sequencesGet.responses["200"],
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/VideoSequencePage" },
        },
      },
    };
  }

  const sequenceGet = spec.paths?.["/videos/sequences/{originId}"]?.get;
  if (sequenceGet?.responses?.["200"]) {
    sequenceGet.responses["200"] = {
      ...sequenceGet.responses["200"],
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/VideoSequence" },
        },
      },
    };
  }

  if (!spec.paths) {
    spec.paths = {};
  }

  const videoDashManifest = spec.paths["/videos/{fileIdentifier}/manifest.mpd"]?.get;
  if (!videoDashManifest) {
    spec.paths["/videos/{fileIdentifier}/manifest.mpd"] = {
      get: {
        operationId: "getVideoDashManifest",
        tags: ["Media Controller"],
        parameters: [
          {
            name: "fileIdentifier",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "DASH manifest",
            content: {
              "application/dash+xml": {
                schema: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    };
  }

  const videoSequenceDashManifest = spec.paths["/videos/sequences/{originId}/manifest.mpd"]?.get;
  if (!videoSequenceDashManifest) {
    spec.paths["/videos/sequences/{originId}/manifest.mpd"] = {
      get: {
        operationId: "getVideoSequenceDashManifest",
        tags: ["Media Controller"],
        parameters: [
          {
            name: "originId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "DASH sequence manifest",
            content: {
              "application/dash+xml": {
                schema: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    };
  }

  const videoDashAsset = spec.paths["/videos/{fileIdentifier}/dash/{assetPath}"]?.get;
  if (!videoDashAsset) {
    spec.paths["/videos/{fileIdentifier}/dash/{assetPath}"] = {
      get: {
        operationId: "getVideoDashAsset",
        tags: ["Media Controller"],
        parameters: [
          {
            name: "fileIdentifier",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
          {
            name: "assetPath",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "DASH asset",
            content: {
              "application/octet-stream": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
        },
      },
    };
  }

  const sequenceDashAsset = spec.paths["/videos/sequences/{originId}/dash/{videoId}/{assetPath}"]?.get;
  if (!sequenceDashAsset) {
    spec.paths["/videos/sequences/{originId}/dash/{videoId}/{assetPath}"] = {
      get: {
        operationId: "getSequenceDashAsset",
        tags: ["Media Controller"],
        parameters: [
          {
            name: "originId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
          {
            name: "videoId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
          {
            name: "assetPath",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "DASH sequence asset",
            content: {
              "application/octet-stream": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
        },
      },
    };
  }
}

export default defineTransformer((openApi) => {
  const spec = structuredClone(openApi) as OpenApiLike;
  const getVideos = spec.paths?.["/videos"]?.get;
  if (getVideos) {
    flattenPageableQuery(getVideos, spec);
  }

  const getVideoSequences = spec.paths?.["/videos/sequences"]?.get;
  if (getVideoSequences) {
    flattenPageableQuery(getVideoSequences, spec);
  }

  patchSequenceSchemas(spec);

  return spec as typeof openApi;
});
