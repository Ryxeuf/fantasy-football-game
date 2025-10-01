"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../auth-client";

type Match = { id: string; status: string; seed: string; createdAt: string };

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

async function postJSON(path: string, body: unknown) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
  return json;
}

export default function MePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const t = localStorage.getItem("auth_token");
        if (!t) {
          window.location.href = "/login";
          return;
        }
        const me = await fetchJSON("/auth/me");
        if (!me?.user) {
          window.location.href = "/login";
          return;
        }
        const { matches } = await fetchJSON("/user/matches");
        setMatches(matches);
        // Charger les résumés en parallèle
        const entries = await Promise.all(
          matches.map((m: Match) =>
            fetchJSON(`/match/${m.id}/summary`)
              .then((s) => [m.id, s] as const)
              .catch(() => [m.id, null] as const),
          ),
        );
        const map: Record<string, any> = {};
        for (const [id, s] of entries) map[id] = s;
        setSummaries(map);
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
        {matches.map((m) => {
          const summary = summaries[m.id];
          const isReady =
            summary?.status === "active" || summary?.status === "prematch";
          const buttonText =
            summary?.status === "prematch"
              ? "Commencer le match"
              : summary?.status === "active"
                ? "Continuer"
                : "En attente de l’autre joueur";
          const displayStatus =
            summary?.status === "prematch" ? "Prêt à jouer" : m.status;
          return (
            <div key={m.id} className="rounded border p-4 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    Partie {m.id.slice(0, 8)}…
                  </div>
                  <div className="text-sm text-gray-600">
                    Statut: {displayStatus} •{" "}
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isReady} // Changé : active pour prematch
                  onClick={async () => {
                    try {
                      const { matchToken } = await postJSON("/match/join", {
                        matchId: m.id,
                      });
                      localStorage.setItem("match_token", matchToken);
                      sessionStorage.setItem("current_match_id", m.id);
                      window.location.href = `/play/${m.id}`;
                    } catch (e) {
                      alert((e as any)?.message || "Erreur");
                    }
                  }}
                >
                  {buttonText}
                </button>
              </div>
              {summary && (
                <div className="mt-3 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {summary.teams?.local?.name || "—"}{" "}
                        <span className="text-gray-500">
                          (Coach: {summary.teams?.local?.coach || "—"})
                        </span>
                      </div>
                    </div>
                    <div className="text-xl font-bold">
                      {summary.score?.teamA ?? 0} - {summary.score?.teamB ?? 0}
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {summary.teams?.visitor?.name || "—"}{" "}
                        <span className="text-gray-500">
                          (Coach: {summary.teams?.visitor?.coach || "—"})
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Mi-temps: {summary.half} • Tour: {summary.turn}
                  </div>
                  {summary.status !== "active" &&
                    summary.status !== "prematch" && ( // Ajouté condition pour prematch
                      <div className="mt-2 text-xs">
                        <a
                          className="underline text-blue-700"
                          href={`/waiting/${m.id}`}
                        >
                          Voir l’état des validations
                        </a>
                      </div>
                    )}
                </div>
              )}
            </div>
          );
        })}
        {matches.length === 0 && (
          <p className="text-sm text-gray-600">Aucune partie en cours.</p>
        )}
      </div>
      <div>
        <a
          className="px-4 py-2 bg-emerald-600 text-white rounded"
          href="/lobby"
        >
          Créer ou rejoindre une partie
        </a>
      </div>
    </div>
  );
}
