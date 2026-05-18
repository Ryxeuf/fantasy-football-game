/**
 * Service SPP / progression (Lot 3.C.2).
 *
 * Apres un match `ready` ou `completed`, attribue les Star Player
 * Points BB :
 *
 *   - Completion : 1 SPP au passeur sur PASS event success=true ET
 *     range != 'handoff' (les handoffs ne valent pas de SPP en BB).
 *   - Casualty caused : 2 SPP au causedById quand le sim le remplit
 *     (hybrid driver le fait via meta.causedBy ; le full driver pas
 *     encore — no-op pour lui jusqu'a ce qu'il propage le killer).
 *   - MVP : 4 SPP a 1 joueur eligible random par team, deterministe
 *     via le seed du match.
 *   - TD : SKIP pour cette V1 — les TD events n'ont pas de scorerId.
 *     Sera ajoute quand le full driver propagera le carrierId au
 *     moment du score.
 *
 * Idempotence via `proLeagueMatch.sppAppliedAt`. Pattern aligne sur
 * `pro-roster-casualties.ts` : meme statuts cibles, meme cron.
 *
 * Pure : `attributeSpp` est testable sans DB. `applyMatchSpp` /
 * `sweepMatchSpp` font les I/O et reposent sur `attributeSpp`.
 */

import { prisma } from "../prisma";
import { decompressEvents } from "@bb/sim-engine";

/** Table des SPP par event-type (BB rules officielles). */
export const SPP_VALUES = {
  td: 3,
  cas: 2,
  comp: 1,
  mvp: 4,
} as const;

export type SppErrorCode =
  | "MATCH_NOT_FOUND"
  | "MATCH_NOT_READY"
  | "REPLAY_NOT_FOUND";

export class SppApplicationError extends Error {
  constructor(
    public readonly code: SppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SppApplicationError";
  }
}

export interface SppReward {
  readonly rosterId: string;
  readonly side: "home" | "away";
  readonly tdCount: number;
  readonly casCount: number;
  readonly compCount: number;
  readonly mvpCount: number;
  readonly totalSpp: number;
}

export interface AttributeSppInput {
  readonly seed: number;
  readonly events: readonly unknown[];
  readonly casualties: ReadonlyArray<{
    readonly playerId: string;
    readonly team: string;
    readonly causedById?: string;
    readonly outcome: string;
  }>;
  readonly homeRosterIds: ReadonlySet<string>;
  readonly awayRosterIds: ReadonlySet<string>;
}

export interface AttributeSppResult {
  readonly rewards: readonly SppReward[];
}

const POST_SIM_STATUSES = new Set(["ready", "completed"]);

/**
 * CUID canonique = `c` + 24 caracteres alphanumeriques. On accepte
 * tout ID qui ne commence pas par `home-` / `away-` comme candidat
 * (cf. la meme heuristique dans casualty applier). Defense-in-depth :
 * la lookup contre `homeRosterIds`/`awayRosterIds` filtre les
 * orphelins.
 */
function isSyntheticId(id: string): boolean {
  return id.startsWith("home-") || id.startsWith("away-");
}

/** PRNG seede deterministe (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pure : a partir du replay events + casualties + rosters, retourne
 * la liste des rewards par rosterId. Aucune I/O.
 */
export function attributeSpp(
  input: AttributeSppInput,
): AttributeSppResult {
  type Acc = {
    side: "home" | "away";
    tdCount: number;
    casCount: number;
    compCount: number;
    mvpCount: number;
  };
  const acc = new Map<string, Acc>();
  const sideOf = (id: string): "home" | "away" | null => {
    if (input.homeRosterIds.has(id)) return "home";
    if (input.awayRosterIds.has(id)) return "away";
    return null;
  };
  const bump = (
    id: string,
    field: "tdCount" | "casCount" | "compCount" | "mvpCount",
  ): void => {
    const side = sideOf(id);
    if (!side) return;
    const cur = acc.get(id) ?? {
      side,
      tdCount: 0,
      casCount: 0,
      compCount: 0,
      mvpCount: 0,
    };
    cur[field] += 1;
    acc.set(id, cur);
  };

  // 1) Completions (PASS success, hors handoff) + TD (scorerId).
  // Lot 3.C.3 — TD events emis par le full driver (full-driver-events
  // depuis cette PR) portent maintenant `meta.scorerId` quand un
  // porteur de balle est identifie. 3 SPP par TD attribues au scorer
  // s'il appartient au roster de la team. Si scorerId absent
  // (TD synthetique du hybrid driver, ou state sans porteur identifie),
  // pas d'attribution — comportement existant preserve.
  for (const ev of input.events) {
    if (!ev || typeof ev !== "object") continue;
    const e = ev as { type?: unknown; meta?: unknown };
    if (e.type === "PASS") {
      const meta = (e.meta ?? {}) as {
        passerId?: unknown;
        range?: unknown;
        success?: unknown;
      };
      if (meta.success !== true) continue;
      if (meta.range === "handoff") continue;
      if (typeof meta.passerId !== "string") continue;
      if (isSyntheticId(meta.passerId)) continue;
      bump(meta.passerId, "compCount");
      continue;
    }
    if (e.type === "TD") {
      const meta = (e.meta ?? {}) as { scorerId?: unknown };
      if (typeof meta.scorerId !== "string") continue;
      if (isSyntheticId(meta.scorerId)) continue;
      bump(meta.scorerId, "tdCount");
      continue;
    }
  }

  // 2) Casualties caused : attribue au causedById quand present (CUID
  //    non synthetique). Le full driver MVP ne le remplit pas encore.
  for (const cas of input.casualties) {
    const killer = cas.causedById;
    if (!killer || typeof killer !== "string") continue;
    if (isSyntheticId(killer)) continue;
    bump(killer, "casCount");
  }

  // 3) MVP : 1 random par team eligible (deterministe via seed).
  const rng = mulberry32(input.seed);
  const eligibleHome = [...input.homeRosterIds];
  const eligibleAway = [...input.awayRosterIds];
  if (eligibleHome.length > 0) {
    const idx = Math.floor(rng() * eligibleHome.length);
    bump(eligibleHome[idx], "mvpCount");
  }
  if (eligibleAway.length > 0) {
    const idx = Math.floor(rng() * eligibleAway.length);
    bump(eligibleAway[idx], "mvpCount");
  }

  const rewards: SppReward[] = [];
  for (const [rosterId, a] of acc) {
    const totalSpp =
      a.tdCount * SPP_VALUES.td +
      a.casCount * SPP_VALUES.cas +
      a.compCount * SPP_VALUES.comp +
      a.mvpCount * SPP_VALUES.mvp;
    rewards.push({
      rosterId,
      side: a.side,
      tdCount: a.tdCount,
      casCount: a.casCount,
      compCount: a.compCount,
      mvpCount: a.mvpCount,
      totalSpp,
    });
  }
  return { rewards };
}

export interface ApplyMatchSppResult {
  readonly matchId: string;
  readonly skipped: boolean;
  readonly skipReason: "already_applied" | null;
  readonly affected: number;
  readonly rewards: readonly SppReward[];
}

/**
 * Applique les SPP d'un match `ready`/`completed` sur les rosters.
 * Idempotent via `sppAppliedAt`. Erreur si match introuvable, status
 * incompatible ou replay manquant.
 */
export async function applyMatchSpp(
  matchId: string,
): Promise<ApplyMatchSppResult> {
  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      sppAppliedAt: true,
      seed: true,
      homeTeamId: true,
      awayTeamId: true,
      replayId: true,
    },
  });
  if (!match) {
    throw new SppApplicationError(
      "MATCH_NOT_FOUND",
      `ProLeagueMatch '${matchId}' introuvable`,
    );
  }
  if (!POST_SIM_STATUSES.has(match.status as string)) {
    throw new SppApplicationError(
      "MATCH_NOT_READY",
      `Match status='${match.status}' — SPP post-process reserve aux matchs ready/completed`,
    );
  }
  if (match.sppAppliedAt) {
    return {
      matchId,
      skipped: true,
      skipReason: "already_applied",
      affected: 0,
      rewards: [],
    };
  }

  const replay = await prisma.replay.findUnique({
    where: { matchId },
    select: { payload: true },
  });
  if (!replay) {
    throw new SppApplicationError(
      "REPLAY_NOT_FOUND",
      `Replay manquant pour match '${matchId}' — impossible d'attribuer les SPP`,
    );
  }
  const events = await decompressEvents(replay.payload as Buffer);

  // Charge les rosters actifs des deux teams (un joueur dead/retired
  // ne devrait pas etre eligible MVP, on filtre via status='active').
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const homeRoster = (await prisma.proTeamRoster.findMany({
    where: { teamId: match.homeTeamId as string, status: "active" },
    select: {
      id: true,
      name: true,
      spp: true,
      compCount: true,
      mvpCount: true,
      tdCount: true,
      casCount: true,
    },
  })) as ReadonlyArray<{
    id: string;
    name: string;
    spp: number;
    compCount: number;
    mvpCount: number;
    tdCount: number;
    casCount: number;
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const awayRoster = (await prisma.proTeamRoster.findMany({
    where: { teamId: match.awayTeamId as string, status: "active" },
    select: {
      id: true,
      name: true,
      spp: true,
      compCount: true,
      mvpCount: true,
      tdCount: true,
      casCount: true,
    },
  })) as typeof homeRoster;

  const homeIds = new Set(homeRoster.map((r) => r.id));
  const awayIds = new Set(awayRoster.map((r) => r.id));

  // Le seed du match est en BigInt — Number.MAX_SAFE_INTEGER absorbe
  // largement la conversion (les seeds sim sont des hash u32).
  const seedNum =
    typeof match.seed === "bigint" ? Number(match.seed) : Number(match.seed ?? 0);

  // Casualties depuis les events (le replay est la verite — on ne
  // depend pas du SimResult original qui n'est pas persiste).
  const casualtiesFromEvents: Array<{
    playerId: string;
    team: string;
    causedById?: string;
    outcome: string;
  }> = [];
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const e = ev as { type?: unknown; meta?: unknown };
    if (e.type !== "CASUALTY") continue;
    const meta = (e.meta ?? {}) as Record<string, unknown>;
    const causedBy =
      typeof meta.causedBy === "string"
        ? meta.causedBy
        : typeof meta.causedById === "string"
          ? meta.causedById
          : undefined;
    casualtiesFromEvents.push({
      playerId: String(meta.playerId ?? ""),
      team: String(meta.team ?? ""),
      causedById: causedBy,
      outcome: String(meta.outcome ?? "badly_hurt"),
    });
  }

  const { rewards } = attributeSpp({
    seed: seedNum,
    events,
    casualties: casualtiesFromEvents,
    homeRosterIds: homeIds,
    awayRosterIds: awayIds,
  });

  // Index rosters pour application incrementale.
  const allById = new Map<string, (typeof homeRoster)[number]>();
  for (const r of homeRoster) allById.set(r.id, r);
  for (const r of awayRoster) allById.set(r.id, r);

  // BUG fix audit round 4 (CRITICAL) : avant, les updates `proTeamRoster`
  // et le marqueur `proLeagueMatch.sppAppliedAt` etaient executes
  // sequentiellement sans transaction. Crash entre 2 updates de rosters
  // → SPP partiellement distribues + `sppAppliedAt` non-set → re-run
  // double-applique sur les rosters deja mis a jour (corruption SPP).
  // Fix : tout le bloc updates + sppAppliedAt dans une seule
  // $transaction Prisma.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    for (const reward of rewards) {
      const cur = allById.get(reward.rosterId);
      if (!cur) continue;
      await tx.proTeamRoster.update({
        where: { id: reward.rosterId },
        data: {
          spp: cur.spp + reward.totalSpp,
          tdCount: cur.tdCount + reward.tdCount,
          casCount: cur.casCount + reward.casCount,
          compCount: cur.compCount + reward.compCount,
          mvpCount: cur.mvpCount + reward.mvpCount,
        },
      });
    }
    await tx.proLeagueMatch.update({
      where: { id: matchId },
      data: { sppAppliedAt: new Date() },
    });
  });

  return {
    matchId,
    skipped: false,
    skipReason: null,
    affected: rewards.length,
    rewards,
  };
}

/**
 * Cron sweep : matchs `ready`/`completed` non encore traites par
 * `applyMatchSpp`. Erreur par match isolee. Limit 50.
 */
export async function sweepMatchSpp(): Promise<{
  inspected: number;
  processed: number;
  failed: number;
}> {
  const candidates = await prisma.proLeagueMatch.findMany({
    where: {
      status: { in: ["ready", "completed"] },
      sppAppliedAt: null,
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
      await applyMatchSpp(id as string);
      processed += 1;
    } catch {
      failed += 1;
    }
  }
  return { inspected: candidates.length, processed, failed };
}
