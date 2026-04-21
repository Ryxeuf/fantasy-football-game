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
