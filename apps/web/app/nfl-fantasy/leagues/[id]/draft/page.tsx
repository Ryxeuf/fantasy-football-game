"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../lib/api-client";
import type { LeagueWithEntries } from "../../../types";

interface RosterPlayerView {
  readonly rosterId: string;
  readonly acquiredVia: string;
  readonly acquiredAt: string;
  readonly tvCost: number;
  readonly player: {
    readonly id: string;
    readonly pseudonym: string;
    readonly teamCode: string | null;
    readonly nflPosition: string;
    readonly bbPosition: string;
    readonly jerseyNumber: number | null;
    readonly status: string;
  } | null;
}

interface RosterResponse {
  readonly roster: RosterPlayerView[];
}

interface CatalogPlayer {
  readonly id: string;
  readonly pseudonym: string;
  readonly teamCode: string | null;
  readonly bbPosition: string;
  readonly nflPosition: string;
  readonly status: string;
  readonly totalSpp?: number;
}

interface CatalogResponse {
  readonly players: CatalogPlayer[];
  readonly total: number;
}

interface MeResponse {
  user?: { id: string } | null;
}

const SEASON_ID = "2025";

export default function NuffleCoachDraftPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [league, setLeague] = useState<LeagueWithEntries | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterPlayerView[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogPlayer[] | null>(null);
  const [search, setSearch] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const myEntry =
    league && currentUserId
      ? league.entries.find((e) => e.userId === currentUserId) ?? null
      : null;

  const loadAll = useCallback(async () => {
    if (!leagueId) return;
    try {
      const [lg, me] = await Promise.all([
        apiRequest<LeagueWithEntries>(`/api/nfl-fantasy/leagues/${leagueId}`),
        apiRequest<MeResponse>("/auth/me").catch(
          () => ({ user: null }) as MeResponse,
        ),
      ]);
      setLeague(lg);
      setCurrentUserId(me.user?.id ?? null);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError({ message: err.message, status: err.status });
      } else {
        setError({ message: err instanceof Error ? err.message : "Erreur" });
      }
    }
  }, [leagueId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadRoster = useCallback(async () => {
    if (!myEntry) return;
    try {
      const out = await apiRequest<RosterResponse>(
        `/api/nfl-fantasy/entries/${myEntry.id}/roster`,
      );
      setRoster(out.roster);
    } catch (err) {
      setRoster([]);
    }
  }, [myEntry]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("pageSize", "30");
        params.set("seasonId", SEASON_ID);
        if (search.trim()) params.set("search", search.trim());
        const out = await apiRequest<CatalogResponse>(
          `/api/nfl-fantasy/players?${params.toString()}`,
        );
        if (!cancelled) setCatalog(out.players as CatalogPlayer[]);
      } catch {
        if (!cancelled) setCatalog([]);
      }
    }
    const t = setTimeout(loadCatalog, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search]);

  async function draftPlayer(player: CatalogPlayer): Promise<void> {
    if (!myEntry) return;
    setActionError(null);
    setBusy(player.id);
    try {
      await apiRequest(`/api/nfl-fantasy/entries/${myEntry.id}/roster`, {
        method: "POST",
        body: JSON.stringify({ playerId: player.id, acquiredVia: "draft" }),
      });
      await loadRoster();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  async function releasePlayer(playerId: string): Promise<void> {
    if (!myEntry) return;
    setActionError(null);
    setBusy(playerId);
    try {
      await apiRequest(
        `/api/nfl-fantasy/entries/${myEntry.id}/roster/${playerId}`,
        { method: "DELETE" },
      );
      await loadRoster();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

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
        <Link
          href="/nfl-fantasy"
          className="mt-4 inline-block text-sm text-orange-400 hover:text-orange-300"
        >
          ← Retour à mes leagues
        </Link>
      </div>
    );
  }

  if (!league) {
    return <div className="text-sm text-slate-400">Chargement…</div>;
  }

  const isDraft = league.status === "draft";
  const rosteredIds = new Set((roster ?? []).map((r) => r.player?.id));

  return (
    <div className="space-y-6" data-testid="nuffle-coach-draft">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${league.id}`}
          className="text-sm text-slate-400 hover:text-white"
        >
          ← Retour à la league
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Draft</h1>
        <p className="mt-1 text-sm text-slate-400">
          {league.name} · Saison {league.seasonId} ·{" "}
          {isDraft ? (
            <span className="text-amber-300">draft ouverte</span>
          ) : (
            <span className="text-slate-500">draft fermée</span>
          )}
        </p>
      </div>

      {!isDraft && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          La draft de cette league est fermée — les ajouts/retraits de
          joueurs nécessitent un transfert via la page mercato (à venir).
          La saison est en cours.
        </div>
      )}

      {!myEntry && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          Tu n&apos;es pas membre de cette league. Rejoins-la d&apos;abord pour
          pouvoir drafter.
        </div>
      )}

      {myEntry && (
        <section>
          <h2 className="text-lg font-semibold text-slate-200">
            Mon roster · {roster?.length ?? 0} joueurs
          </h2>
          {actionError && (
            <div className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {actionError}
            </div>
          )}
          {roster === null && (
            <div className="mt-3 text-sm text-slate-400">Chargement…</div>
          )}
          {roster !== null && roster.length === 0 && (
            <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
              Ton roster est vide — drafte tes premiers joueurs ci-dessous.
            </div>
          )}
          {roster !== null && roster.length > 0 && (
            <ul
              className="mt-3 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900/40"
              data-testid="draft-my-roster"
            >
              {roster.map((r) => (
                <li
                  key={r.rosterId}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-100">
                      {r.player?.pseudonym ?? "—"}
                      {r.player?.jerseyNumber !== null &&
                        r.player?.jerseyNumber !== undefined && (
                          <span className="ml-2 text-slate-500">
                            #{r.player.jerseyNumber}
                          </span>
                        )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.player?.bbPosition} · {r.player?.teamCode ?? "—"} ·{" "}
                      {r.acquiredVia}
                    </p>
                  </div>
                  {isDraft && r.player && (
                    <button
                      disabled={busy === r.player.id}
                      onClick={() => releasePlayer(r.player!.id)}
                      className="rounded-md border border-red-700/60 bg-red-900/30 px-2 py-1 text-xs text-red-200 hover:border-red-500 disabled:opacity-50"
                    >
                      {busy === r.player.id ? "…" : "Release"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {myEntry && isDraft && (
        <section>
          <h2 className="text-lg font-semibold text-slate-200">
            Catalogue · saison {SEASON_ID}
          </h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche pseudo, équipe, position…"
            className="mt-3 w-full max-w-md rounded-md border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-sm text-slate-100"
            data-testid="draft-search"
          />
          {catalog === null ? (
            <div className="mt-3 text-sm text-slate-400">Chargement…</div>
          ) : catalog.length === 0 ? (
            <div className="mt-3 text-sm text-slate-400">Aucun résultat.</div>
          ) : (
            <ul
              className="mt-3 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900/40"
              data-testid="draft-catalog"
            >
              {catalog.map((p) => {
                const already = rosteredIds.has(p.id);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between p-3 text-sm"
                  >
                    <div>
                      <Link
                        href={`/nfl-fantasy/players/${p.id}?seasonId=${SEASON_ID}`}
                        className="font-medium text-slate-100 hover:text-orange-300"
                      >
                        {p.pseudonym}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {p.bbPosition} · {p.teamCode ?? "—"} ·{" "}
                        {p.totalSpp !== undefined
                          ? `${p.totalSpp.toFixed(1)} SPP`
                          : "—"}
                      </p>
                    </div>
                    {already ? (
                      <span className="text-xs text-slate-500">déjà drafté</span>
                    ) : (
                      <button
                        disabled={busy === p.id}
                        onClick={() => draftPlayer(p)}
                        className="rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-400 disabled:opacity-50"
                      >
                        {busy === p.id ? "…" : "+ Drafter"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <p className="text-xs text-slate-500">
        V1 minimal : pas de draft snake interactif. Chaque coach drafte
        librement (free-form). La transition vers la saison est lancée
        par l&apos;admin une fois tous les coachs prêts.
      </p>
    </div>
  );
}
