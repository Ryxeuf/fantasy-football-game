"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../lib/api-client";

interface PlayerRow {
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

interface ListPlayersResponse {
  readonly players: PlayerRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

const BB_POSITIONS = [
  "Thrower",
  "Catcher",
  "Runner",
  "Blitzer",
  "Lineman",
  "Big Guy",
] as const;

const PAGE_SIZE = 50;

export default function NuffleCoachPlayersPage() {
  const [data, setData] = useState<ListPlayersResponse | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);

  const [search, setSearch] = useState<string>("");
  const [bbPosition, setBbPosition] = useState<string>("");
  const [teamCode, setTeamCode] = useState<string>("");
  const [seasonId, setSeasonId] = useState<string>("2025");
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));
        if (seasonId) params.set("seasonId", seasonId);
        if (search.trim()) params.set("search", search.trim());
        if (bbPosition) params.set("bbPosition", bbPosition);
        if (teamCode.trim()) params.set("teamCode", teamCode.trim().toUpperCase());

        const out = await apiRequest<ListPlayersResponse>(
          `/api/nfl-fantasy/players?${params.toString()}`,
        );
        if (!cancelled) {
          setData(out);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiClientError) {
          setError({ message: err.message, status: err.status });
        } else {
          setError({
            message: err instanceof Error ? err.message : "Erreur inconnue",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [page, seasonId, search, bbPosition, teamCode]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

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

  return (
    <div className="space-y-6" data-testid="nuffle-coach-players">
      <div>
        <h1 className="text-2xl font-semibold">Catalogue joueurs</h1>
        <p className="mt-1 text-sm text-slate-400">
          Tous les joueurs NFL re-skinned BB. Filtre par équipe, poste BB
          ou recherche par pseudonyme.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Recherche
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Pseudo, real name, ID…"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-sm text-slate-100"
            data-testid="players-search"
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Poste BB
          <select
            value={bbPosition}
            onChange={(e) => {
              setPage(1);
              setBbPosition(e.target.value);
            }}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-sm text-slate-100"
          >
            <option value="">Tous</option>
            {BB_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Équipe (code)
          <input
            type="text"
            value={teamCode}
            maxLength={4}
            onChange={(e) => {
              setPage(1);
              setTeamCode(e.target.value);
            }}
            placeholder="SF, NE, KC…"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-sm uppercase text-slate-100"
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Saison SPP
          <select
            value={seasonId}
            onChange={(e) => {
              setPage(1);
              setSeasonId(e.target.value);
            }}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-sm text-slate-100"
          >
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="">— (sans agrégat)</option>
          </select>
        </label>
      </div>

      {error && error.status !== 401 && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Erreur : {error.message}
        </div>
      )}

      {loading && <div className="text-sm text-slate-400">Chargement…</div>}

      {!loading && data && data.players.length === 0 && (
        <div
          className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center text-sm text-slate-400"
          data-testid="players-empty"
        >
          Aucun joueur ne correspond à ces filtres.
        </div>
      )}

      {!loading && data && data.players.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
            <table
              className="min-w-full divide-y divide-slate-800 text-sm"
              data-testid="players-table"
            >
              <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Pseudo</th>
                  <th className="px-3 py-2">Équipe</th>
                  <th className="px-3 py-2">Poste BB</th>
                  <th className="px-3 py-2">NFL pos</th>
                  <th className="px-3 py-2 text-right">SPP</th>
                  <th className="px-3 py-2 text-right">Games</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.players.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/70">
                    <td className="px-3 py-2">
                      <Link
                        href={`/nfl-fantasy/players/${p.id}${seasonId ? `?seasonId=${seasonId}` : ""}`}
                        className="font-medium text-orange-300 hover:text-orange-200"
                      >
                        {p.pseudonym}
                      </Link>
                      {p.realNameDisplay && (
                        <div className="text-xs text-slate-500">{p.realName}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{p.teamCode ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{p.bbPosition}</td>
                    <td className="px-3 py-2 text-slate-400">{p.nflPosition}</td>
                    <td className="px-3 py-2 text-right text-slate-100">
                      {p.totalSpp !== undefined ? p.totalSpp.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">
                      {p.gamesPlayed ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={
                          p.status === "active"
                            ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300"
                            : "rounded-full bg-slate-700 px-2 py-0.5 text-slate-300"
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-400">
            <p>
              {data.total} joueur{data.total > 1 ? "s" : ""} · page {data.page} /{" "}
              {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs disabled:opacity-40"
              >
                ← Précédent
              </button>
              <button
                disabled={data.page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs disabled:opacity-40"
              >
                Suivant →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
