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

export type ServerApiErrorKind = "network" | "http" | "parse" | "timeout";

export class ServerApiError extends Error {
  readonly kind: ServerApiErrorKind;
  readonly status?: number;
  readonly url: string;

  constructor(init: {
    kind: ServerApiErrorKind;
    message: string;
    url: string;
    status?: number;
    cause?: unknown;
  }) {
    super(init.message, { cause: init.cause });
    this.name = "ServerApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.url = init.url;
  }
}

export interface FetchServerJsonOptions extends RequestInit {
  /** Request timeout in ms. Defaults to 8000ms. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * SSR/ISR fetch wrapper tuned for Next.js server components.
 *
 * - Returns `null` only when the backend replies with **404** — a legitimate
 *   "not found" that callers can translate into `notFound()`. 404s are safe
 *   to cache through ISR.
 * - Throws `ServerApiError` on every other failure (network unreachable,
 *   timeout, 5xx, invalid JSON). Letting the error propagate is deliberate:
 *   it prevents Next.js from caching a silently-empty page and lets
 *   `error.tsx` boundaries render a real error state.
 * - Applies an 8s timeout via `AbortController` so a hung backend cannot
 *   block the render indefinitely.
 */
export async function fetchServerJson<T>(
  url: string,
  options: FetchServerJsonOptions = {},
): Promise<T | null> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, ...rest } =
    options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new ServerApiError({
        kind: "http",
        message: `${url} responded with status ${res.status}`,
        url,
        status: res.status,
      });
    }
    try {
      return (await res.json()) as T;
    } catch (err) {
      throw new ServerApiError({
        kind: "parse",
        message: `JSON parse failed for ${url}`,
        url,
        cause: err,
      });
    }
  } catch (err) {
    if (err instanceof ServerApiError) throw err;
    const isAbort =
      (err instanceof DOMException && err.name === "AbortError") ||
      (err as { name?: string })?.name === "AbortError";
    if (isAbort) {
      throw new ServerApiError({
        kind: "timeout",
        message: `Timeout after ${timeoutMs}ms for ${url}`,
        url,
        cause: err,
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ServerApiError({
      kind: "network",
      message: `Network error fetching ${url}: ${message}`,
      url,
      cause: err,
    });
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

/**
 * Non-throwing variant of `fetchServerJson`. Logs the failure and returns
 * `null` instead of bubbling it up.
 *
 * Reserve this for non-critical call sites where degrading gracefully is
 * better than showing an error page (e.g. optional SEO metadata). Critical
 * page data should prefer `fetchServerJson` so ISR does not cache empty
 * results on transient backend failures.
 */
export async function safeServerJson<T>(
  url: string,
  options: FetchServerJsonOptions = {},
): Promise<T | null> {
  try {
    return await fetchServerJson<T>(url, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[serverApi] ${message}`);
    return null;
  }
}
