/**
 * Pro League roster casualties post-process — sprint 1.E.4.
 *
 * Hook post-match : pour chaque ProLeagueMatch `completed`, lit le
 * Replay et compte les `CASUALTY` events par côté (home / away) en
 * inspectant le préfixe du `playerId` synthétique (ex: "home-LOS",
 * "away-NUFFLE-1-3"). Pour chaque côté, sélectionne aléatoirement
 * `casualtyCount` joueurs `active` du roster et applique un outcome
 * tiré au sort selon la table de blessures BB :
 *
 *   50% niggling (n+1)
 *   25% MA-1
 *   12% ST-1
 *    8% AV-1
 *    5% dead   → status='dead', retire de l'active roster
 *
 * Tirage RNG seedé par `match.id` pour déterminisme replay.
 * Idempotent via `ProLeagueMatch.casualtiesAppliedAt` (seul appel
 * effectif si null).
 *
 * Si le roster est vide (cas MVP courant — 1.E.6 rookie pipeline pas
 * encore livré), no-op silencieux (renvoie `affected: 0`).
 *
 * Ce service ne consomme PAS le sim-engine — uniquement la DB +
 * `decompressEvents` du sim-engine pour parser le Replay.
 */

import { decompressEvents } from "@bb/sim-engine";

import { prisma } from "../prisma";

export type CasualtyOutcome =
  | "niggling"
  | "ma_minus_1"
  | "st_minus_1"
  | "av_minus_1"
  | "dead";

export class CasualtyApplicationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CasualtyApplicationError";
  }
}

export interface AppliedCasualty {
  readonly side: "home" | "away";
  readonly rosterId: string;
  readonly playerName: string;
  readonly outcome: CasualtyOutcome;
}

export interface ApplyCasualtiesResult {
  readonly matchId: string;
  readonly skipped: boolean;
  /** "no_roster" / "no_casualties" / null si appliqué */
  readonly skipReason: string | null;
  readonly homeCasualties: number;
  readonly awayCasualties: number;
  readonly affected: number;
  readonly outcomes: readonly AppliedCasualty[];
}

/** Hash FNV1a 32-bit pour seed RNG (cohérent avec sim-runner). */
function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * RNG mulberry32 — petit, déterministe, suffisant pour des tirages
 * stochastiques de casualty outcomes (pas crypto).
 */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Tire un outcome casualty selon la table décrite dans le module.
 * Pure : prend un random ∈ [0, 1).
 */
export function rollCasualtyOutcome(rand: number): CasualtyOutcome {
  if (rand < 0.5) return "niggling";
  if (rand < 0.75) return "ma_minus_1";
  if (rand < 0.87) return "st_minus_1";
  if (rand < 0.95) return "av_minus_1";
  return "dead";
}

/**
 * Compte les casualties par côté en inspectant le préfixe du
 * `playerId` synthétique dans les events. Pure (consomme un array
 * d'events). Le sim émet la victime (= côté qui subit).
 *
 * Lot 3.C.1 — quand le full driver pousse des rosters réels via
 * `SimInput.home.roster`, les playerId sont des `ProTeamRoster.id`
 * (CUID) sans préfixe. Le compteur prend en compte aussi
 * `meta.team` (`'home' | 'away'`) qui est toujours émis depuis
 * lot 3.A.2.b (full-driver-events:194).
 */
export function countCasualtiesPerSide(
  events: readonly unknown[],
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const e = ev as { type?: unknown; meta?: unknown };
    if (e.type !== "CASUALTY") continue;
    const meta = (e.meta ?? {}) as { playerId?: unknown; team?: unknown };
    // Lot 3.C.1 — priorité au champ `team` (toujours émis), fallback
    // sur le préfixe synthétique pour les vieux replays hybrid.
    if (meta.team === "home") {
      home += 1;
      continue;
    }
    if (meta.team === "away") {
      away += 1;
      continue;
    }
    if (typeof meta.playerId !== "string") continue;
    if (meta.playerId.startsWith("home-")) home += 1;
    else if (meta.playerId.startsWith("away-")) away += 1;
  }
  return { home, away };
}

interface RosterPick {
  readonly id: string;
  readonly name: string;
  readonly maReduction: number;
  readonly stReduction: number;
  readonly avReduction: number;
  readonly niggling: number;
}

/**
 * Sélectionne `count` rosters distincts dans `pool` via Fisher-Yates
 * partiel seedé par `rng`.
 */
function pickRandomRosters<T extends { id: string }>(
  pool: readonly T[],
  count: number,
  rng: () => number,
): T[] {
  if (count <= 0 || pool.length === 0) return [];
  const arr = [...pool];
  const n = Math.min(count, arr.length);
  for (let i = 0; i < n; i += 1) {
    const j = i + Math.floor(rng() * (arr.length - i));
    if (j !== i) {
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }
  return arr.slice(0, n);
}

function applyOutcomeToData(
  outcome: CasualtyOutcome,
  current: RosterPick,
): {
  data: Partial<{
    niggling: number;
    maReduction: number;
    stReduction: number;
    avReduction: number;
    status: string;
  }>;
} {
  switch (outcome) {
    case "niggling":
      return { data: { niggling: current.niggling + 1 } };
    case "ma_minus_1":
      return { data: { maReduction: current.maReduction + 1 } };
    case "st_minus_1":
      return { data: { stReduction: current.stReduction + 1 } };
    case "av_minus_1":
      return { data: { avReduction: current.avReduction + 1 } };
    case "dead":
      return { data: { status: "dead" } };
  }
}

/**
 * Status acceptés pour le post-process casualty (Lot 3.C.1).
 *
 * `'ready'` = match simulé, en attente de broadcast (status par défaut
 * apres `simulateProMatch`). En prod aucun mécanisme automatique ne le
 * transitionne vers `'completed'` — donc la sweep DOIT inclure `ready`
 * pour fonctionner.
 *
 * `'completed'` = match terminé (broadcast fini ou seed direct).
 * Conservé pour rétrocompat avec les seeds de dev.
 */
const POST_SIM_STATUSES = new Set(["ready", "completed"]);

/**
 * Détecte si un `playerId` est synthétique (`'home-LOS'`, `'away-3'`,
 * etc.) ou s'il s'agit d'un `ProTeamRoster.id` réel (CUID).
 *
 * Discriminer purement par le préfixe : tout ID qui ne commence pas
 * par `home-` ou `away-` est traité comme un CUID candidat. Un CUID
 * commence par `c` + 24 caractères hex/base32 — mais on n'impose pas
 * cette regex stricte ici : la lookup DB échouera et on tombera en
 * fallback random.
 */
function isSyntheticPlayerId(playerId: string): boolean {
  return playerId.startsWith("home-") || playerId.startsWith("away-");
}

/**
 * Applique les casualties d'un match `ready` ou `completed` sur les
 * rosters concernés. Idempotent via `casualtiesAppliedAt`.
 *
 * Lot 3.C.1 — la fonction lit individuellement chaque CASUALTY event
 * et préfère cibler le `playerId` réel (CUID = `ProTeamRoster.id`)
 * quand le full driver l'émet. Sinon, fallback sur le pick random
 * legacy parmi les actifs de l'équipe.
 */
export async function applyMatchCasualties(
  matchId: string,
): Promise<ApplyCasualtiesResult> {
  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      casualtiesAppliedAt: true,
      casualtyCount: true,
      homeTeamId: true,
      awayTeamId: true,
      replayId: true,
    },
  });
  if (!match) {
    throw new CasualtyApplicationError(
      "MATCH_NOT_FOUND",
      `ProLeagueMatch '${matchId}' introuvable`,
    );
  }
  if (!POST_SIM_STATUSES.has(match.status as string)) {
    throw new CasualtyApplicationError(
      "MATCH_NOT_COMPLETED",
      `Match status='${match.status}' — casualties post-process réservé aux matchs ready/completed`,
    );
  }
  if (match.casualtiesAppliedAt) {
    return {
      matchId,
      skipped: true,
      skipReason: "already_applied",
      homeCasualties: 0,
      awayCasualties: 0,
      affected: 0,
      outcomes: [],
    };
  }
  if (!match.casualtyCount || match.casualtyCount === 0) {
    // Marque applied pour ne pas re-checker.
    await prisma.proLeagueMatch.update({
      where: { id: matchId },
      data: { casualtiesAppliedAt: new Date() },
    });
    return {
      matchId,
      skipped: true,
      skipReason: "no_casualties",
      homeCasualties: 0,
      awayCasualties: 0,
      affected: 0,
      outcomes: [],
    };
  }

  // Charge le replay pour répartir.
  const replay = await prisma.replay.findUnique({
    where: { matchId: matchId },
    select: { payload: true },
  });
  if (!replay) {
    throw new CasualtyApplicationError(
      "REPLAY_NOT_FOUND",
      `Replay manquant pour match '${matchId}' — impossible de répartir`,
    );
  }
  const events = await decompressEvents(replay.payload as Buffer);
  const { home, away } = countCasualtiesPerSide(events);

  const homeTeamId = match.homeTeamId as string;
  const awayTeamId = match.awayTeamId as string;

  // Lot 3.C.1 — extraction event-par-event au lieu du compteur global.
  // Chaque CASUALTY event porte (playerId, team) ; pour les playerId
  // réels (CUID matching `ProTeamRoster.id`) on cible directement,
  // sinon fallback sur pick random côté équipe.
  type CasualtyTarget = {
    readonly side: "home" | "away";
    readonly playerId: string;
    readonly synthetic: boolean;
  };
  const targets: CasualtyTarget[] = [];
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const e = ev as { type?: unknown; meta?: unknown };
    if (e.type !== "CASUALTY") continue;
    const meta = (e.meta ?? {}) as { playerId?: unknown; team?: unknown };
    if (typeof meta.playerId !== "string") continue;
    const synthetic = isSyntheticPlayerId(meta.playerId);
    let side: "home" | "away" | null = null;
    if (meta.team === "home" || meta.team === "away") {
      side = meta.team;
    } else if (synthetic) {
      side = meta.playerId.startsWith("home-") ? "home" : "away";
    }
    if (!side) continue;
    targets.push({ side, playerId: meta.playerId, synthetic });
  }

  const rng = mulberry32(hashSeed(`cas:${matchId}`));
  const outcomes: AppliedCasualty[] = [];

  // Cache du roster par teamId pour éviter une lookup par event.
  const rosterCache = new Map<string, RosterPick[]>();
  const loadRoster = async (teamId: string): Promise<RosterPick[]> => {
    const cached = rosterCache.get(teamId);
    if (cached) return cached;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roster = (await prisma.proTeamRoster.findMany({
      where: { teamId, status: "active" },
      select: {
        id: true,
        name: true,
        niggling: true,
        maReduction: true,
        stReduction: true,
        avReduction: true,
      },
    })) as RosterPick[];
    rosterCache.set(teamId, roster);
    return roster;
  };

  for (const target of targets) {
    const teamId = target.side === "home" ? homeTeamId : awayTeamId;
    const roster = await loadRoster(teamId);
    if (roster.length === 0) continue;

    // 1) Cherche le `playerId` réel sur le roster de la team.
    const directHit = !target.synthetic
      ? roster.find((r) => r.id === target.playerId)
      : undefined;

    // 2) Sinon (synthétique OU CUID orphan) → pick random parmi les
    //    actifs encore non touchés dans ce match.
    const alreadyHitIds = new Set(
      outcomes
        .filter((o) => o.side === target.side)
        .map((o) => o.rosterId),
    );
    const picked: RosterPick | undefined =
      directHit ??
      pickRandomRosters(
        roster.filter((r) => !alreadyHitIds.has(r.id)),
        1,
        rng,
      )[0];
    if (!picked) continue;

    const outcome = rollCasualtyOutcome(rng());
    const { data } = applyOutcomeToData(outcome, picked);
    await prisma.proTeamRoster.update({
      where: { id: picked.id },
      data,
    });
    outcomes.push({
      side: target.side,
      rosterId: picked.id,
      playerName: picked.name,
      outcome,
    });
  }

  await prisma.proLeagueMatch.update({
    where: { id: matchId },
    data: { casualtiesAppliedAt: new Date() },
  });

  return {
    matchId,
    skipped: false,
    skipReason: null,
    homeCasualties: home,
    awayCasualties: away,
    affected: outcomes.length,
    outcomes,
  };
}

/**
 * Cron sweep : trouve les matchs `ready` ou `completed` avec
 * `casualtiesAppliedAt` null et applique. Erreur par match isolée.
 * Limit 50.
 *
 * Lot 3.C.1 — accepte `'ready'` parce qu'en prod aucun process ne
 * transitionne automatiquement `ready -> completed`. Sans ce filtre,
 * la sweep ne traitait jamais aucun match en pratique.
 */
export async function sweepMatchCasualties(): Promise<{
  inspected: number;
  processed: number;
  failed: number;
}> {
  const candidates = await prisma.proLeagueMatch.findMany({
    where: {
      status: { in: ["ready", "completed"] },
      casualtiesAppliedAt: null,
      // Lot 2.C.3 — sandbox matchs n'appliquent pas leurs casualties
      // au roster (sinon les coachs subiraient des absences sur des
      // matchs qui ne devraient avoir aucun impact).
      isTest: false,
    },
    select: { id: true },
    orderBy: { simulatedAt: "asc" },
    take: 50,
  });
  let processed = 0;
  let failed = 0;
  for (const { id } of candidates) {
    try {
      await applyMatchCasualties(id as string);
      processed += 1;
    } catch {
      failed += 1;
    }
  }
  return { inspected: candidates.length, processed, failed };
}
