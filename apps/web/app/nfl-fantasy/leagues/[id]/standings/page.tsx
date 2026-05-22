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
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-semibold">Authentification requise</h1>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-400"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (error?.status === 404 || error?.status === 403) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-semibold">League introuvable</h1>
        <p className="mt-2 text-sm text-slate-400">{error.message}</p>
        <Link
          href="/nfl-fantasy"
          className="mt-4 inline-block text-sm text-orange-400 hover:text-orange-300"
        >
          ← Retour à mes leagues
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="nuffle-coach-standings">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${leagueId}`}
          className="text-sm text-slate-400 hover:text-white"
        >
          ← Retour à la league
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Classement</h1>
        <p className="mt-1 text-sm text-slate-400">
          Bilan computed sur les matchups settled. Tri : victoires, puis
          différentiel, puis points marqués.
        </p>
      </div>

      {error && error.status !== 401 && error.status !== 404 && error.status !== 403 && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Erreur : {error.message}
        </div>
      )}

      {rows === null && !error && (
        <div className="text-sm text-slate-400">Chargement…</div>
      )}

      {rows !== null && rows.length === 0 && (
        <div
          className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center text-sm text-slate-400"
          data-testid="standings-empty"
        >
          Aucun matchup settle pour le moment — le classement apparaitra
          dès la première semaine terminée.
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
          <table
            className="min-w-full divide-y divide-slate-800 text-sm"
            data-testid="standings-table"
          >
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
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
            <tbody className="divide-y divide-slate-800">
              {rows.map((r, idx) => (
                <tr key={r.entryId} className="hover:bg-slate-900/70">
                  <td className="px-3 py-2 text-right text-slate-500">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-100">
                    {r.teamName}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-300">{r.wins}</td>
                  <td className="px-3 py-2 text-right text-red-300">{r.losses}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{r.ties}</td>
                  <td className="px-3 py-2 text-right">{r.pointsFor.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">{r.pointsAgainst.toFixed(1)}</td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      r.differential >= 0 ? "text-emerald-300" : "text-red-300"
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
