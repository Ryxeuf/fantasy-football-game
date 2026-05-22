"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../lib/api-client";

interface StandingsRow {
  readonly entryId: string;
  readonly teamName: string;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly differential: number;
  readonly games: number;
}

interface StandingsResponse {
  readonly standings: StandingsRow[];
}

export default function LeagueStandingsPage() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [rows, setRows] = useState<StandingsRow[] | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    async function load() {
      try {
        const out = await apiRequest<StandingsResponse>(
          `/api/nfl-fantasy/leagues/${leagueId}/standings`,
        );
        if (!cancelled) setRows(out.standings ?? []);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiClientError) {
          setError({ message: err.message, status: err.status });
        } else {
          setError({
            message: err instanceof Error ? err.message : "Erreur inconnue",
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  if (error?.status === 401) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Authentification requise</h1>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (error?.status === 404 || error?.status === 403) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Championnat introuvable</h1>
        <p className="mt-2 text-sm text-nuffle-anthracite/70">{error.message}</p>
        <Link
          href="/nfl-fantasy"
          className="mt-4 inline-block text-sm text-nuffle-gold hover:text-nuffle-gold"
        >
          ← Retour à mes championnats
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="nuffle-coach-standings">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${leagueId}`}
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← Retour à le championnat
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Classement</h1>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          Bilan computed sur les matchups settled. Tri : victoires, puis
          différentiel, puis points marqués.
        </p>
      </div>

      {error && error.status !== 401 && error.status !== 404 && error.status !== 403 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Erreur : {error.message}
        </div>
      )}

      {rows === null && !error && (
        <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>
      )}

      {rows !== null && rows.length === 0 && (
        <div
          className="rounded-lg border border-dashed border-nuffle-bronze/20 bg-white p-10 text-center text-sm text-nuffle-anthracite/70"
          data-testid="standings-empty"
        >
          Aucun matchup settle pour le moment — le classement apparaitra
          dès la première semaine terminée.
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-nuffle-bronze/20 bg-white">
          <table
            className="min-w-full divide-y divide-nuffle-bronze/20 text-sm"
            data-testid="standings-table"
          >
            <thead className="bg-white text-left text-xs uppercase tracking-wide text-nuffle-anthracite/70">
              <tr>
                <th className="px-3 py-2 text-right">#</th>
                <th className="px-3 py-2">Équipe</th>
                <th className="px-3 py-2 text-right">V</th>
                <th className="px-3 py-2 text-right">D</th>
                <th className="px-3 py-2 text-right">N</th>
                <th className="px-3 py-2 text-right">Pour</th>
                <th className="px-3 py-2 text-right">Contre</th>
                <th className="px-3 py-2 text-right">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nuffle-bronze/20">
              {rows.map((r, idx) => (
                <tr key={r.entryId} className="hover:bg-nuffle-ivory/60">
                  <td className="px-3 py-2 text-right text-nuffle-anthracite/60">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-nuffle-anthracite">
                    {r.teamName}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-700">{r.wins}</td>
                  <td className="px-3 py-2 text-right text-red-700">{r.losses}</td>
                  <td className="px-3 py-2 text-right text-nuffle-anthracite/70">{r.ties}</td>
                  <td className="px-3 py-2 text-right">{r.pointsFor.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">{r.pointsAgainst.toFixed(1)}</td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      r.differential >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {r.differential >= 0 ? "+" : ""}
                    {r.differential.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
