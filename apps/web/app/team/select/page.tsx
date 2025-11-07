"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";

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

export default function TeamSelectPage() {
  const [teams, setTeams] = useState<
    Array<{ id: string; name: string; roster: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJSON(`/team/available`)
      .then((d) => setTeams(d.teams || []))
      .catch((e) => setError(e.message || "Erreur"));
  }, []);

  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const matchId = params.get("matchId") || "";

  async function choose(teamId: string) {
    try {
      setError(null);
      await postJSON(`/team/choose`, { matchId, teamId });
      window.location.href = "/me";
    } catch (e: any) {
      setError(e.message || "Erreur");
    }
  }

  return (
    <div className="w-full p-6 space-y-6">
      <h1 className="text-2xl font-bold">Choisir une équipe</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => choose(t.id)}
            className="rounded-xl border p-6 bg-white hover:shadow text-left"
          >
            <div className="text-xl font-semibold">{t.name}</div>
            <div className="text-sm text-gray-600 mt-1 capitalize">
              Roster: {t.roster}
            </div>
          </button>
        ))}
        {teams.length === 0 && (
          <p className="text-sm text-gray-600">Aucune équipe disponible</p>
        )}
      </div>
    </div>
  );
}
