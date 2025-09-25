// Détermine dynamiquement l'URL de l'API.
// Ordre de priorité:
// 1) NEXT_PUBLIC_API_BASE (si fourni)
// 2) Si on est sur un domaine orb.local: utilise le service server en HTTPS (port 8201)
// 3) Fallback local: http://localhost:18001
const inferApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
  // En navigateur uniquement, window est défini
  if (typeof window !== 'undefined') {
    const host = window.location.host || '';
    const hostname = window.location.hostname || '';
    const isOrb = host.endsWith('.orb.local') || hostname.endsWith('.orb.local');
    if (isOrb) {
      // Domaine du service API exposé dans OrbStack (voir capture: server ... ports 8201/8202)
      return 'https://server.fantasy-football-game.orb.local:8201';
    }
  }
  return 'http://localhost:8201';
};

export const API_BASE = inferApiBase();

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


