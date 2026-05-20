"use client";

/**
 * Page admin Phase 3.C.1 — liste des 32 NflTeam avec race BB + compteurs
 * (joueurs actifs/total, games sur la saison selectionnee).
 *
 * Filtres locaux : search (code/city/raceLabel) + race.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ApiClientError, apiRequest } from "../../../lib/api-client";
import { useNflFantasySeason } from "../_components/SeasonContext";

interface AdminTeamRow {
  readonly code: string;
  readonly city: string;
  readonly bbRace: string;
  readonly raceLabel: string;
  readonly activePlayers: number;
  readonly totalPlayers: number;
  readonly gamesInSeason: number;
}

interface TeamsResponse {
  readonly teams: ReadonlyArray<AdminTeamRow>;
}

export default function AdminNflFantasyTeamsPage(): JSX.Element {
  const { selectedSeasonId } = useNflFantasySeason();
  const [teams, setTeams] = useState<ReadonlyArray<AdminTeamRow>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [raceFilter, setRaceFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (selectedSeasonId) qs.set("seasonId", selectedSeasonId);
    apiRequest<TeamsResponse>(
      `/admin/nfl-fantasy/explore/teams${qs.toString() ? `?${qs}` : ""}`,
    )
      .then((d) => {
        if (cancelled) return;
        setTeams(d.teams);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiClientError) {
          setError(`${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`);
        } else {
          setError(e instanceof Error ? e.message : "Erreur");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSeasonId]);

  const races = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams) set.add(t.bbRace);
    return Array.from(set).sort();
  }, [teams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) => {
      if (raceFilter && t.bbRace !== raceFilter) return false;
      if (q) {
        const haystack = `${t.code} ${t.city} ${t.raceLabel}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [teams, search, raceFilter]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nuffle-anthracite">
            🏈 Équipes NFL
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Référentiel pseudonymisé (Q5/Q8) — 32 équipes avec race BB
            attribuée. Clique sur une ligne pour voir le roster détaillé.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {filtered.length} / {teams.length} équipe
          {teams.length > 1 ? "s" : ""}
          {selectedSeasonId ? ` · saison ${selectedSeasonId}` : ""}
        </div>
      </header>

      <div className="flex flex-wrap gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher code/ville/race…"
          className="min-w-[200px] flex-1 rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
          data-testid="nfl-fantasy-teams-search"
        />
        <select
          value={raceFilter}
          onChange={(e) => setRaceFilter(e.target.value)}
          className="rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
          data-testid="nfl-fantasy-teams-race-filter"
        >
          <option value="">Toutes races BB</option>
          {races.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm"
        data-testid="nfl-fantasy-teams-table"
      >
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Ville</th>
              <th className="px-3 py-2">Race BB</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2 text-right">Actifs</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Games</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Aucune équipe trouvée.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((t) => (
                <tr
                  key={t.code}
                  className="hover:bg-nuffle-gold/5"
                  data-testid={`nfl-fantasy-team-row-${t.code}`}
                >
                  <td className="px-3 py-2 font-mono font-semibold text-nuffle-anthracite">
                    <Link
                      href={`/admin/nfl-fantasy/teams/${t.code}` as never}
                      className="hover:underline"
                    >
                      {t.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{t.city}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-nuffle-gold/10 px-2 py-0.5 text-xs font-medium text-nuffle-bronze">
                      {t.bbRace}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{t.raceLabel}</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-700">
                    {t.activePlayers}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">
                    {t.totalPlayers}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">
                    {t.gamesInSeason}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
