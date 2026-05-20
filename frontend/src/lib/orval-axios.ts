import Axios, { AxiosError, type AxiosRequestConfig } from "axios";

import { getApiBaseUrl } from "@/lib/client";

export const orvalAxiosInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const headers = { ...(config.headers ?? {}) };
  const requestMethod = (config.method ?? "get").toLowerCase();

  if (requestMethod === "get" && typeof config.url === "string") {
    const isMediaFileEndpoint = /^\/videos\/[^/?#]+$/.test(config.url);
    if (isMediaFileEndpoint && !("Range" in headers) && !("range" in headers)) {
      headers.Range = "bytes=0-";
    }
  }

  return Axios({
    ...config,
    ...options,
    baseURL: getApiBaseUrl(),
    headers,
  }).then(({ data }) => data);
};

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
