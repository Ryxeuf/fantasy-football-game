// API client for mobile app.
// Uses the same backend as the web app.
// API_BASE can be overridden via EXPO_PUBLIC_API_BASE env var.

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:8201";

export { API_BASE };

export async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Erreur ${res.status}`);
  }
  return json;
}
