/**
 * In-process, TTL-only cache (decision D18) — no Redis, matching this project's
 * Postgres-native precedent (A3/D13). Per-process and cold after every
 * deploy/restart; acceptable at prototype/single-instance scale.
 *
 * Every project/owner-scoped cache key MUST embed that scoping ID (e.g.
 * `analytics:eventCounts:${projectId}`) — omitting it would let one caller's
 * cached result leak to another, contradicting D16's isolation guarantee.
 * Platform-wide admin queries (gated entirely by requireAdmin) may use a fixed key.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export async function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = store.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const value = await fn();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}
