import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const getClaimsMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getClaims: getClaimsMock } }),
}));

const dbMocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("../../src/core/db", () => ({ db: dbMocks }));

function mockProfileRoleQuery(rows: Array<{ role: string }>) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  dbMocks.select.mockReturnValue({ from });
}

const { requireAdmin, requireAuth } = await import("../../src/core/auth");

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

describe("requireAdmin", () => {
  beforeEach(() => {
    dbMocks.select.mockReset();
  });

  it("rejects when requireAuth hasn't run (no req.user)", async () => {
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(dbMocks.select).not.toHaveBeenCalled();
  });

  it("rejects a regular user (fails closed, not open, on a missing profile row)", async () => {
    mockProfileRoleQuery([]);
    const req = { user: { id: "user-1", email: "a@example.com" } } as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a user whose profile role is 'user'", async () => {
    mockProfileRoleQuery([{ role: "user" }]);
    const req = { user: { id: "user-1", email: "a@example.com" } } as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("admits a user whose profile role is 'admin'", async () => {
    mockProfileRoleQuery([{ role: "admin" }]);
    const req = { user: { id: "admin-1", email: "admin@example.com" } } as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
