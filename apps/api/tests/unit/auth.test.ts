import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const getClaimsMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getClaims: getClaimsMock } }),
}));

const { requireAuth } = await import("../../src/core/auth");

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  getClaimsMock.mockReset();
});

describe("requireAuth", () => {
  it("rejects a request with no Authorization header", async () => {
    const req = { headers: {} } as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(getClaimsMock).not.toHaveBeenCalled();
  });

  it("rejects a request with a malformed Authorization header", async () => {
    const req = { headers: { authorization: "Basic abc123" } } as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a token that fails verification (invalid/expired/bad signature)", async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: { message: "invalid signature" } });
    const req = { headers: { authorization: "Bearer not-a-real-token" } } as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a validly-signed token and attaches req.user from the verified claims", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-123", email: "a@example.com" } }, error: null });
    const req = { headers: { authorization: "Bearer a-real-token" } } as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ id: "user-123", email: "a@example.com" });
  });

  it("defaults email to an empty string when the claim is absent", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-456" } }, error: null });
    const req = { headers: { authorization: "Bearer a-real-token" } } as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(req.user).toEqual({ id: "user-456", email: "" });
  });
});
