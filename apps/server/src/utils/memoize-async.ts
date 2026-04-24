/**
 * Tiny in-process async memoizer with TTL + single-flight.
 *
 * Purpose: protect expensive read endpoints (reference data served to SSR/ISR
 * clients) from cache stampedes when the frontend HTTP cache expires. Without
 * this, every revalidation of /teams and /skills fans out into simultaneous
 * Prisma queries with deep include chains.
 *
 * - TTL-based: entries expire after `ttlMs`.
 * - Single-flight: concurrent callers for the same key share one promise.
 * - Failures are not cached: the failed promise is removed from the in-flight
 *   map so the next caller retries.
 * - Namespaces allow surgical invalidation after admin reseeds.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const caches = new Map<string, Map<string, CacheEntry<unknown>>>();
const inflight = new Map<string, Promise<unknown>>();

function getStore(namespace: string): Map<string, CacheEntry<unknown>> {
  let store = caches.get(namespace);
  if (!store) {
    store = new Map();
    caches.set(namespace, store);
  }
  return store;
}

export async function memoizeAsync<T>(
  namespace: string,
  key: string,
  ttlMs: number,
  producer: () => Promise<T>,
): Promise<T> {
  const store = getStore(namespace);
  const entry = store.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value as T;
  }

  const fullKey = `${namespace}::${key}`;
  const existing = inflight.get(fullKey);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    const value = await producer();
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  })();

  inflight.set(fullKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(fullKey);
  }
}

export function invalidateMemoNamespace(namespace: string): void {
  caches.get(namespace)?.clear();
}

export function invalidateAllMemo(): void {
  caches.clear();
  inflight.clear();
}
