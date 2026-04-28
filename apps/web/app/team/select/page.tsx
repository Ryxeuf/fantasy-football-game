"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";

export default function TeamSelectPage() {
  const [teams, setTeams] = useState<
    Array<{ id: string; name: string; roster: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ teams: Array<{ id: string; name: string; roster: string }> }>(
      `/team/available`,
    )
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
      // S25.5x — apiRequest unwrap l'enveloppe ApiResponse<T>
      await apiRequest<{ selection: unknown }>(`/team/choose`, {
        method: "POST",
        body: JSON.stringify({ matchId, teamId }),
      });
      window.location.href = `/waiting/${matchId}`;
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
            data-testid="team-option"
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
