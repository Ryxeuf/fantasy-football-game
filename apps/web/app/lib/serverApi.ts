/**
 * Returns the base URL the Next.js server should use when calling the backend
 * API during SSR/ISR. Prefers `SERVER_API_BASE` (set to an internal Docker
 * hostname in prod), then the public URL, then localhost for local dev.
 */
export function getServerApiBase(): string {
  return (
    process.env.SERVER_API_BASE ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8201"
  );
}

/**
 * SSR/ISR-safe wrapper around `fetch` that returns `null` on any failure
 * (network error, non-OK status, or JSON parse error) instead of throwing.
 *
 * The raw `fetch` call throws `TypeError: fetch failed` when the backend is
 * unreachable (container not yet listening, DNS hiccup, etc.). Without this
 * guard the exception propagates out of the Server Component and crashes
 * page rendering with an "Unhandled Runtime Error" overlay.
 */
export async function safeServerJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      console.error(
        `[serverApi] ${url} responded with status ${res.status}`,
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[serverApi] fetch failed for ${url}: ${message}`);
    return null;
  }
}
