"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../lib/api-client";
import type { LeagueWithEntries } from "../../../types";

// ─── Types remontes par l'API ───────────────────────────────────────

interface DraftSession {
  readonly id: string;
  readonly sessionNumber: number;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly resolvedAt: string | null;
  readonly status: "open" | "resolving" | "resolved" | "cancelled";
}

interface SessionListResponse {
  readonly sessions: DraftSession[];
}

interface SessionDetailResponse {
  readonly session: DraftSession & { readonly leagueId: string };
  readonly bidCount?: number;
  readonly outcomes?: Array<{
    readonly playerId: string;
    readonly winnerEntryId: string;
    readonly winnerTeamName: string;
    readonly amount: number;
  }>;
}

interface MyBid {
  readonly id: string;
  readonly playerId: string;
  readonly amount: number;
  readonly status: string;
  readonly basePrice: number;
}

interface MyBidsResponse {
  readonly myEntryId: string;
  readonly bids: MyBid[];
}

interface RosterPlayer {
  readonly rosterId: string;
  readonly acquiredVia: string;
  readonly acquiredAt: string;
  readonly tvCost: number;
  readonly player: {
    readonly id: string;
    readonly pseudonym: string;
    readonly teamCode: string | null;
    readonly bbPosition: string;
    readonly jerseyNumber: number | null;
    readonly currentValue: number;
    readonly previousValue: number;
  } | null;
}

interface RosterResponse {
  readonly roster: RosterPlayer[];
}

interface CatalogPlayer {
  readonly id: string;
  readonly pseudonym: string;
  readonly teamCode: string | null;
  readonly bbPosition: string;
  readonly nflPosition: string;
  readonly status: string;
  readonly totalSpp?: number;
  readonly basePrice?: number;
  readonly currentValue?: number;
  readonly previousValue?: number;
}

interface CatalogResponse {
  readonly players: CatalogPlayer[];
  readonly total: number;
}

interface MeResponse {
  readonly user?: { id: string } | null;
}

const SEASON_ID = "2025";

// ─── Composant ──────────────────────────────────────────────────────

export default function NuffleCoachDraftPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [league, setLeague] = useState<LeagueWithEntries | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<DraftSession[] | null>(null);
  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [catalog, setCatalog] = useState<CatalogPlayer[] | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [search, setSearch] = useState<string>("");
  const [bidModalPlayer, setBidModalPlayer] = useState<CatalogPlayer | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );

  // Owner actions
  const [creatingSession, setCreatingSession] = useState(false);

  const myEntry = useMemo(
    () =>
      league && currentUserId
        ? league.entries.find((e) => e.userId === currentUserId) ?? null
        : null,
    [league, currentUserId],
  );
  const isOwner = league && currentUserId && league.ownerId === currentUserId;

  const activeSession = useMemo(
    () => (sessions ?? []).find((s) => s.status === "open") ?? null,
    [sessions],
  );

  // ─── Loads ──────────────────────────────────────────────────────

  const loadLeague = useCallback(async () => {
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

  const loadSessions = useCallback(async () => {
    if (!leagueId) return;
    try {
      const out = await apiRequest<SessionListResponse>(
        `/api/nfl-fantasy/draft-sessions/leagues/${leagueId}`,
      );
      setSessions(out.sessions);
    } catch {
      setSessions([]);
    }
  }, [leagueId]);

  const loadMyBids = useCallback(async () => {
    if (!activeSession) {
      setMyBids([]);
      return;
    }
    try {
      const out = await apiRequest<MyBidsResponse>(
        `/api/nfl-fantasy/draft-sessions/${activeSession.id}/my-bids`,
      );
      setMyBids(out.bids);
    } catch {
      setMyBids([]);
    }
  }, [activeSession]);

  const loadRoster = useCallback(async () => {
    if (!myEntry) {
      setRoster([]);
      return;
    }
    try {
      const out = await apiRequest<RosterResponse>(
        `/api/nfl-fantasy/entries/${myEntry.id}/roster`,
      );
      setRoster(out.roster);
    } catch {
      setRoster([]);
    }
  }, [myEntry]);

  useEffect(() => {
    void loadLeague();
  }, [loadLeague]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    void loadMyBids();
  }, [loadMyBids]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  // Catalogue (debounce search)
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
        if (!cancelled) setCatalog(out.players);
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

  // ─── Actions bids ───────────────────────────────────────────────

  function openBidModal(player: CatalogPlayer): void {
    const existing = myBids.find((b) => b.playerId === player.id);
    setBidAmount(existing?.amount ?? player.basePrice ?? 50);
    setBidModalPlayer(player);
    setActionError(null);
  }

  async function submitBid(): Promise<void> {
    if (!activeSession || !bidModalPlayer) return;
    setBusy(bidModalPlayer.id);
    setActionError(null);
    try {
      await apiRequest(
        `/api/nfl-fantasy/draft-sessions/${activeSession.id}/bids`,
        {
          method: "PUT",
          body: JSON.stringify({
            playerId: bidModalPlayer.id,
            amount: bidAmount,
          }),
        },
      );
      await loadMyBids();
      setBidModalPlayer(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  async function sellPlayerAction(rosterEntry: RosterPlayer): Promise<void> {
    if (!myEntry || !rosterEntry.player) return;
    const refund = rosterEntry.player.currentValue;
    const initial = rosterEntry.tvCost;
    const pnl = refund - initial;
    const sign = pnl >= 0 ? "+" : "";
    if (
      !window.confirm(
        `Vendre ${rosterEntry.player.pseudonym} ?\n\nPrix d'achat : ${initial} TV\nCote actuelle : ${refund} TV\nP&L : ${sign}${pnl} TV\n\nTu récupères ${refund} TV sur ton budget.`,
      )
    )
      return;
    setBusy(rosterEntry.player.id);
    setActionError(null);
    try {
      await apiRequest(
        `/api/nfl-fantasy/entries/${myEntry.id}/roster/${rosterEntry.player.id}/sell`,
        { method: "POST" },
      );
      await Promise.all([loadRoster(), loadLeague()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  async function cancelBidAction(playerId: string): Promise<void> {
    if (!activeSession) return;
    setBusy(playerId);
    setActionError(null);
    try {
      await apiRequest(
        `/api/nfl-fantasy/draft-sessions/${activeSession.id}/bids/${playerId}`,
        { method: "DELETE" },
      );
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        // deja annule, no-op
      } else {
        setActionError(err instanceof Error ? err.message : "Erreur");
      }
    } finally {
      await loadMyBids();
      setBusy(null);
    }
  }

  // ─── Actions owner ─────────────────────────────────────────────

  async function createSession(): Promise<void> {
    if (!leagueId) return;
    setCreatingSession(true);
    setActionError(null);
    try {
      const now = Date.now();
      // Session par defaut : ouverte maintenant, ferme dans 48h.
      const opensAt = new Date(now).toISOString();
      const closesAt = new Date(now + 48 * 3600 * 1000).toISOString();
      await apiRequest(
        `/api/nfl-fantasy/draft-sessions/leagues/${leagueId}`,
        {
          method: "POST",
          body: JSON.stringify({ opensAt, closesAt }),
        },
      );
      await loadSessions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreatingSession(false);
    }
  }

  async function resolveCurrentSession(): Promise<void> {
    if (!activeSession) return;
    if (
      !window.confirm(
        "Résoudre la session maintenant ? Les bids vont être traités et les rosters mis à jour.",
      )
    )
      return;
    setBusy("resolve");
    setActionError(null);
    try {
      await apiRequest(
        `/api/nfl-fantasy/draft-sessions/${activeSession.id}/resolve`,
        { method: "POST" },
      );
      await Promise.all([loadSessions(), loadMyBids(), loadLeague()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────

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
          className="mt-4 inline-block text-sm text-nuffle-gold hover:text-nuffle-red"
        >
          ← Retour à mes leagues
        </Link>
      </div>
    );
  }

  if (!league) {
    return <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>;
  }

  const myBidsByPlayer = new Map(myBids.map((b) => [b.playerId, b]));
  const totalCommitted = myBids.reduce((acc, b) => acc + b.amount, 0);
  const budgetRemaining = myEntry?.budgetRemaining;

  return (
    <div className="space-y-6" data-testid="nuffle-coach-draft">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${league.id}`}
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← Retour à la league
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Mercato</h1>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          {league.name} · Saison {league.seasonId} · Enchères secrètes
          asynchrones
        </p>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {!myEntry && (
        <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-4 text-sm text-nuffle-anthracite/80">
          Tu n&apos;es pas membre de cette league. Rejoins-la d&apos;abord pour
          participer au mercato.
        </div>
      )}

      {/* Budget + récap mes bids */}
      {myEntry && (
        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Budget restant"
            value={budgetRemaining !== undefined ? `${budgetRemaining} TV` : "—"}
            highlight
          />
          <StatCard
            label="Bids en cours"
            value={`${myBids.length}`}
            sub={`${totalCommitted} TV engagés`}
          />
          <StatCard
            label="Joueurs draftés"
            value={`${roster.length}`}
            sub={
              roster.length > 0
                ? `Valeur totale ${roster.reduce(
                    (acc, r) => acc + (r.player?.currentValue ?? 0),
                    0,
                  )} TV`
                : "Aucun encore"
            }
          />
        </section>
      )}

      {/* Sessions */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-nuffle-anthracite">
            Sessions de mercato
          </h2>
          {isOwner && !activeSession && (
            <button
              onClick={createSession}
              disabled={creatingSession}
              className="rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80 disabled:opacity-50"
            >
              {creatingSession ? "Création…" : "+ Ouvrir une session 48h"}
            </button>
          )}
          {isOwner && activeSession && (
            <button
              onClick={resolveCurrentSession}
              disabled={busy === "resolve"}
              className="rounded-md border border-nuffle-red px-3 py-1.5 text-sm font-medium text-nuffle-red hover:bg-nuffle-red hover:text-nuffle-ivory disabled:opacity-50"
            >
              {busy === "resolve" ? "Résolution…" : "🎲 Résoudre maintenant"}
            </button>
          )}
        </div>
        {sessions === null && (
          <p className="mt-2 text-sm text-nuffle-anthracite/60">Chargement…</p>
        )}
        {sessions !== null && sessions.length === 0 && (
          <p className="mt-2 text-sm text-nuffle-anthracite/60">
            Aucune session ouverte pour le moment.
            {isOwner && " Crée-en une pour démarrer."}
          </p>
        )}
        {sessions !== null && sessions.length > 0 && (
          <ul className="mt-3 divide-y divide-nuffle-bronze/20 rounded-lg border border-nuffle-bronze/20 bg-white">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-nuffle-anthracite">
                    Session #{s.sessionNumber}
                  </p>
                  <p className="text-xs text-nuffle-anthracite/60">
                    Ferme le {new Date(s.closesAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <SessionCountdown
                    closesAt={s.closesAt}
                    status={s.status}
                  />
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                      s.status === "open"
                        ? "bg-emerald-100 text-emerald-700"
                        : s.status === "resolved"
                          ? "bg-nuffle-bronze/10 text-nuffle-bronze"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mon roster (joueurs deja draftes) avec bouton Vendre */}
      {myEntry && roster.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-nuffle-anthracite">
            Mon roster · {roster.length} joueurs
          </h2>
          <p className="mt-1 text-xs text-nuffle-anthracite/60">
            Vendre un joueur te rend sa <strong>cote actuelle</strong>{" "}
            (pas le prix d&apos;achat). Si elle a monté, plus-value.
          </p>
          <ul
            className="mt-3 divide-y divide-nuffle-bronze/20 rounded-lg border border-nuffle-bronze/20 bg-white"
            data-testid="mercato-my-roster"
          >
            {roster.map((r) => {
              if (!r.player) return null;
              const current = r.player.currentValue;
              const initial = r.tvCost;
              const pnl = current - initial;
              const pnlSign = pnl > 0 ? "+" : "";
              return (
                <li
                  key={r.rosterId}
                  className="flex items-center justify-between gap-3 p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/nfl-fantasy/players/${r.player.id}?seasonId=${SEASON_ID}`}
                      className="font-medium text-nuffle-anthracite hover:text-nuffle-gold"
                    >
                      {r.player.pseudonym}
                    </Link>
                    <p className="text-xs text-nuffle-anthracite/60">
                      {r.player.bbPosition} · {r.player.teamCode ?? "—"} ·
                      acheté <strong>{initial} TV</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-semibold text-nuffle-anthracite">
                      {current} TV
                    </span>
                    {pnl !== 0 && (
                      <div
                        className={`text-[10px] font-medium ${
                          pnl > 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {pnlSign}
                        {pnl} TV
                      </div>
                    )}
                  </div>
                  <button
                    disabled={busy === r.player.id}
                    onClick={() => sellPlayerAction(r)}
                    className="rounded-md border border-nuffle-bronze/30 px-2 py-1 text-xs text-nuffle-anthracite hover:border-nuffle-red hover:text-nuffle-red disabled:opacity-50"
                  >
                    {busy === r.player.id ? "…" : "Vendre"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Mes bids en cours */}
      {myEntry && activeSession && myBids.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-nuffle-anthracite">
            Mes enchères en cours
          </h2>
          <ul
            className="mt-3 divide-y divide-nuffle-bronze/20 rounded-lg border border-nuffle-bronze/20 bg-white"
            data-testid="mercato-my-bids"
          >
            {myBids.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between p-3 text-sm"
              >
                <div>
                  <Link
                    href={`/nfl-fantasy/players/${b.playerId}?seasonId=${SEASON_ID}`}
                    className="font-medium text-nuffle-anthracite hover:text-nuffle-gold"
                  >
                    {b.playerId}
                  </Link>
                  <p className="text-xs text-nuffle-anthracite/60">
                    Bid : <strong>{b.amount} TV</strong> · base{" "}
                    {b.basePrice} TV
                  </p>
                </div>
                <button
                  disabled={busy === b.playerId}
                  onClick={() => cancelBidAction(b.playerId)}
                  className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:border-red-400 disabled:opacity-50"
                >
                  {busy === b.playerId ? "…" : "Annuler"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Catalogue + place bid */}
      {myEntry && activeSession && (
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
            data-testid="mercato-search"
          />
          {catalog === null ? (
            <div className="mt-3 text-sm text-nuffle-anthracite/70">
              Chargement…
            </div>
          ) : catalog.length === 0 ? (
            <div className="mt-3 text-sm text-nuffle-anthracite/70">
              Aucun résultat.
            </div>
          ) : (
            <ul
              className="mt-3 divide-y divide-nuffle-bronze/20 rounded-lg border border-nuffle-bronze/20 bg-white"
              data-testid="mercato-catalog"
            >
              {catalog.map((p) => {
                const existingBid = myBidsByPlayer.get(p.id);
                const current = p.currentValue ?? p.basePrice ?? 50;
                const previous = p.previousValue ?? current;
                const trendDelta = current - previous;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
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
                    <div className="text-right">
                      <span className="font-mono text-sm font-semibold text-nuffle-anthracite">
                        {current} TV
                      </span>
                      {trendDelta !== 0 && (
                        <span
                          className={`ml-1 text-[10px] font-medium ${
                            trendDelta > 0 ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {trendDelta > 0 ? "▲" : "▼"} {Math.abs(trendDelta)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => openBidModal(p)}
                      className={`rounded-md px-3 py-1 text-xs font-medium ${
                        existingBid
                          ? "border border-nuffle-gold bg-nuffle-gold/10 text-nuffle-bronze hover:bg-nuffle-gold/20"
                          : "bg-nuffle-gold text-nuffle-anthracite hover:bg-nuffle-gold/80"
                      }`}
                    >
                      {existingBid ? `Modifier (${existingBid.amount})` : "+ Enchère"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Modal bid */}
      {bidModalPlayer && (
        <BidModal
          player={bidModalPlayer}
          amount={bidAmount}
          setAmount={setBidAmount}
          budgetRemaining={budgetRemaining}
          submitting={busy === bidModalPlayer.id}
          onCancel={() => setBidModalPlayer(null)}
          onSubmit={submitBid}
        />
      )}

      <p className="text-xs text-nuffle-anthracite/60">
        💡 <strong>Comment ça marche</strong> : pendant qu&apos;une session
        est ouverte, tu pose des enchères secrètes sur les joueurs qui
        t&apos;intéressent. Personne ne voit ton bid. À la fermeture
        (résolution), le plus offrant remporte le joueur — en cas d&apos;égalité,
        c&apos;est le coach avec le plus petit roster (puis le plus petit
        budget) qui gagne. Les bids perdants ne sont pas facturés.
      </p>
    </div>
  );
}

// ─── Sous-composants ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-nuffle-gold/40 bg-nuffle-gold/5"
          : "border-nuffle-bronze/20 bg-white"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-nuffle-anthracite/60">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-nuffle-anthracite">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-nuffle-anthracite/60">{sub}</p>}
    </div>
  );
}

function SessionCountdown({
  closesAt,
  status,
}: {
  closesAt: string;
  status: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (status !== "open") return null;
  const diff = new Date(closesAt).getTime() - now;
  if (diff <= 0)
    return <span className="text-xs text-nuffle-red">Fermée — en attente</span>;
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return (
    <span className="font-mono text-xs text-nuffle-bronze">
      ⏳ {hours}h{String(minutes).padStart(2, "0")}m
    </span>
  );
}

function BidModal({
  player,
  amount,
  setAmount,
  budgetRemaining,
  submitting,
  onCancel,
  onSubmit,
}: {
  player: CatalogPlayer;
  amount: number;
  setAmount: (n: number) => void;
  budgetRemaining: number | undefined;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const min = player.basePrice ?? 50;
  const max = budgetRemaining ?? 5000;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-nuffle-anthracite">
          Enchère sur {player.pseudonym}
        </h3>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          {player.bbPosition} · {player.teamCode ?? "—"}
        </p>
        <p className="mt-3 text-xs text-nuffle-anthracite/60">
          Prix de base : <strong>{min} TV</strong> · Ton budget restant :{" "}
          <strong>{max} TV</strong>
        </p>
        <div className="mt-4 space-y-2">
          <label
            htmlFor="bid-amount"
            className="block text-sm font-medium text-nuffle-anthracite"
          >
            Montant de l&apos;enchère
          </label>
          <input
            id="bid-amount"
            type="number"
            min={min}
            max={max}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-md border border-nuffle-bronze/30 bg-white px-3 py-2 font-mono text-lg text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
          />
          <input
            type="range"
            min={min}
            max={Math.min(max, 1500)}
            step={10}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-nuffle-gold"
          />
        </div>
        <p className="mt-3 rounded-md bg-nuffle-gold/5 px-3 py-2 text-xs text-nuffle-anthracite/70">
          🤫 Cette enchère reste <strong>secrète</strong> jusqu&apos;à la
          résolution de la session. Si tu ne remportes pas le joueur, ton
          budget n&apos;est <strong>pas</strong> impacté.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-nuffle-bronze/30 px-3 py-1.5 text-sm text-nuffle-anthracite hover:border-nuffle-bronze"
          >
            Annuler
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || amount < min || amount > max}
            className="rounded-md bg-nuffle-gold px-4 py-1.5 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80 disabled:opacity-50"
          >
            {submitting ? "Envoi…" : `Poser ${amount} TV`}
          </button>
        </div>
      </div>
    </div>
  );
}
