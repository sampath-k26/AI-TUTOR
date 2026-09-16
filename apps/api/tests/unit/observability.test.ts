import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })) }));
vi.mock("../../src/core/db", () => ({ db: dbMocks }));

const { generationMock, traceMock, LangfuseMock } = vi.hoisted(() => {
  const generationMock = vi.fn();
  const traceMock = vi.fn(() => ({ generation: generationMock }));
  const LangfuseMock = vi.fn().mockImplementation(function LangfuseCtor(this: { trace: typeof traceMock }) {
    this.trace = traceMock;
  });
  return { generationMock, traceMock, LangfuseMock };
});
vi.mock("langfuse", () => ({ Langfuse: LangfuseMock }));

const RECORD = {
  feature: "tutor" as const,
  provider: "gemini" as const,
  model: "gemini-3.6-flash",
  latencyMs: 500,
  tokensIn: 100,
  tokensOut: 50,
  success: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("logAiUsage — Langfuse not configured (no LANGFUSE_* env vars)", () => {
  it("writes to ai_usage_log and never touches the Langfuse SDK", async () => {
    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "");
    const { logAiUsage } = await import("../../src/core/observability");

    await logAiUsage(RECORD);

    expect(dbMocks.insert).toHaveBeenCalledOnce();
    expect(LangfuseMock).not.toHaveBeenCalled();
  });
});

describe("logAiUsage — Langfuse configured", () => {
  it("mirrors a successful call as a DEFAULT-level generation", async () => {
    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "pk-test");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "sk-test");
    const { logAiUsage } = await import("../../src/core/observability");

    await logAiUsage(RECORD);

    expect(dbMocks.insert).toHaveBeenCalledOnce();
    expect(traceMock).toHaveBeenCalledWith(expect.objectContaining({ name: "tutor" }));
    expect(generationMock).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-3.6-flash", level: "DEFAULT" }));
  });

  it("mirrors a failed call as an ERROR-level generation with the error detail", async () => {
    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "pk-test");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "sk-test");
    const { logAiUsage } = await import("../../src/core/observability");

    await logAiUsage({ ...RECORD, success: false, errorDetail: "quota exceeded" });

    expect(generationMock).toHaveBeenCalledWith(expect.objectContaining({ level: "ERROR", statusMessage: "quota exceeded" }));
  });

  it("never throws and still writes ai_usage_log even if the Langfuse SDK itself throws", async () => {
    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "pk-test");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "sk-test");
    traceMock.mockImplementationOnce(() => {
      throw new Error("langfuse unreachable");
    });
    const { logAiUsage } = await import("../../src/core/observability");

    await expect(logAiUsage(RECORD)).resolves.toBeUndefined();
    expect(dbMocks.insert).toHaveBeenCalledOnce();
  });
});
