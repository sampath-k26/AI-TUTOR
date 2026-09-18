import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  createUserProfile: vi.fn(),
}));

const supabaseAdminMocks = vi.hoisted(() => ({
  createAuthUser: vi.fn(),
  SupabaseAdminError: class SupabaseAdminError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("../../src/modules/admin/repository", () => repoMocks);
vi.mock("../../src/core/supabaseAdmin", () => supabaseAdminMocks);

const service = await import("../../src/modules/admin/service");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createUser", () => {
  it("creates the auth user first, then the profile with the chosen role — never defaulting to 'user'", async () => {
    supabaseAdminMocks.createAuthUser.mockResolvedValue({ id: "auth-user-1" });
    repoMocks.createUserProfile.mockResolvedValue({ id: "auth-user-1", email: "new.admin@example.com", role: "admin" });

    const result = await service.createUser("new.admin@example.com", "a-strong-password", "admin");

    expect(supabaseAdminMocks.createAuthUser).toHaveBeenCalledWith("new.admin@example.com", "a-strong-password");
    expect(repoMocks.createUserProfile).toHaveBeenCalledWith("auth-user-1", "new.admin@example.com", "admin");
    expect(result).toEqual({ id: "auth-user-1", email: "new.admin@example.com", role: "admin" });
  });

  it("propagates a SupabaseAdminError (e.g. duplicate email) without creating a profile", async () => {
    supabaseAdminMocks.createAuthUser.mockRejectedValue(new supabaseAdminMocks.SupabaseAdminError("Email already registered", 409));

    await expect(service.createUser("dup@example.com", "password123", "user")).rejects.toThrow("Email already registered");
    expect(repoMocks.createUserProfile).not.toHaveBeenCalled();
  });
});
