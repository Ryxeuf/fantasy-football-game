"use client";

/**
 * Admin Pro League — liste des teams pour edition branding.
 *
 * Affiche toutes les teams (toutes ligues confondues) avec apercu
 * couleur primaire/secondaire + ville/nom/race + lien vers la page
 * d'edition.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "../../../auth-client";

interface ProTeamSummary {
  readonly id: string;
  readonly leagueId: string;
  readonly slug: string;
  readonly city: string;
  readonly name: string;
  readonly race: string;
  readonly nflFlavor: string | null;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
  readonly motto: string | null;
  readonly headline: string | null;
}

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Erreur ${res.status}`);
  }
  return json;
}

export default function AdminProLeagueTeamsPage() {
  const [teams, setTeams] = useState<ProTeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchJSON("/admin/pro-league/teams")
      .then((data) => {
        if (alive) setTeams(data.teams ?? []);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">
            🎨 Branding teams
          </h1>
          <Link
            href={"/admin/pro-league" as any}
            className="text-sm text-blue-700 hover:underline"
          >
            ← Retour hub
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          Editer couleurs primaire/secondaire, motto, headline, ville/nom et
          flavor NFL d&apos;une team. Toute modification est tracee dans
          l&apos;audit log admin.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500" data-testid="teams-loading">
          Chargement…
        </div>
      )}

      {!loading && !error && teams.length === 0 && (
        <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
          Aucune team Pro League. Seedez la ligue depuis{" "}
          <Link
            href={"/admin/utilities" as any}
            className="text-blue-700 hover:underline"
          >
            /admin/utilities
          </Link>
          .
        </div>
      )}

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        data-testid="teams-grid"
      >
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/admin/pro-league/teams/${team.id}` as any}
            data-testid={`team-card-${team.slug}`}
            className="p-4 rounded-xl border bg-white border-gray-200 hover:border-nuffle-gold hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <span
                  className="block w-6 h-6 rounded border border-gray-300"
                  style={{
                    backgroundColor: team.primaryColor ?? "#e5e7eb",
                  }}
                  aria-label="Couleur primaire"
                  data-testid={`primary-${team.slug}`}
                />
                <span
                  className="block w-6 h-6 rounded border border-gray-300"
                  style={{
                    backgroundColor: team.secondaryColor ?? "#e5e7eb",
                  }}
                  aria-label="Couleur secondaire"
                  data-testid={`secondary-${team.slug}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-nuffle-anthracite truncate">
                  {team.city} {team.name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {team.race}
                  {team.nflFlavor ? ` · ${team.nflFlavor}` : ""}
                </div>
                {team.motto && (
                  <div className="text-xs italic text-gray-600 mt-1 truncate">
                    « {team.motto} »
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
