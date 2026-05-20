"use client";

/**
 * Page admin Phase 3.D — liste de TOUTES les NflFantasyLeague (admin
 * only), paginee + filtree par status/type/saison.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../../lib/api-client";
import { useNflFantasySeason } from "../_components/SeasonContext";

interface LeagueRow {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly seasonId: string;
  readonly size: number;
  readonly type: string;
  readonly draftMode: string;
  readonly status: string;
  readonly inviteCode: string | null;
  readonly entriesCount: number;
  readonly matchupsCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface LeaguesResponse {
  readonly leagues: ReadonlyArray<LeagueRow>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

const PAGE_SIZE = 50;

function statusBadge(status: string): JSX.Element {
  const color =
    status === "draft"
      ? "bg-sky-100 text-sky-700"
      : status === "in_progress"
        ? "bg-emerald-100 text-emerald-700"
        : status === "completed"
          ? "bg-gray-200 text-gray-600"
          : "bg-gray-100 text-gray-600";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${color}`}
    >
      {status}
    </span>
  );
}

export default function AdminNflFantasyLeaguesPage(): JSX.Element {
  const { selectedSeasonId } = useNflFantasySeason();
  const [data, setData] = useState<LeaguesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, statusFilter, typeFilter, selectedSeasonId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (selectedSeasonId) qs.set("seasonId", selectedSeasonId);
    if (statusFilter) qs.set("status", statusFilter);
    if (typeFilter) qs.set("type", typeFilter);
    if (searchDebounced) qs.set("search", searchDebounced);
    qs.set("page", String(page));
    qs.set("pageSize", String(PAGE_SIZE));

    apiRequest<LeaguesResponse>(`/admin/nfl-fantasy/explore/leagues?${qs}`)
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
  }, [selectedSeasonId, statusFilter, typeFilter, searchDebounced, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nuffle-anthracite">
            🏆 Leagues NFL Fantasy
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Toutes les leagues (admin only), pas juste celles dont tu es
            membre. Click sur une ligne pour voir entries + matchups.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {data ? `${data.total} league${data.total > 1 ? "s" : ""}` : "—"}
          {selectedSeasonId ? ` · saison ${selectedSeasonId}` : ""}
        </div>
      </header>

      <div className="flex flex-wrap gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher nom / id / owner / invite…"
          className="min-w-[200px] flex-1 rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
          data-testid="nfl-fantasy-leagues-search"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
          data-testid="nfl-fantasy-leagues-status-filter"
        >
          <option value="">Tous statuts</option>
          <option value="draft">draft</option>
          <option value="in_progress">in_progress</option>
          <option value="completed">completed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
          data-testid="nfl-fantasy-leagues-type-filter"
        >
          <option value="">Tous types</option>
          <option value="public">public</option>
          <option value="private">private</option>
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm"
        data-testid="nfl-fantasy-leagues-table"
      >
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Saison</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Draft</th>
              <th className="px-3 py-2 text-right">Members</th>
              <th className="px-3 py-2 text-right">Matchups</th>
              <th className="px-3 py-2">Créée</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && data && data.leagues.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  Aucune league pour ces filtres.
                </td>
              </tr>
            )}
            {!loading &&
              data?.leagues.map((l) => (
                <tr
                  key={l.id}
                  className="hover:bg-nuffle-gold/5"
                  data-testid={`nfl-fantasy-league-row-${l.id}`}
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/nfl-fantasy/leagues/${l.id}` as never}
                      className="font-medium text-nuffle-bronze hover:underline"
                    >
                      {l.name}
                    </Link>
                    <div className="text-[10px] font-mono text-gray-400">
                      {l.id}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-600">
                    {l.seasonId}
                  </td>
                  <td className="px-3 py-2">{statusBadge(l.status)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{l.type}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {l.draftMode}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700">
                    {l.entriesCount}/{l.size}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">
                    {l.matchupsCount}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {new Date(l.createdAt).toLocaleDateString("fr-FR")}
                  </td>
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
