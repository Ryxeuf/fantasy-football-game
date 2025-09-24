"use client";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8001";

async function api(path: string, body?: unknown) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
  return json;
}

export default function LobbyPage() {
  const [matchId, setMatchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Redirige vers /login si non connecté ou token invalide
  useEffect(() => {
    (async () => {
      try {
        const t = localStorage.getItem("auth_token");
        if (!t) { window.location.href = "/login"; return; }
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
        if (!res.ok) {
          localStorage.removeItem("auth_token");
          window.location.href = "/login";
        }
      } catch {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }
    })();
  }, []);

  async function createMatch() {
    setError(null);
    try {
      const { match, matchToken } = await api("/match/create");
      localStorage.setItem("match_token", matchToken);
      window.location.href = `/team/select?matchId=${match.id}`;
    } catch (e: any) {
      setError(e.message || "Erreur");
    }
  }

  async function joinMatch() {
    setError(null);
    try {
      const { match, matchToken } = await api("/match/join", { matchId });
      localStorage.setItem("match_token", matchToken);
      window.location.href = `/team/select?matchId=${match.id}`;
    } catch (e: any) {
      setError(e.message || "Erreur");
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Lobby</h1>
      <button onClick={createMatch} className="w-full bg-blue-600 text-white py-2">Créer une partie</button>
      <div className="flex gap-2">
        <input className="flex-1 border p-2" placeholder="ID de partie" value={matchId} onChange={(e) => setMatchId(e.target.value)} />
        <button onClick={joinMatch} className="bg-green-600 text-white px-3">Rejoindre</button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <p className="text-sm text-neutral-600">Vous devez être connecté pour créer/rejoindre une partie.</p>
    </div>
  );
}


