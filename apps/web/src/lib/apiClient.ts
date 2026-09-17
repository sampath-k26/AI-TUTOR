import { supabase } from "./supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function buildAuthHeaders(isFormData: boolean, extra?: HeadersInit): Promise<Headers> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(extra);
  // Let the browser set Content-Type (with the multipart boundary) for FormData bodies.
  if (!isFormData) headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit, isFormData = false): Promise<T> {
  const headers = await buildAuthHeaders(isFormData, init?.headers);
  const response = await fetch(`${API_BASE_URL}/api${path}`, { ...init, headers });
  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(`Request to ${path} failed with ${response.status}`, response.status, body);
  }

  return body as T;
}

/**
 * Consumes a newline-delimited-JSON streaming response (M9's Tutor endpoint) —
 * can't reuse request(), which always awaits a single full response.json(). Not
 * native EventSource: this app authenticates with a Bearer header and sends a
 * JSON body, neither of which EventSource supports.
 */
async function postStream<TEvent>(path: string, data: unknown, onEvent: (event: TEvent) => void): Promise<void> {
  const headers = await buildAuthHeaders(false);
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => undefined);
    throw new ApiError(`Request to ${path} failed with ${response.status}`, response.status, body);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line) as TEvent);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as TEvent);
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  postForm: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData }, true),
  postStream,
};
