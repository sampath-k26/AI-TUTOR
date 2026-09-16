import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/supabaseClient", () => ({
  supabase: { auth: { getSession: getSessionMock } },
}));

const { apiClient, ApiError } = await import("../../src/lib/apiClient");

const originalFetch = globalThis.fetch;

beforeEach(() => {
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: null } });
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("apiClient", () => {
  it("attaches the session's access token as a Bearer header when one exists", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "real-token" } } });
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await apiClient.get("/me");

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer real-token");
  });

  it("sends no Authorization header when there is no session", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await apiClient.get("/spaces");

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("throws ApiError with the status and parsed body on a non-ok response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ error: "Project not found" }), { status: 404 }));

    await expect(apiClient.get("/projects/does-not-exist")).rejects.toMatchObject({
      status: 404,
      body: { error: "Project not found" },
    });
    await expect(apiClient.get("/projects/does-not-exist")).rejects.toBeInstanceOf(ApiError);
  });

  it("does not set Content-Type for FormData bodies (lets the browser set the multipart boundary)", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await apiClient.postForm("/projects/proj-1/materials", new FormData());

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.has("Content-Type")).toBe(false);
  });
});
