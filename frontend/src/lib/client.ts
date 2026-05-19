export const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_BASE_URL && process.env.NEXT_PUBLIC_API_BASE_URL.trim() !== "") {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }

  // When running in browser, derive base from current origin and use /api prefix
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return `${window.location.origin.replace(/\/$/, "")}/api`;
  }

  // Fallback for server-side or tests
  return "http://localhost:8080";
};

export const client = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const baseURL = getApiBaseUrl();

  const method = options.method || "GET";
  const headers = new Headers(options.headers);

  if (!["GET", "HEAD", "DELETE"].includes(method)) {
    headers.set("Content-Type", "application/json");
  }

  const isMediaFileEndpoint = /^\/videos\/[^/?#]+$/.test(url);
  if (method === "GET" && isMediaFileEndpoint && !headers.has("Range")) {
    headers.set("Range", "bytes=0-");
  }

  const response = await fetch(`${baseURL}${url}`, {
    ...options,
    method,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return null as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (
    contentType.includes("video/") ||
    contentType.includes("image/") ||
    contentType.includes("application/octet-stream")
  ) {
    const blob = await response.blob();
    return {
      data: blob,
      status: response.status,
      headers: response.headers,
    } as T;
  }

  return response.json();
};
