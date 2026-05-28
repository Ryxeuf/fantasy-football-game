"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../lib/api-client";
import type { LeagueWithEntries } from "../../../types";
import { RaceIcon } from "../../../RaceIcon";

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
  readonly pseudonym: string | null;
  readonly bbPosition: string | null;
  readonly teamCode: string | null;
  readonly currentValue: number | null;
}

interface BudgetBreakdown {
  readonly draftBudget: number;
  readonly budgetSpent: number;
  readonly budgetRemaining: number;
  readonly budgetEngaged: number;
  readonly budgetAvailable: number;
}

interface MyBidsResponse {
  readonly myEntryId: string;
  readonly bids: MyBid[];
  readonly budget: BudgetBreakdown;
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

// Label FR par BbRace pour le filtre de race. `raceLabel` cote
// teams.json contient en fait le nom complet de l'equipe NFL
// ("Cleveland Dwarfs"), donc inutilisable comme label de race.
const BB_RACE_LABEL_FR: Readonly<Record<string, string>> = {
  Skaven: "Skavens",
  WoodElf: "Elfes Sylvains",
  Orc: "Orques",
  Human: "Humains",
  Norse: "Nordiques",
  Dwarf: "Nains",
  Khorne: "Khorne",
  Necromantic: "Necromantique",
};

interface TeamRow {
  readonly code: string;
  readonly city: string;
  readonly bbRace: string;
  readonly raceLabel: string;
}

interface TeamsResponse {
  readonly teams: TeamRow[];
}

// Positions BB exposees dans le filtre. Liste tiree de
// `packages/nfl-mapper/src/position-to-bb.ts:BbPosition` (29 valeurs).
// Hardcode plutot qu'un endpoint dedie : le set ne change qu'avec une
// modification de ruleset, donc le risque de drift est faible et le
// payload de page est plus leger.
const BB_POSITIONS = [
  "Lineman",
  "Thrower",
  "Catcher",
  "Blitzer",
  "Runner",
  "GutterRunner",
  "StormVermin",
  "RatOgre",
  "Wardancer",
  "Treeman",
  "BlackOrc",
  "Goblin",
  "Troll",
  "Ogre",
  "Berserker",
  "Ulfwerener",
  "Yhetee",
  "Blocker",
  "Trollslayer",
  "Deathroller",
  "Bloodseeker",
  "Khorngor",
  "Bloodspawn",
  "Bloodthirster",
  "Zombie",
  "Ghoul",
  "Wight",
  "FleshGolem",
  "Werewolf",
] as const;

interface FilterState {
  readonly search: string;
  readonly teamCode: string;
  readonly bbRace: string;
  readonly bbPosition: string;
  readonly jerseyNumber: string;
  readonly freeOnly: boolean;
  readonly sortBy: "currentValue" | "pseudonym" | "bbPosition" | "teamCode" | "jerseyNumber";
  readonly sortDir: "asc" | "desc";
}

const DEFAULT_FILTERS: FilterState = {
  search: "",
  teamCode: "",
  bbRace: "",
  bbPosition: "",
  jerseyNumber: "",
  freeOnly: true,
  sortBy: "currentValue",
  sortDir: "desc",
};

// ─── Composant ──────────────────────────────────────────────────────

export default function NuffleCoachDraftPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [league, setLeague] = useState<LeagueWithEntries | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<DraftSession[] | null>(null);
  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [budget, setBudget] = useState<BudgetBreakdown | null>(null);
  const [catalog, setCatalog] = useState<CatalogPlayer[] | null>(null);
  const [catalogTotal, setCatalogTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [teams, setTeams] = useState<TeamRow[]>([]);
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
      setBudget(null);
      return;
    }
    try {
      const out = await apiRequest<MyBidsResponse>(
        `/api/nfl-fantasy/draft-sessions/${activeSession.id}/my-bids`,
      );
      setMyBids(out.bids);
      setBudget(out.budget);
    } catch {
      setMyBids([]);
      setBudget(null);
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

  // Charge le catalogue des 32 equipes NFL une fois pour populer les
  // dropdowns equipe + race. Tres petit payload (~2 KB).
  useEffect(() => {
    let cancelled = false;
    async function loadTeams() {
      try {
        const out = await apiRequest<TeamsResponse>("/api/nfl-fantasy/teams");
        if (!cancelled) setTeams(out.teams);
      } catch {
        if (!cancelled) setTeams([]);
      }
    }
    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  // Catalogue (debounce search + tous les filtres / tri).
  // Reset page=1 quand les filtres ou le pageSize changent — eviter
  // de rester sur une page vide apres reduction du total.
  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      if (!leagueId) return;
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        params.set("seasonId", SEASON_ID);
        if (filters.search.trim()) params.set("search", filters.search.trim());
        if (filters.teamCode) params.set("teamCode", filters.teamCode);
        if (filters.bbRace) params.set("bbRace", filters.bbRace);
        if (filters.bbPosition) params.set("bbPosition", filters.bbPosition);
        if (filters.jerseyNumber.trim()) {
          params.set("jerseyNumber", filters.jerseyNumber.trim());
        }
        if (filters.freeOnly) params.set("excludeFromLeagueId", leagueId);
        params.set("sortBy", filters.sortBy);
        params.set("sortDir", filters.sortDir);
        const out = await apiRequest<CatalogResponse>(
          `/api/nfl-fantasy/players?${params.toString()}`,
        );
        if (!cancelled) {
          setCatalog(out.players);
          setCatalogTotal(out.total);
        }
      } catch {
        if (!cancelled) {
          setCatalog([]);
          setCatalogTotal(0);
        }
      }
    }
    const t = setTimeout(loadCatalog, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [leagueId, filters, page, pageSize]);

  // Liste des races uniques (codes BbRace) extraite des 32 equipes.
  // Le label affiche vient de BB_RACE_LABEL_FR — `t.raceLabel` est en
  // realite un nom d'equipe ("Cleveland Dwarfs"), inutilisable comme
  // label de race.
  const races = useMemo(() => {
    const seen = new Set<string>();
    for (const t of teams) seen.add(t.bbRace);
    return Array.from(seen)
      .map((code) => ({ code, label: BB_RACE_LABEL_FR[code] ?? code }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [teams]);

  // Lookup teamCode -> race pour afficher l'icone par joueur.
  const raceByTeamCode = useMemo(() => {
    const m = new Map<string, { bbRace: string; raceLabel: string }>();
    for (const t of teams) {
      m.set(t.code, { bbRace: t.bbRace, raceLabel: t.raceLabel });
    }
    return m;
  }, [teams]);

  function updateFilter<K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ): void {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters(): void {
    setFilters(DEFAULT_FILTERS);
  }

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
    const isFirst = (sessions ?? []).length === 0;
    const confirmMessage = isFirst
      ? "Démarrer le championnat ? Le compte à rebours de 48h démarre maintenant, et tous les coachs peuvent commencer à enchérir."
      : "Ouvrir une nouvelle session de mercato ? Le compte à rebours de 48h démarre immédiatement.";
    if (!window.confirm(confirmMessage)) return;
    setCreatingSession(true);
    setActionError(null);
    try {
      const now = Date.now();
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

  async function runBots(): Promise<void> {
    if (!activeSession) return;
    if (
      !window.confirm(
        "Lancer les bots ? Tous les coachs qui n'ont pas encore biddé sur cette session vont recevoir 12 enchères automatiques.",
      )
    )
      return;
    setBusy("bots");
    setActionError(null);
    try {
      const out = await apiRequest<{
        entriesProcessed: number;
        bidsCreated: number;
        bidsUpdated: number;
      }>(`/api/nfl-fantasy/draft-sessions/${activeSession.id}/bot-bids`, {
        method: "POST",
        body: JSON.stringify({ bidsPerEntry: 12 }),
      });
      window.alert(
        `Bots : ${out.entriesProcessed} coach(s) ont placé ${out.bidsCreated} nouvelle(s) enchère(s) (${out.bidsUpdated} mise(s) à jour).`,
      );
      await loadMyBids();
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
        <h1 className="text-xl font-semibold">Championnat introuvable</h1>
        <Link
          href="/nfl-fantasy"
          className="mt-4 inline-block text-sm text-nuffle-gold hover:text-nuffle-red"
        >
          ← Retour à mes championnats
        </Link>
      </div>
    );
  }

  if (!league) {
    return <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>;
  }

  const myBidsByPlayer = new Map(myBids.map((b) => [b.playerId, b]));
  const budgetAvailable = budget?.budgetAvailable ?? myEntry?.budgetRemaining ?? null;

  return (
    <div className="space-y-6" data-testid="nuffle-coach-draft">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${league.id}`}
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← Retour à le championnat
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
          Tu n&apos;es pas membre de ce championnat. Rejoins-la d&apos;abord pour
          participer au mercato.
        </div>
      )}

      {/* Budget : 4 cartes pour distinguer total / depense / engage / dispo */}
      {myEntry && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Budget total"
            value={budget ? `${budget.draftBudget} TV` : "—"}
            sub="Budget initial de la league"
          />
          <StatCard
            label="Déjà dépensé"
            value={budget ? `${budget.budgetSpent} TV` : "—"}
            sub={
              roster.length > 0
                ? `${roster.length} joueur${roster.length > 1 ? "s" : ""} recruté${roster.length > 1 ? "s" : ""}`
                : "Aucun recruté"
            }
          />
          <StatCard
            label="Engagé (modifiable)"
            value={budget ? `${budget.budgetEngaged} TV` : "—"}
            sub={`${myBids.length} bid${myBids.length > 1 ? "s" : ""} en cours`}
          />
          <StatCard
            label="Disponible"
            value={
              budgetAvailable !== null ? `${budgetAvailable} TV` : "—"
            }
            highlight
            sub={
              budgetAvailable !== null && budgetAvailable < 0
                ? "⚠ Overbooking — bids > budget restant"
                : "Pour de nouvelles enchères"
            }
          />
        </section>
      )}

      {/* Sessions */}
      <section>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-nuffle-anthracite">
              Sessions de mercato
            </h2>
            <Link
              href={`/nfl-fantasy/leagues/${leagueId}/draft/recap`}
              className="text-xs text-nuffle-gold hover:underline"
              data-testid="mercato-recap-link"
            >
              📜 Récap des résolutions →
            </Link>
          </div>
          {isOwner && !activeSession && (
            <button
              onClick={createSession}
              disabled={creatingSession}
              className="rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80 disabled:opacity-50"
            >
              {creatingSession
                ? "Démarrage…"
                : (sessions ?? []).length === 0
                  ? "🚀 Démarrer le championnat (48h)"
                  : "+ Ouvrir une nouvelle session 48h"}
            </button>
          )}
          {isOwner && activeSession && (
            <div className="flex gap-2">
              <button
                onClick={runBots}
                disabled={busy === "bots"}
                className="rounded-md border border-nuffle-bronze/40 px-3 py-1.5 text-sm font-medium text-nuffle-bronze hover:border-nuffle-bronze hover:bg-nuffle-bronze/10 disabled:opacity-50"
                data-testid="mercato-bot-bids-cta"
                title="Pose des enchères automatiques pour les coachs qui n'ont pas encore biddé sur cette session"
              >
                {busy === "bots" ? "Bots…" : "🤖 Lancer les bots"}
              </button>
              <button
                onClick={resolveCurrentSession}
                disabled={busy === "resolve"}
                className="rounded-md border border-nuffle-red px-3 py-1.5 text-sm font-medium text-nuffle-red hover:bg-nuffle-red hover:text-nuffle-ivory disabled:opacity-50"
              >
                {busy === "resolve" ? "Résolution…" : "🎲 Résoudre maintenant"}
              </button>
            </div>
          )}
        </div>
        {sessions === null && (
          <p className="mt-2 text-sm text-nuffle-anthracite/60">Chargement…</p>
        )}
        {sessions !== null && sessions.length === 0 && (
          <div className="mt-2 rounded-lg border border-dashed border-nuffle-bronze/30 bg-nuffle-ivory/40 p-4 text-sm text-nuffle-anthracite/80">
            <p>
              Aucune session de mercato n&apos;a encore été lancée. Le compte à
              rebours de 48h ne démarre qu&apos;une fois que tu cliques sur{" "}
              <strong>Démarrer le championnat</strong>.
            </p>
            {isOwner && (
              <p className="mt-2 text-xs text-nuffle-anthracite/60">
                Astuce : attends que tous les coachs aient rejoint le championnat
                avant de cliquer — sinon ils risquent de rater la première
                session.
              </p>
            )}
          </div>
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
        <CollapsibleSection
          title={`Mon roster · ${roster.length} joueur${roster.length > 1 ? "s" : ""}`}
          countBadge={null}
          openByDefaultOnDesktop
        >
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
              const race = raceByTeamCode.get(r.player.teamCode ?? "");
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
                      <RaceIcon
                        race={race?.bbRace}
                        label={race?.raceLabel}
                        className="mr-1"
                      />
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
        </CollapsibleSection>
      )}

      {/* Mes bids en cours */}
      {myEntry && activeSession && myBids.length > 0 && (
        <CollapsibleSection
          title="Mes enchères en cours"
          countBadge={myBids.length}
          openByDefaultOnDesktop
        >
          <ul
            className="mt-3 divide-y divide-nuffle-bronze/20 rounded-lg border border-nuffle-bronze/20 bg-white"
            data-testid="mercato-my-bids"
          >
            {myBids.map((b) => {
              const race = raceByTeamCode.get(b.teamCode ?? "");
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/nfl-fantasy/players/${b.playerId}?seasonId=${SEASON_ID}`}
                      className="font-medium text-nuffle-anthracite hover:text-nuffle-gold"
                    >
                      <RaceIcon
                        race={race?.bbRace}
                        label={race?.raceLabel}
                        className="mr-1"
                      />
                      {b.pseudonym ?? b.playerId}
                    </Link>
                    <p className="text-xs text-nuffle-anthracite/60">
                      {b.bbPosition ?? "—"}
                      {race?.raceLabel ? ` · ${race.raceLabel}` : ""} ·{" "}
                      {b.teamCode ?? "—"} · base {b.basePrice} TV
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-semibold text-nuffle-bronze">
                      {b.amount} TV
                    </span>
                    {b.currentValue !== null && b.currentValue !== b.amount && (
                      <div className="text-[10px] text-nuffle-anthracite/60">
                        cote {b.currentValue} TV
                      </div>
                    )}
                  </div>
                  <button
                    disabled={busy === b.playerId}
                    onClick={() => cancelBidAction(b.playerId)}
                    className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:border-red-400 disabled:opacity-50"
                  >
                    {busy === b.playerId ? "…" : "Annuler"}
                  </button>
                </li>
              );
            })}
          </ul>
        </CollapsibleSection>
      )}

      {/* Catalogue + place bid */}
      {myEntry && activeSession && (
        <section>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-nuffle-anthracite">
              Catalogue · saison {SEASON_ID}
            </h2>
            <p className="text-xs text-nuffle-anthracite/60">
              {catalog === null
                ? ""
                : `${catalogTotal} joueur${catalogTotal > 1 ? "s" : ""}${filters.freeOnly ? " libre" + (catalogTotal > 1 ? "s" : "") : ""}`}
            </p>
          </div>

          {/* Barre de filtres — essentiels visibles + Plus de filtres replie */}
          <div
            className="mt-3 rounded-lg border border-nuffle-bronze/20 bg-white p-3"
            data-testid="mercato-filters"
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                placeholder="Nom du joueur"
                className="rounded-md border border-nuffle-bronze/30 bg-white px-2 py-1.5 text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
                data-testid="mercato-search"
              />
              <select
                value={filters.bbRace}
                onChange={(e) => updateFilter("bbRace", e.target.value)}
                className="rounded-md border border-nuffle-bronze/30 bg-white px-2 py-1.5 text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
                data-testid="mercato-filter-race"
              >
                <option value="">Toutes races</option>
                {races.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.bbPosition}
                onChange={(e) => updateFilter("bbPosition", e.target.value)}
                className="rounded-md border border-nuffle-bronze/30 bg-white px-2 py-1.5 text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
                data-testid="mercato-filter-position"
              >
                <option value="">Tous postes</option>
                {BB_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-nuffle-anthracite">
                  <input
                    type="checkbox"
                    checked={filters.freeOnly}
                    onChange={(e) =>
                      updateFilter("freeOnly", e.target.checked)
                    }
                    className="accent-nuffle-gold"
                    data-testid="mercato-filter-free-only"
                  />
                  Libres uniquement
                </label>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-md border border-nuffle-bronze/30 px-2 py-1 text-xs text-nuffle-anthracite/70 hover:border-nuffle-gold hover:text-nuffle-bronze"
                  data-testid="mercato-filter-reset"
                >
                  Reset
                </button>
              </div>
            </div>

            <details className="mt-2" data-testid="mercato-filters-advanced">
              <summary className="cursor-pointer select-none text-xs font-medium text-nuffle-bronze hover:text-nuffle-anthracite">
                Plus de filtres (équipe, maillot, tri)
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  value={filters.teamCode}
                  onChange={(e) => updateFilter("teamCode", e.target.value)}
                  className="rounded-md border border-nuffle-bronze/30 bg-white px-2 py-1.5 text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
                  data-testid="mercato-filter-team"
                >
                  <option value="">Toutes équipes</option>
                  {teams.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} · {t.city}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={filters.jerseyNumber}
                  onChange={(e) => updateFilter("jerseyNumber", e.target.value)}
                  placeholder="N° maillot"
                  min={0}
                  max={99}
                  className="rounded-md border border-nuffle-bronze/30 bg-white px-2 py-1.5 text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
                />
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    updateFilter(
                      "sortBy",
                      e.target.value as FilterState["sortBy"],
                    )
                  }
                  className="rounded-md border border-nuffle-bronze/30 bg-white px-2 py-1.5 text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
                  data-testid="mercato-sort-by"
                >
                  <option value="currentValue">Tri : cote</option>
                  <option value="pseudonym">Tri : nom</option>
                  <option value="bbPosition">Tri : poste BB</option>
                  <option value="teamCode">Tri : équipe</option>
                  <option value="jerseyNumber">Tri : n° maillot</option>
                </select>
                <select
                  value={filters.sortDir}
                  onChange={(e) =>
                    updateFilter(
                      "sortDir",
                      e.target.value as FilterState["sortDir"],
                    )
                  }
                  className="rounded-md border border-nuffle-bronze/30 bg-white px-2 py-1.5 text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
                  data-testid="mercato-sort-dir"
                >
                  <option value="desc">↓ décroissant</option>
                  <option value="asc">↑ croissant</option>
                </select>
              </div>
            </details>
          </div>

          {catalog === null ? (
            <div className="mt-3 text-sm text-nuffle-anthracite/70">
              Chargement…
            </div>
          ) : catalog.length === 0 ? (
            <div className="mt-3 text-sm text-nuffle-anthracite/70">
              Aucun résultat. Essaie d&apos;élargir tes filtres.
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
                const race = raceByTeamCode.get(p.teamCode ?? "");
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
                        <RaceIcon
                          race={race?.bbRace}
                          label={race?.raceLabel}
                          className="mr-1"
                        />
                        {p.pseudonym}
                      </Link>
                      <p className="text-xs text-nuffle-anthracite/60">
                        {p.bbPosition}
                        {race?.raceLabel ? ` · ${race.raceLabel}` : ""} ·{" "}
                        {p.teamCode ?? "—"} ·{" "}
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

          {catalogTotal > 0 && (
            <CatalogPagination
              page={page}
              pageSize={pageSize}
              total={catalogTotal}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </section>
      )}

      {/* Modal bid */}
      {bidModalPlayer && (
        <BidModal
          player={bidModalPlayer}
          race={raceByTeamCode.get(bidModalPlayer.teamCode ?? "")}
          amount={bidAmount}
          setAmount={setBidAmount}
          budgetRemaining={budget?.budgetRemaining ?? myEntry?.budgetRemaining}
          budgetAvailable={budgetAvailable}
          existingBidAmount={myBidsByPlayer.get(bidModalPlayer.id)?.amount}
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
      className={`rounded-lg border p-2 sm:p-4 ${
        highlight
          ? "border-nuffle-gold/40 bg-nuffle-gold/5"
          : "border-nuffle-bronze/20 bg-white"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-nuffle-anthracite/60 sm:text-xs">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold text-nuffle-anthracite sm:mt-1 sm:text-xl">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[10px] text-nuffle-anthracite/60 sm:text-[11px]">
          {sub}
        </p>
      )}
    </div>
  );
}

function CollapsibleSection({
  title,
  countBadge,
  openByDefaultOnDesktop,
  children,
}: {
  title: string;
  countBadge: number | null;
  openByDefaultOnDesktop: boolean;
  children: React.ReactNode;
}) {
  // SSR-safe default = false (replie). Apres mount, on bascule a true
  // sur desktop (>=md = 768px) si `openByDefaultOnDesktop` est set.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!openByDefaultOnDesktop) return;
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    setOpen(mq.matches);
  }, [openByDefaultOnDesktop]);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left hover:bg-nuffle-cream/40"
        aria-expanded={open}
      >
        <h2 className="text-lg font-semibold text-nuffle-anthracite">
          {title}
          {countBadge !== null && (
            <span className="ml-2 rounded-full bg-nuffle-cream px-2 py-0.5 text-xs font-medium text-nuffle-bronze">
              {countBadge}
            </span>
          )}
        </h2>
        <span
          className={`text-xs text-nuffle-anthracite/60 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}

function CatalogPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (n: number) => void;
  onPageSizeChange: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const end = Math.min(clampedPage * pageSize, total);
  return (
    <div
      className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-nuffle-bronze/20 bg-white px-3 py-2 text-xs text-nuffle-anthracite/80"
      data-testid="mercato-pagination"
    >
      <span>
        {start}–{end} sur {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={clampedPage <= 1}
          onClick={() => onPageChange(1)}
          className="rounded border border-nuffle-bronze/30 px-2 py-1 hover:border-nuffle-bronze disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Première page"
        >
          «
        </button>
        <button
          type="button"
          disabled={clampedPage <= 1}
          onClick={() => onPageChange(clampedPage - 1)}
          className="rounded border border-nuffle-bronze/30 px-2 py-1 hover:border-nuffle-bronze disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹ Préc
        </button>
        <span className="px-1 tabular-nums">
          Page <strong>{clampedPage}</strong> / {totalPages}
        </span>
        <button
          type="button"
          disabled={clampedPage >= totalPages}
          onClick={() => onPageChange(clampedPage + 1)}
          className="rounded border border-nuffle-bronze/30 px-2 py-1 hover:border-nuffle-bronze disabled:cursor-not-allowed disabled:opacity-40"
        >
          Suiv ›
        </button>
        <button
          type="button"
          disabled={clampedPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="rounded border border-nuffle-bronze/30 px-2 py-1 hover:border-nuffle-bronze disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Dernière page"
        >
          »
        </button>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded border border-nuffle-bronze/30 bg-white px-2 py-1"
          aria-label="Nombre de joueurs par page"
        >
          <option value={20}>20 / page</option>
          <option value={30}>30 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>
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
  race,
  amount,
  setAmount,
  budgetRemaining,
  budgetAvailable,
  existingBidAmount,
  submitting,
  onCancel,
  onSubmit,
}: {
  player: CatalogPlayer;
  race: { bbRace: string; raceLabel: string } | undefined;
  amount: number;
  setAmount: (n: number) => void;
  budgetRemaining: number | undefined;
  budgetAvailable: number | null;
  existingBidAmount: number | undefined;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const min = player.basePrice ?? 50;
  // Le serveur valide amount > budgetRemaining (hors prise en compte
  // des autres bids — overbooking autorise). On aligne le slider sur
  // cette limite, mais on signale aussi le dispo reel pour eclairer
  // le choix du coach.
  const max = budgetRemaining ?? 5000;
  // Dispo reel apres cette enchere, si on remplace bid existant.
  const projectedAvailable =
    budgetAvailable !== null
      ? budgetAvailable + (existingBidAmount ?? 0) - amount
      : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-nuffle-anthracite">
          Enchère sur{" "}
          <RaceIcon
            race={race?.bbRace}
            label={race?.raceLabel}
            className="mr-1"
          />
          {player.pseudonym}
        </h3>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          {player.bbPosition} · {player.teamCode ?? "—"}
        </p>
        <p className="mt-3 text-xs text-nuffle-anthracite/60">
          Prix de base : <strong>{min} TV</strong> · Plafond serveur :{" "}
          <strong>{max} TV</strong>
        </p>
        {budgetAvailable !== null && (
          <p
            className={`mt-1 text-xs ${
              projectedAvailable !== null && projectedAvailable < 0
                ? "text-amber-700"
                : "text-nuffle-anthracite/60"
            }`}
          >
            Dispo hors enchères : <strong>{budgetAvailable} TV</strong>
            {projectedAvailable !== null && (
              <>
                {" "}· Après cette enchère :{" "}
                <strong>{projectedAvailable} TV</strong>
                {projectedAvailable < 0 && " ⚠ overbooking"}
              </>
            )}
          </p>
        )}
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
