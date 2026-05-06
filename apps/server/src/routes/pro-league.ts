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
  ProTeamNotFoundError,
  getProTeamDetail,
} from "../services/pro-league-team";
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

const router = Router();

router.get("/seasons/current", handleGetCurrentSeasonHub);
router.get("/seasons/current/standings", handleGetCurrentSeasonStandings);
router.get("/teams/:slug", handleGetTeamDetail);
router.get("/matches/:id/stream", handleStreamProMatch);
router.get("/_internal/broadcaster-stats", handleBroadcasterStats);

export default router;
