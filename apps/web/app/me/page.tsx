"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../auth-client";

type Match = { id: string; status: string; seed: string; createdAt: string };

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`);
  return res.json();
}

async function postJSON(path: string, body: unknown) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
  return json;
}

export default function MePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const t = localStorage.getItem("auth_token");
        if (!t) { window.location.href = "/login"; return; }
        const me = await fetchJSON("/auth/me");
        if (!me?.user) { window.location.href = "/login"; return; }
        const { matches } = await fetchJSON("/user/matches");
        setMatches(matches);
      } catch (e: any) {
        setError(e.message || "Erreur");
      }
    })();
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Mes parties</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="grid gap-3">
        {matches.map((m) => (
          <div key={m.id} className="rounded border p-4 bg-white flex items-center justify-between">
            <div>
              <div className="font-semibold">Partie {m.id.slice(0,8)}…</div>
              <div className="text-sm text-gray-600">Statut: {m.status} • {new Date(m.createdAt).toLocaleString()}</div>
            </div>
            <button
              className="px-3 py-1.5 bg-blue-600 text-white rounded"
              onClick={async () => {
                try {
                  const { matchToken } = await postJSON("/match/join", { matchId: m.id });
                  localStorage.setItem("match_token", matchToken);
                  window.location.href = "/play";
                } catch (e) {
                  alert((e as any)?.message || "Erreur");
                }
              }}
            >
              Continuer
            </button>
          </div>
        ))}
        {matches.length === 0 && <p className="text-sm text-gray-600">Aucune partie en cours.</p>}
      </div>
      <div>
        <a className="px-4 py-2 bg-emerald-600 text-white rounded" href="/lobby">Créer ou rejoindre une partie</a>
      </div>
    </div>
  );
}


