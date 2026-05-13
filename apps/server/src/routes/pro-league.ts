/**
 * Pro League routes — sprint Pro League lot 1.B.2.
 *
 * Endpoint SSE :
 *
 *   GET /pro-league/matches/:id/stream
 *
 * Stream les events d'un match Pro League via Server-Sent Events.
 * Chaque event est envoyé avec :
 *   - `id: <event-index>` (sert de Last-Event-ID pour reconnexion)
 *   - `event: <MatchEvent.type>` (KICKOFF, TURN_START, BLOCK, …)
 *   - `data: <JSON.stringify(MatchEvent)>`
 *
 * Heartbeat toutes les 30s sous forme de commentaire SSE pour empêcher
 * les proxies de couper la connexion idle.
 *
 * Reconnection-friendly : si le client envoie `Last-Event-ID`, on
 * skippe les events dont l'index est ≤ cet id (le catch-up du
 * broadcaster les renvoie tous puis on filtre côté handler — moins
 * efficient mais simple ; à optimiser en lot 1.B.3 si besoin).
 *
 * Pas d'authentification au MVP (matchs Pro League sont publics) ;
 * sera ajouté en Phase 2 si on veut gating fan-only.
 */

import { Router, type Request, type Response } from "express";

import type { MatchEvent } from "@bb/sim-engine";

import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import {
  BetValidationError,
  MarketNotFoundError,
  listMarketsForMatch,
  listMyBets,
  placeBet,
} from "../services/pro-bet";
import {
  LeaderboardError,
  type LeaderboardPeriod,
  getBetLeaderboard,
} from "../services/pro-bet-leaderboard";
import {
  BADGE_CATALOGUE,
  evaluateBadgesForUser,
  getCatalogueWithStatus,
  listUserBadges,
} from "../services/pro-badges";
import {
  GazetteValidationError,
  listEditionDates,
  listEditionForDate,
  listLatestEdition,
} from "../services/pro-gazette";
import { listHallOfFame } from "../services/pro-hall-of-fame";
import {
  DEDICATE_COST_CROWNS,
  DedicateError,
  dedicateHallOfFame,
  listDedications,
} from "../services/pro-hall-of-fame-dedicate";
import {
  TournamentError,
  enterTournament,
  listOpenTournaments,
} from "../services/pro-tournament-entry";
import {
  InsufficientFundsError,
  getBalance,
  getRecentTransactions,
} from "../services/pro-wallet";
import {
  claimDailyBonus,
  getDailyBonusStatus,
  grantFirstTimeBonus,
} from "../services/pro-wallet-rewards";
import {
  ProTeamFollowError,
  followProTeam,
  getMyFeed,
  isFollowing,
  listMyFollows,
  unfollowProTeam,
} from "../services/pro-league-follow";
import {
  ProLeagueNotFoundError,
  getProLeagueHubSnapshot,
} from "../services/pro-league-hub";
import {
  getBroadcasterStats,
  subscribeToMatch,
} from "../services/pro-league-match-broadcaster";
import {
  ProLeagueStandingsNotFoundError,
  getProLeagueCurrentStandings,
} from "../services/pro-league-standings";
import {
  ProMatchNotFoundError,
  getProMatchDetail,
} from "../services/pro-league-match";
import {
  ReplayDumpError,
  getMatchFullReplayDump,
  getMatchReplayDump,
} from "../services/pro-league-replay";
import {
  ProTeamNotFoundError,
  getProTeamDetail,
} from "../services/pro-league-team";
import {
  TeamNotFoundError as RivalryTeamNotFoundError,
  getHeadToHead,
  getTopRivals,
} from "../services/pro-league-rivalry";
import {
  MvpError,
  getMvpCandidates,
  getVoteTally,
  getWeeklyMvpLeaderboard,
  submitVote,
} from "../services/pro-mvp-vote";
import {
  PredictionError as FanPredictionError,
  createOrUpdatePrediction,
  deletePrediction as deleteFanPrediction,
  getSeerLeaderboard,
  listPredictions as listFanPredictions,
} from "../services/pro-match-predictions";
import {
  ProPlayerNotFoundError,
  getProPlayerDetail,
} from "../services/pro-player-detail";
import {
  PlayerHistoryNotFoundError,
  getPlayerMatchHistory,
} from "../services/pro-player-match-history";
import {
  PlayerCareerNotFoundError,
  getCareerSnapshot,
} from "../services/pro-player-career-stats";
import { serverLog } from "../utils/server-log";

const HEARTBEAT_INTERVAL_MS = 30_000;

/** Sérialise un MatchEvent en bloc SSE prêt à être écrit sur le wire. */
function formatSse(eventIndex: number, event: MatchEvent): string {
  const data = JSON.stringify(event);
  return `id: ${eventIndex}\nevent: ${event.type}\ndata: ${data}\n\n`;
}

export async function handleStreamProMatch(
  req: Request,
  res: Response,
): Promise<void> {
  const matchId = req.params.id;
  if (!matchId || typeof matchId !== "string") {
    res.status(400).json({ error: "missing-match-id" });
    return;
  }

  // Last-Event-ID : pour la reconnexion.
  const lastEventIdHeader = req.header("Last-Event-ID");
  const lastEventId =
    lastEventIdHeader && /^\d+$/.test(lastEventIdHeader)
      ? Number.parseInt(lastEventIdHeader, 10)
      : -1;

  // SSE headers — flush immédiat pour empêcher les buffers reverse-proxy.
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // nginx
  // Indique au client le mode SSE.
  res.flushHeaders?.();

  let eventIndex = 0;
  let unsubscribe: (() => void) | undefined;
  let heartbeatTimer: NodeJS.Timeout | undefined;
  let closed = false;

  const cleanup = (): void => {
    if (closed) return;
    closed = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (unsubscribe) unsubscribe();
  };

  // Cleanup robuste : socket fermé client-side, erreur réseau, etc.
  req.on("close", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);

  try {
    unsubscribe = await subscribeToMatch(matchId, (ev) => {
      if (closed) return;
      const idx = eventIndex;
      eventIndex += 1;
      // Skip si Last-Event-ID indique que le client a déjà ces events.
      if (idx <= lastEventId) return;
      try {
        res.write(formatSse(idx, ev));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "unknown";
        serverLog.error(`[pro-league/stream] write failed: ${msg}`);
        cleanup();
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    // Si on a déjà flushé les headers, on ne peut plus envoyer un 4xx ;
    // on émet un event d'erreur SSE et on coupe.
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`);
      cleanup();
      res.end();
    } else {
      // Cas rare : pas encore flushé (avant le subscribeToMatch).
      const status = msg.includes("introuvable") ? 404 : 409;
      res.status(status).json({ error: msg });
    }
    return;
  }

  // Heartbeat SSE (commentaire, ignoré par les clients).
  heartbeatTimer = setInterval(() => {
    if (closed) return;
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      cleanup();
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();
}

/**
 * Endpoint admin léger pour monitoring : retourne le nombre de
 * sessions actives + total subscribers du broadcaster (lot 1.F.3).
 */
export function handleBroadcasterStats(_req: Request, res: Response): void {
  res.json(getBroadcasterStats());
}

/**
 * Sprint 1.G.1 — Dump complet du replay d'un match `completed`. Pour
 * matchs `in_progress` utiliser `/stream` (SSE). Pour `scheduled` /
 * `failed` la route renvoie 409.
 */
export async function handleGetMatchReplay(
  req: Request,
  res: Response,
): Promise<void> {
  const matchId = req.params.id;
  if (!matchId || typeof matchId !== "string") {
    res.status(400).json({ error: "missing-match-id" });
    return;
  }
  try {
    const dump = await getMatchReplayDump(matchId);
    res.json(dump);
  } catch (err: unknown) {
    if (err instanceof ReplayDumpError) {
      const status =
        err.code === "MATCH_NOT_REPLAYABLE"
          ? 409
          : err.code === "MATCH_NOT_FOUND" || err.code === "REPLAY_NOT_FOUND"
            ? 404
            : 500;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/matches/${matchId}/replay] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Lot 3.D.2 — dump du re-jeu visuel BB (initialState + moves + teams).
 * Le client `<MatchReplayPlayer>` Vue terrain rejoue les moves
 * step-by-step pour rendre le `<GameBoardWithDugouts>` à chaque
 * instant. 404 si pas dispo (hybrid driver, pré-3.D.1).
 */
export async function handleGetMatchFullReplay(
  req: Request,
  res: Response,
): Promise<void> {
  const matchId = req.params.id;
  if (!matchId || typeof matchId !== "string") {
    res.status(400).json({ error: "missing-match-id" });
    return;
  }
  try {
    const dump = await getMatchFullReplayDump(matchId);
    res.json(dump);
  } catch (err: unknown) {
    if (err instanceof ReplayDumpError) {
      const status =
        err.code === "MATCH_NOT_REPLAYABLE"
          ? 409
          : err.code === "MATCH_NOT_FOUND" ||
              err.code === "REPLAY_NOT_FOUND" ||
              err.code === "FULL_REPLAY_NOT_AVAILABLE"
            ? 404
            : 500;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(
      `[pro-league/matches/${matchId}/full-replay] failed: ${msg}`,
    );
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.C.1 — Snapshot agrégé pour la page d'accueil `/pro-league`.
 * Renvoie league + saison courante + round courant + prochains matchs
 * + classement top 8.
 */
export async function handleGetCurrentSeasonHub(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const data = await getProLeagueHubSnapshot();
    res.json(data);
  } catch (err: unknown) {
    if (err instanceof ProLeagueNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/seasons/current] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.C.5 — Classement détaillé de la saison courante.
 * Renvoie 16 entrées avec V/N/D, points, TD diff, casualties diff,
 * form (5 derniers résultats), rang.
 */
export async function handleGetCurrentSeasonStandings(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const data = await getProLeagueCurrentStandings();
    res.json(data);
  } catch (err: unknown) {
    if (err instanceof ProLeagueStandingsNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(
      `[pro-league/seasons/current/standings] failed: ${msg}`,
    );
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.C.2 — Détail d'une équipe Pro League : meta + record +
 * roster + 5 prochains matchs + 5 derniers matchs.
 */
export async function handleGetTeamDetail(
  req: Request,
  res: Response,
): Promise<void> {
  const slug = req.params.slug;
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "missing-slug" });
    return;
  }
  try {
    const data = await getProTeamDetail(slug);
    res.json(data);
  } catch (err: unknown) {
    if (err instanceof ProTeamNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/teams/${slug}] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint Q lot Q.A.3 — Top rivaux d'une team (par totalMatches desc).
 * Limit par defaut = 3, max = 10.
 */
export async function handleGetTeamRivalries(
  req: Request,
  res: Response,
): Promise<void> {
  const slug = req.params.slug;
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "missing-slug" });
    return;
  }
  const limitRaw = req.query.limit;
  let limit = 3;
  if (typeof limitRaw === "string" && /^\d+$/.test(limitRaw)) {
    limit = Math.min(10, Math.max(1, Number.parseInt(limitRaw, 10)));
  }
  try {
    const rivals = await getTopRivals(slug, limit);
    res.json({ rivals });
  } catch (err: unknown) {
    if (err instanceof RivalryTeamNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/teams/${slug}/rivalries] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint Q lot Q.A.3 — Detail head-to-head entre 2 teams.
 */
export async function handleGetHeadToHead(
  req: Request,
  res: Response,
): Promise<void> {
  const slug = req.params.slug;
  const opponentSlug = req.params.opponentSlug;
  if (!slug || !opponentSlug) {
    res.status(400).json({ error: "missing-slug" });
    return;
  }
  if (slug === opponentSlug) {
    res.status(400).json({ error: "same-team" });
    return;
  }
  try {
    const summary = await getHeadToHead(slug, opponentSlug);
    res.json({ summary });
  } catch (err: unknown) {
    if (err instanceof RivalryTeamNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(
      `[pro-league/teams/${slug}/head-to-head/${opponentSlug}] failed: ${msg}`,
    );
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Handler `GET /api/pro-league/players/:id` — Lot G.
 *
 * Public, pas d'auth. Renvoie l'agrégat fiche joueur :
 * identité + stats + bonuses + skills + progression + career +
 * skill access pools + meta équipe.
 */
export async function handleGetPlayerDetail(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "missing-id" });
    return;
  }
  try {
    const data = await getProPlayerDetail(id);
    res.json(data);
  } catch (err: unknown) {
    if (err instanceof ProPlayerNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/players/${id}] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Handler `GET /api/pro-league/players/:id/history` — Lot L.
 *
 * Renvoie les `?limit` (default 5, max 20) derniers matchs de l'équipe
 * du joueur avec le delta SPP (TD/CAS/COMP/MVP/total) gagné par le
 * joueur sur chaque match. Pour matchs sans replay, delta=0.
 */
export async function handleGetPlayerHistory(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "missing-id" });
    return;
  }
  const limitRaw = req.query.limit;
  const limit =
    typeof limitRaw === "string" && /^\d+$/.test(limitRaw)
      ? Number.parseInt(limitRaw, 10)
      : undefined;
  try {
    const data = await getPlayerMatchHistory(id, limit);
    res.json({ matches: data });
  } catch (err: unknown) {
    if (err instanceof PlayerHistoryNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/players/${id}/history] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint Q lot Q.A.1 — Snapshot career du joueur.
 * Compute lazy : recomputed si stale (> 1h).
 */
export async function handleGetPlayerCareer(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "missing-id" });
    return;
  }
  try {
    const snapshot = await getCareerSnapshot(id);
    res.json({ snapshot });
  } catch (err: unknown) {
    if (err instanceof PlayerCareerNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/players/${id}/career] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.C.3 — Détail d'un match Pro League (meta + équipes +
 * scoreboard + highlights). NB : pour les events temps réel,
 * utiliser `/pro-league/matches/:id/stream` (lot 1.B.2).
 */
export async function handleGetMatchDetail(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "missing-match-id" });
    return;
  }
  try {
    const data = await getProMatchDetail(id);
    res.json(data);
  } catch (err: unknown) {
    if (err instanceof ProMatchNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/matches/${id}] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

function mvpErrorStatus(code: MvpError["code"]): number {
  switch (code) {
    case "MATCH_NOT_FOUND":
      return 404;
    case "MATCH_NOT_COMPLETED":
    case "NO_CANDIDATES":
      return 422;
    case "VOTE_WINDOW_CLOSED":
    case "INVALID_CANDIDATE":
      return 409;
    default:
      return 500;
  }
}

/** Q.B.1 — GET /pro-league/matches/:id/mvp-candidates */
export async function handleGetMvpCandidates(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "missing-match-id" });
    return;
  }
  try {
    const candidates = await getMvpCandidates(id);
    res.json({ candidates });
  } catch (err: unknown) {
    if (err instanceof MvpError) {
      res.status(mvpErrorStatus(err.code)).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/matches/${id}/mvp-candidates] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/** Q.B.1 — GET /pro-league/matches/:id/mvp-tally */
export async function handleGetMvpTally(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "missing-match-id" });
    return;
  }
  try {
    const tally = await getVoteTally(id);
    res.json(tally);
  } catch (err: unknown) {
    if (err instanceof MvpError) {
      res.status(mvpErrorStatus(err.code)).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/matches/${id}/mvp-tally] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/** Q.B.1 — POST /pro-league/matches/:id/mvp-vote (auth) */
export async function handleSubmitMvpVote(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  const auth = req as AuthenticatedRequest;
  const userId = auth.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Non authentifie" });
    return;
  }
  if (!id) {
    res.status(400).json({ error: "missing-match-id" });
    return;
  }
  const body = (req.body ?? {}) as { votedRosterId?: unknown };
  if (typeof body.votedRosterId !== "string" || !body.votedRosterId) {
    res.status(400).json({ error: "missing-votedRosterId" });
    return;
  }
  try {
    const result = await submitVote({
      userId,
      matchId: id,
      votedRosterId: body.votedRosterId,
    });
    res.status(result.isUpdate ? 200 : 201).json(result);
  } catch (err: unknown) {
    if (err instanceof MvpError) {
      res.status(mvpErrorStatus(err.code)).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/matches/${id}/mvp-vote] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/** Q.B.1 — GET /pro-league/mvp/weekly */
export async function handleGetWeeklyMvp(
  req: Request,
  res: Response,
): Promise<void> {
  const limitRaw = req.query.limit;
  let limit = 10;
  if (typeof limitRaw === "string" && /^\d+$/.test(limitRaw)) {
    limit = Math.min(50, Math.max(1, Number.parseInt(limitRaw, 10)));
  }
  try {
    const entries = await getWeeklyMvpLeaderboard(limit);
    res.json({ entries });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/mvp/weekly] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Q.B.3 — Fan predictions thread
// ─────────────────────────────────────────────────────────────────────

function fanPredictionStatus(code: FanPredictionError["code"]): number {
  switch (code) {
    case "MATCH_NOT_FOUND":
    case "PREDICTION_NOT_FOUND":
      return 404;
    case "MATCH_LOCKED":
      return 409;
    case "BODY_EMPTY":
    case "BODY_TOO_LONG":
      return 400;
    case "NOT_OWNER":
      return 403;
    default:
      return 500;
  }
}

/** GET /pro-league/matches/:id/predictions (public). */
export async function handleListFanPredictions(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "missing-match-id" });
    return;
  }
  try {
    const list = await listFanPredictions(id);
    res.json({ predictions: list });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(
      `[pro-league/matches/${id}/predictions] failed: ${msg}`,
    );
    res.status(500).json({ error: "internal-error" });
  }
}

/** POST /pro-league/matches/:id/predictions (auth). */
export async function handleSubmitFanPrediction(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  const auth = req as AuthenticatedRequest;
  const userId = auth.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Non authentifie" });
    return;
  }
  if (!id) {
    res.status(400).json({ error: "missing-match-id" });
    return;
  }
  const body = (req.body ?? {}) as { body?: unknown };
  if (typeof body.body !== "string") {
    res.status(400).json({ error: "missing-body" });
    return;
  }
  try {
    const result = await createOrUpdatePrediction({
      matchId: id,
      userId,
      body: body.body,
    });
    res.status(result.isUpdate ? 200 : 201).json(result);
  } catch (err: unknown) {
    if (err instanceof FanPredictionError) {
      res
        .status(fanPredictionStatus(err.code))
        .json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(
      `[pro-league/matches/${id}/predictions POST] failed: ${msg}`,
    );
    res.status(500).json({ error: "internal-error" });
  }
}

/** DELETE /pro-league/matches/:id/predictions/me (auth). */
export async function handleDeleteFanPrediction(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  const auth = req as AuthenticatedRequest;
  const userId = auth.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Non authentifie" });
    return;
  }
  try {
    await deleteFanPrediction(id, userId);
    res.status(204).end();
  } catch (err: unknown) {
    if (err instanceof FanPredictionError) {
      res
        .status(fanPredictionStatus(err.code))
        .json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(
      `[pro-league/matches/${id}/predictions DELETE] failed: ${msg}`,
    );
    res.status(500).json({ error: "internal-error" });
  }
}

/** GET /pro-league/seers/weekly */
export async function handleGetSeerLeaderboard(
  req: Request,
  res: Response,
): Promise<void> {
  const limitRaw = req.query.limit;
  let limit = 10;
  if (typeof limitRaw === "string" && /^\d+$/.test(limitRaw)) {
    limit = Math.min(50, Math.max(1, Number.parseInt(limitRaw, 10)));
  }
  try {
    const entries = await getSeerLeaderboard(limit);
    res.json({ entries });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/seers/weekly] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.C.4 — Suivre une équipe Pro League. Idempotent.
 */
export async function handleFollowTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const slug = req.params.slug;
  if (!slug) {
    res.status(400).json({ error: "missing-slug" });
    return;
  }
  try {
    const data = await followProTeam(userId, slug);
    res.status(200).json(data);
  } catch (err: unknown) {
    if (err instanceof ProTeamFollowError && err.code === "team_not_found") {
      res.status(404).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/follow] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.C.4 — Ne plus suivre. Idempotent (200 même si pas de follow).
 */
export async function handleUnfollowTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const slug = req.params.slug;
  if (!slug) {
    res.status(400).json({ error: "missing-slug" });
    return;
  }
  try {
    const removed = await unfollowProTeam(userId, slug);
    res.status(200).json({ removed });
  } catch (err: unknown) {
    if (err instanceof ProTeamFollowError && err.code === "team_not_found") {
      res.status(404).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/unfollow] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.C.4 — Statut de suivi pour l'user courant. Pratique pour
 * initialiser le bouton "Follow" sur la page team sans charger toute
 * la liste.
 */
export async function handleIsFollowing(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const slug = req.params.slug;
  if (!slug) {
    res.status(400).json({ error: "missing-slug" });
    return;
  }
  const following = await isFollowing(userId, slug);
  res.json({ following });
}

/**
 * Sprint 1.C.4 — Liste des équipes suivies par l'user courant.
 */
export async function handleListMyFollows(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const follows = await listMyFollows(userId);
  res.json({ follows });
}

/**
 * Sprint 1.C.4 — Newsfeed perso (matchs upcoming + recent des équipes
 * suivies).
 */
export async function handleGetMyFeed(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const entries = await getMyFeed(userId);
  res.json({ entries });
}

/**
 * Sprint 1.D.4 — Liste les markets `open` d'un match (public).
 */
export async function handleListMarkets(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "missing-match-id" });
    return;
  }
  const markets = await listMarketsForMatch(id);
  res.json({ markets });
}

/**
 * Sprint 1.D.4 — Place un pari (auth-required, idempotent via
 * `clientToken`). Body : `{marketId, selection, stake, oddsAtPlace,
 * clientToken}`.
 */
export async function handlePlaceBet(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const body = req.body as Partial<{
    marketId: string;
    selection: string;
    stake: number;
    oddsAtPlace: number;
    clientToken: string;
  }>;
  if (
    !body ||
    typeof body.marketId !== "string" ||
    typeof body.selection !== "string" ||
    typeof body.stake !== "number" ||
    typeof body.oddsAtPlace !== "number" ||
    typeof body.clientToken !== "string"
  ) {
    res.status(400).json({ error: "invalid-body" });
    return;
  }

  try {
    const bet = await placeBet({
      userId,
      marketId: body.marketId,
      selection: body.selection,
      stake: body.stake,
      oddsAtPlace: body.oddsAtPlace,
      clientToken: body.clientToken,
    });
    res.status(201).json(bet);
  } catch (err: unknown) {
    if (err instanceof MarketNotFoundError) {
      res.status(404).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof BetValidationError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof InsufficientFundsError) {
      res.status(402).json({
        error: err.message,
        code: err.code,
        available: err.available,
        requested: err.requested,
      });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/bets] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.D.4 — Historique des paris de l'user courant (auth-required).
 * Query : `?limit=N` (default 50, max 200).
 */
export async function handleListMyBets(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const limitRaw = req.query.limit;
  const limit =
    typeof limitRaw === "string" ? Number.parseInt(limitRaw, 10) : 50;
  try {
    const bets = await listMyBets(userId, limit);
    res.json({ bets });
  } catch (err: unknown) {
    if (err instanceof BetValidationError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/me/bets] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint O (Lot O.C.3) — Catalogue public des badges (code + name +
 * description + emoji). Pas d'auth requis : sert au toast d'unlock
 * pour afficher le nom + emoji du badge debloque, sans dependre de
 * l'auth state du user.
 */
export function handleGetBadgeCatalogue(
  _req: Request,
  res: Response,
): void {
  res.json({
    badges: BADGE_CATALOGUE.map((b) => ({
      code: b.code,
      name: b.name,
      description: b.description,
      emoji: b.emoji,
    })),
  });
}

/**
 * Sprint 1.D.9 — Liste les badges + statut (earned/not) du user.
 */
export async function handleListMyBadges(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const earned = await listUserBadges(userId);
  const catalogue = await getCatalogueWithStatus(userId);
  res.json({ earned, catalogue });
}

/**
 * Sprint 1.D.9 — Évalue tous les criteria pour l'user et débloque
 * les nouveaux badges. Renvoie les codes débloqués cette fois.
 */
export async function handleEvaluateMyBadges(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  try {
    const newlyEarned = await evaluateBadgesForUser(userId);
    res.json({ newlyEarned });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/me/badges/evaluate] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.E.2 — Renvoie la dernière édition de la Gazette publiée.
 * 200 avec edition=null si aucun article.
 */
export async function handleGetLatestEdition(
  _req: Request,
  res: Response,
): Promise<void> {
  const edition = await listLatestEdition();
  res.json({ edition });
}

/**
 * Sprint 1.E.2 — Renvoie l'édition d'une date donnée (YYYY-MM-DD).
 */
export async function handleGetEditionByDate(
  req: Request,
  res: Response,
): Promise<void> {
  const date = req.params.date;
  if (typeof date !== "string") {
    res.status(400).json({ error: "missing-date" });
    return;
  }
  try {
    const edition = await listEditionForDate(date);
    res.json({ edition });
  } catch (err: unknown) {
    if (err instanceof GazetteValidationError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/gazette/${date}] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.E.5 — Liste paginée du Hall of Fame.
 * Query params : `?team=<slug>&limit=<n>`.
 */
export async function handleListHallOfFame(
  req: Request,
  res: Response,
): Promise<void> {
  const teamSlug =
    typeof req.query.team === "string" ? req.query.team : undefined;
  const limit =
    typeof req.query.limit === "string"
      ? Number.parseInt(req.query.limit, 10)
      : 50;
  try {
    const entries = await listHallOfFame({ teamSlug, limit });
    res.json({ entries });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/hall-of-fame] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint P (Lot P.B.2) — Liste publique des dedications d'une entree
 * Hall of Fame. Pas d'auth requise. Pagination via `?limit=N`.
 */
export async function handleListHallOfFameDedications(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "missing-id" });
    return;
  }
  const limit =
    typeof req.query.limit === "string"
      ? Number.parseInt(req.query.limit, 10)
      : 50;
  try {
    const dedications = await listDedications(id, limit);
    res.json({ dedications, costCrowns: DEDICATE_COST_CROWNS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(
      `[pro-league/hall-of-fame/${id}/dedications] failed: ${msg}`,
    );
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint P (Lot P.B.2) — Dedicace une entree HoF en payant 500 Crowns.
 * Auth requise. Body `{ message: string }` (max 280 chars).
 *
 * Codes erreur :
 *  - 400 INVALID_MESSAGE / MESSAGE_TOO_LONG
 *  - 402 WALLET_INSUFFICIENT_FUNDS (mapping cote handler)
 *  - 404 HOF_NOT_FOUND
 */
export async function handleDedicateHallOfFame(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const id = req.params.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "missing-id" });
    return;
  }
  const message = (req.body as { message?: unknown })?.message;
  if (typeof message !== "string") {
    res.status(400).json({ error: "INVALID_MESSAGE", code: "INVALID_MESSAGE" });
    return;
  }
  try {
    const out = await dedicateHallOfFame(userId, id, message);
    res.status(out.granted ? 201 : 200).json(out);
  } catch (err: unknown) {
    if (err instanceof DedicateError) {
      const status = err.code === "HOF_NOT_FOUND" ? 404 : 400;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof InsufficientFundsError) {
      res.status(402).json({
        error: err.message,
        code: "WALLET_INSUFFICIENT_FUNDS",
      });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(
      `[pro-league/hall-of-fame/${id}/dedicate] failed: ${msg}`,
    );
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Lot P.B.2 — Liste les tournois Pro League ouverts aux inscriptions.
 * Public (pas d'auth requis).
 */
export async function handleListTournaments(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const tournaments = await listOpenTournaments();
    res.json({ tournaments });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/tournaments] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Lot P.B.2 — Inscrit l'user courant a un tournoi (debit entry fee).
 * Auth requis. Idempotent : 200 si deja inscrit, 201 si nouvelle entry.
 */
export async function handleEnterTournament(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const id = req.params.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "missing-id" });
    return;
  }
  try {
    const out = await enterTournament(userId, id);
    res.status(out.granted ? 201 : 200).json(out);
  } catch (err: unknown) {
    if (err instanceof TournamentError) {
      const status =
        err.code === "TOURNAMENT_NOT_FOUND"
          ? 404
          : err.code === "TOURNAMENT_FULL"
            ? 409
            : 400;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof InsufficientFundsError) {
      res.status(402).json({
        error: err.message,
        code: "WALLET_INSUFFICIENT_FUNDS",
      });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(
      `[pro-league/tournaments/${id}/enter] failed: ${msg}`,
    );
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.E.2 — Liste les dates publiées (archive). `?limit=N`.
 */
export async function handleListEditionDates(
  req: Request,
  res: Response,
): Promise<void> {
  const limit =
    typeof req.query.limit === "string"
      ? Number.parseInt(req.query.limit, 10)
      : 30;
  try {
    const dates = await listEditionDates(limit);
    res.json({ dates });
  } catch (err: unknown) {
    if (err instanceof GazetteValidationError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/gazette/dates] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.D.6 — Snapshot wallet : solde + 20 dernières transactions.
 */
export async function handleGetMyWallet(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const balance = await getBalance(userId);
  const transactions = await getRecentTransactions(userId, 20);
  res.json({ balance, transactions });
}

/**
 * Sprint 1.D.6 — First-time bonus (1000 Crowns) — idempotent.
 */
export async function handleGrantFirstTimeBonus(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  try {
    const out = await grantFirstTimeBonus(userId);
    res.json(out);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/wallet/first-time] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.D.6 — Daily bonus (50 Crowns / 24h glissantes).
 */
export async function handleClaimDailyBonus(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  try {
    const out = await claimDailyBonus(userId);
    res.json(out);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/wallet/daily-bonus] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

/**
 * Sprint 1.D.6 — Statut daily bonus (sans rien crédit).
 */
export async function handleGetDailyBonusStatus(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const out = await getDailyBonusStatus(userId);
  res.json(out);
}

/**
 * Sprint 1.D.8 — Leaderboard parieurs (public).
 * Query : `?period=weekly|season|all-time&limit=N&offset=N`.
 */
export async function handleGetBetLeaderboard(
  req: Request,
  res: Response,
): Promise<void> {
  const period = (req.query.period ?? "season") as LeaderboardPeriod;
  const limit =
    typeof req.query.limit === "string"
      ? Number.parseInt(req.query.limit, 10)
      : 20;
  const offset =
    typeof req.query.offset === "string"
      ? Number.parseInt(req.query.offset, 10)
      : 0;
  try {
    const data = await getBetLeaderboard({ period, limit, offset });
    res.json(data);
  } catch (err: unknown) {
    if (err instanceof LeaderboardError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : "unknown";
    serverLog.error(`[pro-league/leaderboard] failed: ${msg}`);
    res.status(500).json({ error: "internal-error" });
  }
}

const router = Router();

router.get("/seasons/current", handleGetCurrentSeasonHub);
router.get("/seasons/current/standings", handleGetCurrentSeasonStandings);
router.get("/teams/:slug", handleGetTeamDetail);
router.get("/teams/:slug/rivalries", handleGetTeamRivalries);
router.get("/teams/:slug/head-to-head/:opponentSlug", handleGetHeadToHead);
router.get("/players/:id", handleGetPlayerDetail);
router.get("/players/:id/history", handleGetPlayerHistory);
router.get("/players/:id/career", handleGetPlayerCareer);
router.get("/matches/:id", handleGetMatchDetail);
router.get("/matches/:id/mvp-candidates", handleGetMvpCandidates);
router.get("/matches/:id/mvp-tally", handleGetMvpTally);
router.post("/matches/:id/mvp-vote", authUser, handleSubmitMvpVote);
router.get("/mvp/weekly", handleGetWeeklyMvp);
router.get("/matches/:id/predictions", handleListFanPredictions);
router.post("/matches/:id/predictions", authUser, handleSubmitFanPrediction);
router.delete(
  "/matches/:id/predictions/me",
  authUser,
  handleDeleteFanPrediction,
);
router.get("/seers/weekly", handleGetSeerLeaderboard);
router.get("/matches/:id/markets", handleListMarkets);
router.get("/matches/:id/stream", handleStreamProMatch);
router.get("/matches/:id/replay", handleGetMatchReplay);
router.get("/matches/:id/full-replay", handleGetMatchFullReplay);
router.get("/leaderboard", handleGetBetLeaderboard);
router.get("/gazette/latest", handleGetLatestEdition);
router.get("/gazette/dates", handleListEditionDates);
router.get("/gazette/:date", handleGetEditionByDate);
router.get("/hall-of-fame", handleListHallOfFame);
router.get(
  "/hall-of-fame/:id/dedications",
  handleListHallOfFameDedications,
);
router.post(
  "/hall-of-fame/:id/dedicate",
  authUser,
  handleDedicateHallOfFame,
);

// Lot P.B.2 — Tournois Pro League (sink Crowns).
router.get("/tournaments", handleListTournaments);
router.post(
  "/tournaments/:id/enter",
  authUser,
  handleEnterTournament,
);

router.get("/_internal/broadcaster-stats", handleBroadcasterStats);

// Sprint 1.C.4 — endpoints auth-protected pour le mode "fan".
router.post("/teams/:slug/follow", authUser, handleFollowTeam);
router.delete("/teams/:slug/follow", authUser, handleUnfollowTeam);
router.get("/teams/:slug/follow", authUser, handleIsFollowing);
router.get("/me/follows", authUser, handleListMyFollows);
router.get("/me/feed", authUser, handleGetMyFeed);

// Sprint 1.D.4 — endpoints paris.
router.post("/bets", authUser, handlePlaceBet);
router.get("/me/bets", authUser, handleListMyBets);

// Sprint 1.D.9 — badges/titres.
router.get("/badges", handleGetBadgeCatalogue);
router.get("/me/badges", authUser, handleListMyBadges);
router.post("/me/badges/evaluate", authUser, handleEvaluateMyBadges);

// Sprint 1.D.6 — wallet & bonuses.
router.get("/me/wallet", authUser, handleGetMyWallet);
router.post(
  "/me/wallet/first-time-bonus",
  authUser,
  handleGrantFirstTimeBonus,
);
router.post("/me/wallet/daily-bonus", authUser, handleClaimDailyBonus);
router.get("/me/wallet/daily-bonus", authUser, handleGetDailyBonusStatus);

export default router;
