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
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        // Joueur deja retire (double-click, state stale) — l'effet
        // escompte est atteint, on re-sync silencieusement.
      } else {
        setActionError(err instanceof Error ? err.message : "Erreur");
      }
    } finally {
      await loadRoster();
      setBusy(null);
    }
  }

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
        <h1 className="text-xl font-semibold">League introuvable</h1>
        <Link
          href="/nfl-fantasy"
          className="mt-4 inline-block text-sm text-nuffle-gold hover:text-nuffle-gold"
        >
          ← Retour à mes leagues
        </Link>
      </div>
    );
  }

  if (!league) {
    return <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>;
  }

  const isDraft = league.status === "draft";
  const rosteredIds = new Set((roster ?? []).map((r) => r.player?.id));

  return (
    <div className="space-y-6" data-testid="nuffle-coach-draft">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${league.id}`}
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← Retour à la league
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Draft</h1>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          {league.name} · Saison {league.seasonId} ·{" "}
          {isDraft ? (
            <span className="text-amber-700">draft ouverte</span>
          ) : (
            <span className="text-nuffle-anthracite/60">draft fermée</span>
          )}
        </p>
      </div>

      {!isDraft && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
          La draft de cette league est fermée — les ajouts/retraits de
          joueurs nécessitent un transfert via la page mercato (à venir).
          La saison est en cours.
        </div>
      )}

      {!myEntry && (
        <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-4 text-sm text-nuffle-anthracite/80">
          Tu n&apos;es pas membre de cette league. Rejoins-la d&apos;abord pour
          pouvoir drafter.
        </div>
      )}

      {myEntry && (
        <section>
          <h2 className="text-lg font-semibold text-nuffle-anthracite">
            Mon roster · {roster?.length ?? 0} joueurs
          </h2>
          {actionError && (
            <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {actionError}
            </div>
          )}
          {roster === null && (
            <div className="mt-3 text-sm text-nuffle-anthracite/70">Chargement…</div>
          )}
          {roster !== null && roster.length === 0 && (
            <div className="mt-3 rounded-lg border border-dashed border-nuffle-bronze/20 bg-white p-6 text-center text-sm text-nuffle-anthracite/70">
              Ton roster est vide — drafte tes premiers joueurs ci-dessous.
            </div>
          )}
          {roster !== null && roster.length > 0 && (
            <ul
              className="mt-3 divide-y divide-nuffle-bronze/20 rounded-lg border border-nuffle-bronze/20 bg-white"
              data-testid="draft-my-roster"
            >
              {roster.map((r) => (
                <li
                  key={r.rosterId}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-nuffle-anthracite">
                      {r.player?.pseudonym ?? "—"}
                      {r.player?.jerseyNumber !== null &&
                        r.player?.jerseyNumber !== undefined && (
                          <span className="ml-2 text-nuffle-anthracite/60">
                            #{r.player.jerseyNumber}
                          </span>
                        )}
                    </p>
                    <p className="text-xs text-nuffle-anthracite/60">
                      {r.player?.bbPosition} · {r.player?.teamCode ?? "—"} ·{" "}
                      {r.acquiredVia}
                    </p>
                  </div>
                  {isDraft && r.player && (
                    <button
                      disabled={busy === r.player.id}
                      onClick={() => releasePlayer(r.player!.id)}
                      className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:border-red-400 disabled:opacity-50"
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
          <h2 className="text-lg font-semibold text-nuffle-anthracite">
            Catalogue · saison {SEASON_ID}
          </h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche pseudo, équipe, position…"
            className="mt-3 w-full max-w-md rounded-md border border-nuffle-bronze/30 bg-white px-3 py-1.5 text-sm text-nuffle-anthracite"
            data-testid="draft-search"
          />
          {catalog === null ? (
            <div className="mt-3 text-sm text-nuffle-anthracite/70">Chargement…</div>
          ) : catalog.length === 0 ? (
            <div className="mt-3 text-sm text-nuffle-anthracite/70">Aucun résultat.</div>
          ) : (
            <ul
              className="mt-3 divide-y divide-nuffle-bronze/20 rounded-lg border border-nuffle-bronze/20 bg-white"
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
                        className="font-medium text-nuffle-anthracite hover:text-nuffle-gold"
                      >
                        {p.pseudonym}
                      </Link>
                      <p className="text-xs text-nuffle-anthracite/60">
                        {p.bbPosition} · {p.teamCode ?? "—"} ·{" "}
                        {p.totalSpp !== undefined
                          ? `${p.totalSpp.toFixed(1)} SPP`
                          : "—"}
                      </p>
                    </div>
                    {already ? (
                      <span className="text-xs text-nuffle-anthracite/60">déjà drafté</span>
                    ) : (
                      <button
                        disabled={busy === p.id}
                        onClick={() => draftPlayer(p)}
                        className="rounded-md bg-nuffle-gold px-3 py-1 text-xs font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80 disabled:opacity-50"
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

      <p className="text-xs text-nuffle-anthracite/60">
        V1 minimal : pas de draft snake interactif. Chaque coach drafte
        librement (free-form). La transition vers la saison est lancée
        par l&apos;admin une fois tous les coachs prêts.
      </p>
    </div>
  );
}
