import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withRetry } from "../../src/aiProvider/base";

function errorWithStatus(status: number, message = `HTTP ${status}`): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Advances fake timers while letting queued microtasks (the retried promise) flush. */
async function flushRetries(promise: Promise<unknown>) {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(60_000);
  }
  return promise;
}

describe("withRetry", () => {
  it("returns the result immediately on success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("retries on a 503 and eventually succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(errorWithStatus(503)).mockResolvedValueOnce("recovered");
    const result = await flushRetries(withRetry(fn));
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on a 429 rate-limit and eventually succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(errorWithStatus(429)).mockResolvedValueOnce("recovered");
    const result = await flushRetries(withRetry(fn));
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable 400 — fails on the first attempt", async () => {
    const fn = vi.fn().mockRejectedValue(errorWithStatus(400));
    await expect(withRetry(fn)).rejects.toThrow("HTTP 400");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("gives up after maxAttempts and throws the last error", async () => {
    const fn = vi.fn().mockRejectedValue(errorWithStatus(503));
    const promise = withRetry(fn, 3);
    promise.catch(() => {}); // attached immediately so fake-timer advancement below doesn't trip an unhandled-rejection warning
    await expect(flushRetries(promise)).rejects.toThrow("HTTP 503");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 429 that is a daily quota exhaustion — fails on the first attempt", async () => {
    const dailyQuotaError = errorWithStatus(
      429,
      '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}',
    );
    const fn = vi.fn().mockRejectedValue(dailyQuotaError);
    await expect(withRetry(fn)).rejects.toThrow(/PerDay/);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("retries a network-level error with no HTTP status", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("network timeout occurred")).mockResolvedValueOnce("recovered");
    const result = await flushRetries(withRetry(fn));
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
