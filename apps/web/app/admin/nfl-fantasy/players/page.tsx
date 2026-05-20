"use client";

/**
 * Page admin Phase 3.C.2 — liste paginee + filtree des NflPlayer.
 *
 * Filtres : recherche (pseudo/realName/id), team, bbPosition, status.
 * Si une saison est selectionnee, affiche aussi totalSpp + gamesPlayed.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ApiClientError, apiRequest } from "../../../lib/api-client";
import { useNflFantasySeason } from "../_components/SeasonContext";

interface AdminPlayerRow {
  readonly id: string;
  readonly pseudonym: string;
  readonly realName: string;
  readonly realNameDisplay: boolean;
  readonly teamCode: string | null;
  readonly jerseyNumber: number | null;
  readonly nflPosition: string;
  readonly bbPosition: string;
  readonly status: string;
  readonly totalSpp?: number;
  readonly gamesPlayed?: number;
}

interface ListResponse {
  readonly players: ReadonlyArray<AdminPlayerRow>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

const PAGE_SIZE = 50;

const BB_STATUSES: ReadonlyArray<string> = [
  "active",
  "ir",
  "retired",
  "suspended",
];

function statusBadge(status: string): JSX.Element {
  const color =
    status === "active"
      ? "bg-emerald-100 text-emerald-700"
      : status === "ir"
        ? "bg-amber-100 text-amber-700"
        : status === "retired"
          ? "bg-gray-200 text-gray-600"
          : "bg-red-100 text-red-700";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${color}`}
    >
      {status}
    </span>
  );
}

export default function AdminNflFantasyPlayersPage(): JSX.Element {
  const { selectedSeasonId } = useNflFantasySeason();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [bbPosition, setBbPosition] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [searchDebounced, teamCode, bbPosition, status, selectedSeasonId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (selectedSeasonId) qs.set("seasonId", selectedSeasonId);
    if (teamCode) qs.set("teamCode", teamCode);
    if (bbPosition) qs.set("bbPosition", bbPosition);
    if (status) qs.set("status", status);
    if (searchDebounced) qs.set("search", searchDebounced);
    qs.set("page", String(page));
    qs.set("pageSize", String(PAGE_SIZE));

    apiRequest<ListResponse>(`/admin/nfl-fantasy/explore/players?${qs}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
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
  }, [selectedSeasonId, teamCode, bbPosition, status, searchDebounced, page]);

  // Unique BB positions from current page (for filter dropdown). En V1 on
  // se contente des positions visibles ; une route dediee viendra plus tard
  // si necessaire.
  const visibleBbPositions = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.players ?? []) set.add(p.bbPosition);
    return Array.from(set).sort();
  }, [data]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const showingFrom = data && data.total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = data ? Math.min(page * PAGE_SIZE, data.total) : 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nuffle-anthracite">
            🐀 Joueurs NFL
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Pseudonymes (Q8) + mapping BB. Le realName est privé (admin only)
            — non exposé en V1 sauf si <code>realNameDisplay = true</code> par
            joueur (licence individuelle).
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {data
            ? `${showingFrom}-${showingTo} / ${data.total} joueurs`
            : "—"}
          {selectedSeasonId ? ` · saison ${selectedSeasonId}` : ""}
        </div>
      </header>

      <div className="flex flex-wrap gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher pseudo / nom / gsis_id…"
          className="min-w-[200px] flex-1 rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
          data-testid="nfl-fantasy-players-search"
        />
        <input
          type="text"
          value={teamCode}
          onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
          placeholder="Team (KC, MIA…)"
          maxLength={4}
          className="w-32 rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
          data-testid="nfl-fantasy-players-team-filter"
        />
        <select
          value={bbPosition}
          onChange={(e) => setBbPosition(e.target.value)}
          className="rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
          data-testid="nfl-fantasy-players-bbpos-filter"
        >
          <option value="">Toutes BB positions</option>
          {visibleBbPositions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
          data-testid="nfl-fantasy-players-status-filter"
        >
          <option value="">Tous statuts</option>
          {BB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
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
        data-testid="nfl-fantasy-players-table"
      >
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Pseudonym</th>
              <th className="px-3 py-2">Real name</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">NFL pos</th>
              <th className="px-3 py-2">BB pos</th>
              <th className="px-3 py-2">Status</th>
              {selectedSeasonId && (
                <>
                  <th className="px-3 py-2 text-right">Games</th>
                  <th className="px-3 py-2 text-right">SPP</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td
                  colSpan={selectedSeasonId ? 9 : 7}
                  className="px-3 py-6 text-center text-gray-400"
                >
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && data && data.players.length === 0 && (
              <tr>
                <td
                  colSpan={selectedSeasonId ? 9 : 7}
                  className="px-3 py-6 text-center text-gray-400"
                >
                  Aucun joueur trouvé pour ces filtres.
                </td>
              </tr>
            )}
            {!loading &&
              data?.players.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-nuffle-gold/5"
                  data-testid={`nfl-fantasy-player-row-${p.id}`}
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/nfl-fantasy/players/${p.id}` as never}
                      className="font-medium text-nuffle-bronze hover:underline"
                    >
                      {p.pseudonym}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {p.realName}
                    {!p.realNameDisplay && (
                      <span
                        title="Q8 — non public"
                        className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-gray-500"
                      >
                        privé
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-700">
                    {p.teamCode ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-500">
                    {p.jerseyNumber ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-600">
                    {p.nflPosition}
                  </td>
                  <td className="px-3 py-2 font-mono text-nuffle-anthracite">
                    {p.bbPosition}
                  </td>
                  <td className="px-3 py-2">{statusBadge(p.status)}</td>
                  {selectedSeasonId && (
                    <>
                      <td className="px-3 py-2 text-right font-mono text-gray-600">
                        {p.gamesPlayed ?? 0}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-nuffle-bronze">
                        {p.totalSpp ?? 0}
                      </td>
                    </>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Précédent
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
