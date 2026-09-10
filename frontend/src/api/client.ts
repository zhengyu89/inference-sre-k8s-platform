// Thin fetch wrapper: base path, JSON handling, error normalisation.
// No bare `fetch` calls belong outside this file — see CLAUDE.md conventions.

import type { ApiError } from "./types";

const API_BASE = "/api/v1";

export class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>;

function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
  );
  if (entries.length === 0) return "";
  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    search.set(key, String(value));
  }
  return `?${search.toString()}`;
}

async function request<T>(path: string, init?: RequestInit, params?: QueryParams): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${buildQuery(params)}`, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiRequestError("Could not reach the platform API", "network_error", 0);
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    let code = "unknown_error";
    try {
      const body = (await res.json()) as ApiError;
      if (body?.error) {
        message = body.error.message ?? message;
        code = body.error.code ?? code;
      }
    } catch {
      // response wasn't JSON (or had no body) — fall back to the status text
    }
    throw new ApiRequestError(message, code, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const apiClient = {
  get<T>(path: string, params?: QueryParams): Promise<T> {
    return request<T>(path, { method: "GET" }, params);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
};
