import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withCache } from "../../src/core/cache";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withCache", () => {
  it("calls fn once and returns the cached value for a repeat call within the TTL", async () => {
    const fn = vi.fn().mockResolvedValue("value");
    await expect(withCache("key-a", 30_000, fn)).resolves.toBe("value");
    await expect(withCache("key-a", 30_000, fn)).resolves.toBe("value");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("re-invokes fn once the TTL has expired", async () => {
    const fn = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    await expect(withCache("key-b", 1_000, fn)).resolves.toBe("first");
    vi.advanceTimersByTime(1_001);
    await expect(withCache("key-b", 1_000, fn)).resolves.toBe("second");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never mixes results between different keys", async () => {
    const fnA = vi.fn().mockResolvedValue("a-value");
    const fnB = vi.fn().mockResolvedValue("b-value");
    await expect(withCache("key-c", 30_000, fnA)).resolves.toBe("a-value");
    await expect(withCache("key-d", 30_000, fnB)).resolves.toBe("b-value");
    expect(fnA).toHaveBeenCalledOnce();
    expect(fnB).toHaveBeenCalledOnce();
  });
});
