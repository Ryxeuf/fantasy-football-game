/**
 * Pro League match broadcaster — sprint Pro League lot 1.B.1.
 *
 * Stream le replay binaire d'un `ProLeagueMatch` event-par-event vers
 * un ou plusieurs subscribers (consommé par l'endpoint SSE 1.B.2 et
 * le mode spectate Pixi 1.B.3).
 *
 * Architecture
 * ------------
 * - Une instance `MatchSession` par match actif. Chargée lazy à la
 *   première subscription.
 * - Décompresse `Replay.payload` (CBOR + gzip via sim-engine 1.A.2)
 *   en mémoire au démarrage de la session.
 * - Tick loop interne (`setInterval`, default 100ms) qui dispatch les
 *   events selon leur `displayAtMs` relatif à `startedAt` (wall-clock).
 * - `EventEmitter` interne pour fan-out vers N subscribers.
 * - Catch-up automatique : un subscriber qui rejoint après le T0
 *   reçoit en bulk tous les events déjà dispatchés, puis tail live.
 * - Auto-cleanup : quand tous les events sont dispatchés ET tous les
 *   subscribers ont disconnect, la session est libérée.
 *
 * Pas de Redis pub/sub au MVP — `EventEmitter` in-process suffit pour
 * un seul serveur. Le sprint mentionne Redis "si dispo", on le branchera
 * en Phase 2 si scaling horizontal devient nécessaire.
 *
 * Contrats
 * --------
 * - `subscribe(matchId, listener) → Promise<unsubscribe>` :
 *     * Charge la session si nécessaire (lazy).
 *     * Émet en bulk synchronously les events passés (catch-up).
 *     * Branche le listener sur l'emitter pour les events futurs.
 *     * Retourne une fonction `unsubscribe()` à appeler au cleanup.
 *
 * - Erreur si `Replay` introuvable (match jamais simulé) ou si le
 *   match a `status='failed'`.
 */

import { EventEmitter } from "node:events";

import { decompressEvents, type MatchEvent } from "@bb/sim-engine";

import { prisma } from "../prisma";

/** Fréquence du tick interne (ms). 100ms = précision visuelle suffisante. */
const TICK_INTERVAL_MS = 100;

/** Statuts de match qui empêchent le broadcast. */
const NON_BROADCASTABLE_STATUSES = new Set(["scheduled", "failed"]);

/** Event listener type — le subscriber reçoit chaque MatchEvent. */
export type MatchEventListener = (event: MatchEvent) => void;

interface MatchSession {
  readonly matchId: string;
  readonly events: readonly MatchEvent[];
  /** Wall-clock when the broadcast started. */
  readonly startedAt: number;
  /** Index of the next event to dispatch. */
  nextIndex: number;
  readonly emitter: EventEmitter;
  /** Number of currently-attached subscribers. */
  subscribers: number;
  timer?: NodeJS.Timeout;
}

const sessions = new Map<string, MatchSession>();

/**
 * Charge la session d'un match si elle n'existe pas encore. Décompresse
 * le replay et démarre le tick loop. Idempotent.
 */
async function ensureSession(matchId: string): Promise<MatchSession> {
  const existing = sessions.get(matchId);
  if (existing) return existing;

  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: { status: true },
  });
  if (!match) {
    throw new Error(`ProLeagueMatch '${matchId}' introuvable`);
  }
  if (NON_BROADCASTABLE_STATUSES.has(match.status as string)) {
    throw new Error(
      `ProLeagueMatch '${matchId}' status='${match.status}' n'est pas broadcastable`,
    );
  }

  const replay = await prisma.replay.findUnique({
    where: { matchId },
    select: { payload: true },
  });
  if (!replay) {
    throw new Error(`Replay '${matchId}' introuvable (match jamais simulé)`);
  }

  const events = await decompressEvents(replay.payload as Buffer);
  // Tri stable par displayAtMs (les events compressés sont déjà ordonnés
  // par construction du sim-engine — ce tri est défensif).
  const sorted = [...events].sort((a, b) => a.displayAtMs - b.displayAtMs);

  const session: MatchSession = {
    matchId,
    events: sorted,
    startedAt: Date.now(),
    nextIndex: 0,
    emitter: new EventEmitter(),
    subscribers: 0,
  };
  // Permet beaucoup de listeners (par défaut 10) — on cap à 1024.
  session.emitter.setMaxListeners(1024);
  sessions.set(matchId, session);

  startTickLoop(session);
  return session;
}

/**
 * Boucle interne qui dispatch les events selon leur `displayAtMs`
 * relatif à `session.startedAt`. Auto-stop quand tous les events
 * sont dispatchés.
 */
function startTickLoop(session: MatchSession): void {
  const tick = (): void => {
    const elapsed = Date.now() - session.startedAt;
    while (
      session.nextIndex < session.events.length &&
      session.events[session.nextIndex].displayAtMs <= elapsed
    ) {
      const ev = session.events[session.nextIndex];
      session.emitter.emit("event", ev);
      session.nextIndex += 1;
    }
    if (session.nextIndex >= session.events.length && session.timer) {
      clearInterval(session.timer);
      session.timer = undefined;
      maybeReap(session);
    }
  };
  session.timer = setInterval(tick, TICK_INTERVAL_MS);
  // Permet au process Node d'exit même si le tick tourne encore.
  session.timer.unref();
}

/**
 * Si plus de subscribers ET tous les events dispatchés → free la session
 * pour libérer la mémoire.
 */
function maybeReap(session: MatchSession): void {
  if (
    session.subscribers === 0 &&
    session.nextIndex >= session.events.length &&
    !session.timer
  ) {
    sessions.delete(session.matchId);
  }
}

/**
 * Subscribe à un match. Renvoie une fonction `unsubscribe()` à appeler
 * au cleanup (déconnexion SSE par ex.). Le listener reçoit en bulk les
 * events déjà dispatchés (catch-up) puis chaque nouvel event en live.
 */
export async function subscribeToMatch(
  matchId: string,
  listener: MatchEventListener,
): Promise<() => void> {
  const session = await ensureSession(matchId);

  // Catch-up : envoie tous les events déjà dispatchés (index < nextIndex).
  for (let i = 0; i < session.nextIndex; i += 1) {
    listener(session.events[i]);
  }

  session.emitter.on("event", listener);
  session.subscribers += 1;

  return () => {
    session.emitter.off("event", listener);
    session.subscribers -= 1;
    maybeReap(session);
  };
}

/**
 * Helper pour les routes admin / tests : force le démarrage d'une
 * session sans subscriber. Utile pour pré-warmer une session juste
 * avant un kickoff.
 */
export async function preloadMatch(matchId: string): Promise<void> {
  await ensureSession(matchId);
}

/**
 * Helper de test : libère toutes les sessions actives. À ne PAS exposer
 * aux routes — réservé aux tests qui veulent isoler des cas.
 */
export function __resetBroadcasterForTesting(): void {
  for (const session of sessions.values()) {
    if (session.timer) clearInterval(session.timer);
    session.emitter.removeAllListeners();
  }
  sessions.clear();
}

/**
 * Helper de monitoring : nombre de sessions actives + subscribers
 * total. Sert au lot 1.F.3 (Sentry / Grafana).
 */
export function getBroadcasterStats(): {
  activeSessions: number;
  totalSubscribers: number;
} {
  let totalSubscribers = 0;
  for (const session of sessions.values()) {
    totalSubscribers += session.subscribers;
  }
  return { activeSessions: sessions.size, totalSubscribers };
}
