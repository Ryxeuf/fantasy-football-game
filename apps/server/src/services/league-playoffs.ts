/**
 * L2.C.3 — Sprint Ligues v2 PR8 : playoffs (elimination directe).
 *
 * Approche minimaliste : un round playoff est un `LeagueRound` avec
 * `kind="playoff"` et un `bracketSlot` lisible ("qf1", "sf2",
 * "final"). Les pairings utilisent `LeaguePairing` standard. La
 * progression dans le bracket est lazy : chaque round est genere a
 * la cloture du precedent (hook dans `recordLeagueMatchResult` /
 * `recordForfeit`).
 *
 * Tailles supportees :
 *   - 0  : pas de playoff (champion = 1er round-robin).
 *   - 2  : final seulement (top 2 -> 1 pairing).
 *   - 4  : SF + final (top 4 -> 2 pairings + 1 final).
 *   - 8  : QF + SF + final (top 8 -> 4 + 2 + 1 = 7 pairings).
 *
 * Seeding standard : 1v8, 4v5, 2v7, 3v6 (cross-bracket pour eviter
 * que les seeds 1 et 2 se rencontrent en SF). Pour top 4 :
 * 1v4, 2v3.
 *
 * `generatePlayoffSeedingFor(N, seeds)` est PURE : meme entree ->
 * meme sortie. Testable sans Prisma.
 */

import { prisma } from "../prisma";
import {
  computeSeasonStandings,
  computeSeasonStandingsByPool,
  type StandingRow,
} from "./league";
import { serverLog } from "../utils/server-log";

export type PlayoffSize = 0 | 2 | 4 | 8;

export interface BracketPairing {
  /** Slot du bracket : "qf1".."qf4", "sf1".."sf2", "final". */
  readonly slot: string;
  /** Round number sequentiel apres la saison reguliere. */
  readonly roundNumber: number;
  /** participantId du seed home (cote haut du pairing). */
  readonly homeParticipantId: string;
  /** participantId du seed away (cote bas du pairing). */
  readonly awayParticipantId: string;
}

export interface BracketSeed {
  readonly participantId: string;
  /** Position dans le classement (1 = champion regulier). */
  readonly seedRank: number;
}

const QUARTER_FINALS = ["qf1", "qf2", "qf3", "qf4"] as const;
const SEMI_FINALS = ["sf1", "sf2"] as const;
const FINAL_SLOT = "final";

/**
 * Slot pattern utilise quand on advance un winner :
 *   - winner of qf1 va dans sf1 (home)
 *   - winner of qf2 va dans sf1 (away)
 *   - winner of qf3 va dans sf2 (home)
 *   - winner of qf4 va dans sf2 (away)
 *   - winner of sf1 va dans final (home)
 *   - winner of sf2 va dans final (away)
 */
const ADVANCEMENT_MAP: Record<string, { nextSlot: string; side: "home" | "away" }> = {
  qf1: { nextSlot: "sf1", side: "home" },
  qf2: { nextSlot: "sf1", side: "away" },
  qf3: { nextSlot: "sf2", side: "home" },
  qf4: { nextSlot: "sf2", side: "away" },
  sf1: { nextSlot: FINAL_SLOT, side: "home" },
  sf2: { nextSlot: FINAL_SLOT, side: "away" },
};

/**
 * PURE — calcule les pairings du PREMIER round playoff d'une taille
 * donnee a partir de la liste des participants seedes (index 0 =
 * meilleur seed = "seed 1").
 *
 * Throws si playoffSize invalide ou si seeds.length < playoffSize.
 *
 * @param size 0 / 2 / 4 / 8
 * @param seeds liste ordonnee par classement (index 0 = seed 1)
 * @param baseRoundNumber numero a partir duquel les rounds playoff sont
 *                       numerotes (ex: si la saison reguliere a 7
 *                       rounds, baseRoundNumber=8).
 */
export function generatePlayoffSeedingFor(
  size: PlayoffSize,
  seeds: readonly string[],
  baseRoundNumber: number,
): BracketPairing[] {
  if (size === 0) return [];
  if (size !== 2 && size !== 4 && size !== 8) {
    throw new Error(`playoffSize non supporte: ${size}`);
  }
  if (seeds.length < size) {
    throw new Error(
      `Seeds insuffisants pour playoffSize=${size} : ${seeds.length} fournis`,
    );
  }
  // Seed fixe : on ne prend que les top-N.
  const top = seeds.slice(0, size);

  switch (size) {
    case 2:
      // Final direct : seed 1 vs seed 2.
      return [
        {
          slot: FINAL_SLOT,
          roundNumber: baseRoundNumber,
          homeParticipantId: top[0],
          awayParticipantId: top[1],
        },
      ];
    case 4:
      // SF : 1v4, 2v3 (cross-bracket : seeds 1 et 2 ne se rencontrent
      // qu'en final).
      return [
        {
          slot: SEMI_FINALS[0],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[0],
          awayParticipantId: top[3],
        },
        {
          slot: SEMI_FINALS[1],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[1],
          awayParticipantId: top[2],
        },
      ];
    case 8:
      // QF : 1v8, 4v5, 2v7, 3v6.
      return [
        {
          slot: QUARTER_FINALS[0],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[0],
          awayParticipantId: top[7],
        },
        {
          slot: QUARTER_FINALS[1],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[3],
          awayParticipantId: top[4],
        },
        {
          slot: QUARTER_FINALS[2],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[1],
          awayParticipantId: top[6],
        },
        {
          slot: QUARTER_FINALS[3],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[2],
          awayParticipantId: top[5],
        },
      ];
  }
}

/**
 * PURE — pour un slot playoff (qf1..final), retourne le slot suivant
 * et le cote (home/away) auquel le winner doit etre place. Renvoie
 * null pour `final` (pas d'advancement).
 */
export function nextSlotFor(
  slot: string,
): { nextSlot: string; side: "home" | "away" } | null {
  return ADVANCEMENT_MAP[slot] ?? null;
}

/**
 * PURE — pour une taille playoff donnee, retourne la liste des slots
 * du premier round (les "feuilles" de l'arbre).
 */
export function firstRoundSlotsFor(size: PlayoffSize): readonly string[] {
  if (size === 8) return QUARTER_FINALS;
  if (size === 4) return SEMI_FINALS;
  if (size === 2) return [FINAL_SLOT];
  return [];
}

/**
 * Entree PURE de `selectSeedsFromPools` : une poule avec son quota de
 * qualifies et son classement interne (index 0 = 1er de poule).
 * Les participants `withdrawn` doivent deja avoir ete filtres.
 */
export interface PoolQualificationInput {
  readonly poolId: string;
  readonly poolOrder: number;
  readonly qualifiesForPlayoffs: number;
  readonly ranked: readonly string[];
}

export type PoolSeedOutcome =
  | { readonly ok: true; readonly seeds: readonly string[] }
  | {
      readonly ok: false;
      readonly reason:
        | "pool-qualification-mismatch"
        | "insufficient-participants";
    };

/**
 * PURE — construit la liste des seeds a partir des quotas de poule.
 *
 * Ordre "serpentin" : tous les 1ers de poule (par `poolOrder`
 * croissant), puis tous les 2emes, etc. Combine au seeding croise de
 * `generatePlayoffSeedingFor` (1v8/4v5/2v7/3v6), cet ordre evite les
 * duels intra-poule au premier tour tant que les poules ont le meme
 * quota. En quotas asymetriques un duel intra-poule redevient
 * possible : le commissaire dispose alors de l'editeur de seeds
 * (`overridePlayoffParticipants`).
 *
 * Refus (aucun seed produit) :
 *   - `pool-qualification-mismatch` : somme des quotas != taille du
 *     bracket. On refuse plutot que d'ajuster, pour ne pas produire un
 *     bracket qui contredit les quotas affiches toute la saison.
 *   - `insufficient-participants` : une poule compte moins d'equipes
 *     eligibles que son quota.
 */
export function selectSeedsFromPools(
  pools: readonly PoolQualificationInput[],
  size: PlayoffSize,
): PoolSeedOutcome {
  const totalQualified = pools.reduce(
    (n, p) => n + Math.max(0, p.qualifiesForPlayoffs),
    0,
  );
  if (totalQualified !== size) {
    return { ok: false, reason: "pool-qualification-mismatch" };
  }

  const qualifying = pools
    .filter((p) => p.qualifiesForPlayoffs > 0)
    .slice()
    .sort((a, b) =>
      a.poolOrder !== b.poolOrder
        ? a.poolOrder - b.poolOrder
        : a.poolId.localeCompare(b.poolId),
    );

  for (const p of qualifying) {
    if (p.ranked.length < p.qualifiesForPlayoffs) {
      return { ok: false, reason: "insufficient-participants" };
    }
  }

  const maxQuota = qualifying.reduce(
    (n, p) => Math.max(n, p.qualifiesForPlayoffs),
    0,
  );
  const seeds: string[] = [];
  for (let rank = 0; rank < maxQuota; rank += 1) {
    for (const p of qualifying) {
      if (p.qualifiesForPlayoffs > rank) seeds.push(p.ranked[rank]);
    }
  }

  return { ok: true, seeds };
}

interface PrismaWithLeague {
  leagueSeason: {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  leagueParticipant: {
    findMany: (args: unknown) => Promise<unknown>;
  };
  leagueRound: {
    findFirst: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
  leaguePairing: {
    findMany: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
}

interface SeasonRow {
  id: string;
  status: string;
  playoffSize: number;
}

/**
 * Genere et persiste le premier round playoff (QF/SF/final selon
 * playoffSize). Pre-requis :
 *   - season.playoffSize > 0
 *   - aucun round playoff existant pour cette saison
 *   - assez de participants `active` (>= playoffSize)
 *
 * Idempotent : si le premier round existe deja, no-op + renvoie
 * `created=false`.
 */
export interface StartPlayoffsOutcome {
  readonly created: boolean;
  readonly roundsCreated: number;
  readonly pairingsCreated: number;
  readonly skippedReason?: StartPlayoffsSkippedReason;
  /** Nombre de pairings reguliers annules par la cloture anticipee. */
  readonly cancelledPairings?: number;
}

export type StartPlayoffsSkippedReason =
  | "playoffs-disabled"
  | "playoffs-already-started"
  | "season-missing"
  | "insufficient-participants"
  /** Un round non-playoff n'est pas encore `completed`. */
  | "regular-season-incomplete"
  /** Somme des quotas de poule != playoffSize. */
  | "pool-qualification-mismatch";

export interface StartPlayoffsOptions {
  /**
   * Cloture anticipee de la phase reguliere : annule les pairings
   * reguliers non joues et complete les rounds correspondants avant de
   * generer le bracket. Ne contourne AUCUNE autre garde.
   */
  readonly force?: boolean;
  /** Commissaire a l'origine de la cloture forcee (journalisation). */
  readonly byUserId?: string;
}

export async function startPlayoffs(
  seasonId: string,
  options: StartPlayoffsOptions = {},
): Promise<StartPlayoffsOutcome> {
  const client = prisma as unknown as PrismaWithLeague;

  const season = (await client.leagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true, playoffSize: true },
  })) as SeasonRow | null;
  if (!season) return skipped("season-missing");
  if (season.playoffSize === 0) return skipped("playoffs-disabled");

  const size = season.playoffSize as PlayoffSize;
  if (size !== 2 && size !== 4 && size !== 8) {
    return skipped("playoffs-disabled");
  }

  const existing = await client.leagueRound.count({
    where: { seasonId, kind: "playoff" },
  });
  if (existing > 0) return skipped("playoffs-already-started");

  // Garde de fin de phase reguliere. Le hook automatique ne se
  // declenche qu'une fois tout complete ; c'est l'action manuelle du
  // commissaire qui rend cette verification necessaire.
  const incompleteRegular = await client.leagueRound.count({
    where: {
      seasonId,
      kind: { not: "playoff" },
      status: { not: "completed" },
    },
  });
  if (incompleteRegular > 0 && !options.force) {
    return skipped("regular-season-incomplete");
  }

  const resolved = await resolveSeeds(seasonId, size);
  if (!resolved.ok) return skipped(resolved.reason);
  const seeds = resolved.seeds;

  // La cloture forcee n'intervient qu'une fois toutes les autres
  // gardes satisfaites : on n'annule jamais de pairings pour une
  // generation qui echouerait juste apres.
  let cancelledPairings = 0;
  if (incompleteRegular > 0 && options.force) {
    cancelledPairings = await closeRegularPhase(seasonId, options.byUserId);
  }

  const lastRound = (await client.leagueRound.findFirst({
    where: { seasonId },
    orderBy: { roundNumber: "desc" },
    select: { roundNumber: true },
  })) as { roundNumber: number } | null;
  const baseRoundNumber = (lastRound?.roundNumber ?? 0) + 1;

  // 1 LeagueRound par slot du bracket (1 pairing par round). Plus
  // simple a parcourir cote UI (1 carte = 1 slot) et garantit
  // qu'on peut retrouver le slot via `LeagueRound.bracketSlot`
  // sans propager le mapping cote pairing.
  const pairings = generatePlayoffSeedingFor(size, seeds, baseRoundNumber);

  let nextRoundNumber = baseRoundNumber;
  let roundsCreated = 0;
  let pairingsCreated = 0;
  for (const p of pairings) {
    const labelForSlot = playoffRoundLabel(p.slot);
    const round = (await client.leagueRound.create({
      data: {
        seasonId,
        roundNumber: nextRoundNumber++,
        name: labelForSlot,
        kind: "playoff",
        bracketSlot: p.slot,
        status: "pending",
      },
      select: { id: true },
    })) as { id: string };
    await client.leaguePairing.create({
      data: {
        roundId: round.id,
        homeParticipantId: p.homeParticipantId,
        awayParticipantId: p.awayParticipantId,
        status: "scheduled",
      },
    });
    roundsCreated += 1;
    pairingsCreated += 1;
  }

  serverLog.info(
    `[league-playoffs] season=${seasonId} playoffs started size=${size} rounds=${roundsCreated} seeding=${resolved.source}`,
  );

  return {
    created: true,
    roundsCreated,
    pairingsCreated,
    ...(cancelledPairings > 0 ? { cancelledPairings } : {}),
  };
}

function skipped(reason: StartPlayoffsSkippedReason): StartPlayoffsOutcome {
  return {
    created: false,
    roundsCreated: 0,
    pairingsCreated: 0,
    skippedReason: reason,
  };
}

type ResolvedSeeds =
  | {
      readonly ok: true;
      readonly seeds: readonly string[];
      readonly source: "pools" | "global";
    }
  | { readonly ok: false; readonly reason: StartPlayoffsSkippedReason };

/**
 * Choisit la source des seeds : quotas de poule si la saison en
 * configure, classement global sinon (comportement historique).
 */
async function resolveSeeds(
  seasonId: string,
  size: PlayoffSize,
): Promise<ResolvedSeeds> {
  const pools = await computeSeasonStandingsByPool(seasonId);
  const totalQualified = pools.reduce(
    (n, p) => n + Math.max(0, p.qualifiesForPlayoffs),
    0,
  );

  if (pools.length > 0 && totalQualified > 0) {
    const outcome = selectSeedsFromPools(
      pools.map((p) => ({
        poolId: p.poolId,
        poolOrder: p.poolOrder,
        qualifiesForPlayoffs: p.qualifiesForPlayoffs,
        ranked: p.standings
          .filter((s: StandingRow) => s.status !== "withdrawn")
          .map((s: StandingRow) => s.participantId),
      })),
      size,
    );
    if (!outcome.ok) return { ok: false, reason: outcome.reason };
    return { ok: true, seeds: outcome.seeds, source: "pools" };
  }

  const standings = await computeSeasonStandings(seasonId);
  const eligible = standings.filter(
    (s: StandingRow) => s.status !== "withdrawn",
  );
  if (eligible.length < size) {
    return { ok: false, reason: "insufficient-participants" };
  }
  return {
    ok: true,
    seeds: eligible.map((s: StandingRow) => s.participantId),
    source: "global",
  };
}

/**
 * Cloture anticipee de la phase reguliere : meme semantique que
 * `closeSeason` (pairings non joues -> `cancelled`, rounds ->
 * `completed`) mais restreinte aux rounds non-playoff et sans clore la
 * saison. Journalise best-effort : l'annulation de matchs planifies
 * doit laisser une trace, mais un echec d'audit ne doit pas empecher
 * le bracket de se generer.
 */
async function closeRegularPhase(
  seasonId: string,
  byUserId?: string,
): Promise<number> {
  const cancelled = await prisma.leaguePairing.updateMany({
    where: {
      round: { seasonId, kind: { not: "playoff" } },
      status: { in: ["scheduled", "in_progress"] },
    },
    data: { status: "cancelled" },
  });
  await prisma.leagueRound.updateMany({
    where: {
      seasonId,
      kind: { not: "playoff" },
      status: { not: "completed" },
    },
    data: { status: "completed" },
  });

  serverLog.info(
    `[league-playoffs] season=${seasonId} regular phase force-closed cancelled=${cancelled.count}`,
  );

  if (byUserId) {
    try {
      await (
        prisma as unknown as {
          auditLog: { create: (args: unknown) => Promise<unknown> };
        }
      ).auditLog.create({
        data: {
          userId: byUserId,
          action: "league.playoff:force-start",
          entity: "LeagueSeason",
          entityId: seasonId,
          newValue: { cancelledPairings: cancelled.count },
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(`[league-playoffs] audit force-start failed: ${msg}`);
    }
  }

  return cancelled.count;
}

/** Lot D — Erreur typee pour les operations d'override du bracket. */
export class PlayoffOverrideError extends Error {
  constructor(
    public readonly code:
      | "season_not_found"
      | "playoffs_not_started"
      | "playoffs_in_progress"
      | "size_mismatch"
      | "duplicate_participant"
      | "participant_not_active",
    message: string,
  ) {
    super(message);
    this.name = "PlayoffOverrideError";
  }
}

/**
 * Lot D — Remplace les participants du premier round du bracket
 * (typiquement pour gerer un desistement tardif avant le 1er match
 * playoff). Refus si un pairing du round 1 a deja un match en cours
 * ou joue.
 *
 * Le commissaire fournit la liste complete des seeds du bracket
 * (taille = playoffSize). L'ordre est conserve pour generer le
 * seeding (cross-bracket standard).
 */
export async function overridePlayoffParticipants(input: {
  seasonId: string;
  participantIds: ReadonlyArray<string>;
}): Promise<{
  rebuilt: number;
  rebuiltSlots: string[];
}> {
  const client = prisma as unknown as PrismaWithLeague;

  const season = (await client.leagueSeason.findUnique({
    where: { id: input.seasonId },
    select: { id: true, playoffSize: true },
  })) as { id: string; playoffSize: number } | null;
  if (!season) {
    throw new PlayoffOverrideError(
      "season_not_found",
      `Saison introuvable: ${input.seasonId}`,
    );
  }

  const size = season.playoffSize as PlayoffSize;
  if (size !== 2 && size !== 4 && size !== 8) {
    throw new PlayoffOverrideError(
      "playoffs_not_started",
      "Cette saison n'a pas de playoffs configures",
    );
  }
  if (input.participantIds.length !== size) {
    throw new PlayoffOverrideError(
      "size_mismatch",
      `Attendu ${size} participants, recu ${input.participantIds.length}`,
    );
  }

  // Duplicates check.
  const uniqueIds = new Set(input.participantIds);
  if (uniqueIds.size !== input.participantIds.length) {
    throw new PlayoffOverrideError(
      "duplicate_participant",
      "Un participant est present plusieurs fois dans la liste",
    );
  }

  // Tous les participants doivent appartenir a la saison ET etre actifs.
  const participants = (await prisma.leagueParticipant.findMany({
    where: { id: { in: [...uniqueIds] } },
    select: { id: true, seasonId: true, status: true },
  })) as Array<{ id: string; seasonId: string; status: string }>;
  if (participants.length !== uniqueIds.size) {
    throw new PlayoffOverrideError(
      "participant_not_active",
      "Un ou plusieurs participants introuvables",
    );
  }
  for (const p of participants) {
    if (p.seasonId !== input.seasonId) {
      throw new PlayoffOverrideError(
        "participant_not_active",
        `Participant ${p.id} hors de la saison`,
      );
    }
    if (p.status !== "active") {
      throw new PlayoffOverrideError(
        "participant_not_active",
        `Participant ${p.id} non actif (${p.status})`,
      );
    }
  }

  // Les rounds playoff existants ne doivent contenir que des pairings
  // "scheduled" pour qu'on puisse les recreer (round 1 + lazy
  // futurs). Si un pairing a deja un match associe ou status played,
  // on refuse.
  const existingRounds = (await client.leagueRound.findMany({
    where: { seasonId: input.seasonId, kind: "playoff" },
    orderBy: { roundNumber: "asc" },
    include: {
      pairings: {
        select: { id: true, status: true, matchId: true },
      },
    },
  })) as Array<{
    id: string;
    bracketSlot: string | null;
    pairings: Array<{ id: string; status: string; matchId: string | null }>;
  }>;
  if (existingRounds.length === 0) {
    throw new PlayoffOverrideError(
      "playoffs_not_started",
      "Les playoffs n'ont pas encore demarre — utilisez startPlayoffs",
    );
  }
  for (const r of existingRounds) {
    for (const pair of r.pairings) {
      if (
        pair.status !== "scheduled" ||
        (pair.matchId !== null && pair.matchId !== undefined)
      ) {
        throw new PlayoffOverrideError(
          "playoffs_in_progress",
          "Un match playoff est deja en cours ou joue — override impossible",
        );
      }
    }
  }

  // Wipe + rebuild via $transaction. On supprime tous les rounds
  // playoff existants, puis on regenere le bracket depuis les seeds
  // fournis.
  const lastNonPlayoff = (await client.leagueRound.findFirst({
    where: { seasonId: input.seasonId, kind: { not: "playoff" } },
    orderBy: { roundNumber: "desc" },
    select: { roundNumber: true },
  })) as { roundNumber: number } | null;
  const baseRoundNumber = (lastNonPlayoff?.roundNumber ?? 0) + 1;

  const seeds = [...input.participantIds];
  const pairings = generatePlayoffSeedingFor(size, seeds, baseRoundNumber);

  // Suppression atomique.
  await prisma.$transaction([
    ...existingRounds.map((r) =>
      (prisma as unknown as PrismaWithLeague).leagueRound.delete({
        where: { id: r.id },
      }),
    ),
  ]);

  let nextRoundNumber = baseRoundNumber;
  const createdSlots: string[] = [];
  for (const p of pairings) {
    const round = (await client.leagueRound.create({
      data: {
        seasonId: input.seasonId,
        roundNumber: nextRoundNumber++,
        name: playoffRoundLabel(p.slot),
        kind: "playoff",
        bracketSlot: p.slot,
        status: "pending",
      },
      select: { id: true },
    })) as { id: string };
    await client.leaguePairing.create({
      data: {
        roundId: round.id,
        homeParticipantId: p.homeParticipantId,
        awayParticipantId: p.awayParticipantId,
        status: "scheduled",
      },
    });
    createdSlots.push(p.slot);
  }

  serverLog.info(
    `[league-playoffs] season=${input.seasonId} bracket overridden size=${size} rounds=${createdSlots.length}`,
  );

  return { rebuilt: createdSlots.length, rebuiltSlots: createdSlots };
}

function playoffRoundLabel(slot: string): string {
  if (slot === "final") return "Finale";
  if (slot.startsWith("sf")) {
    const idx = slot.replace("sf", "");
    return `Demi-finale ${idx}`;
  }
  if (slot.startsWith("qf")) {
    const idx = slot.replace("qf", "");
    return `Quart ${idx}`;
  }
  return slot;
}

/**
 * Apres la cloture d'un pairing playoff (status=played /
 * forfeit_*), determine le winner et cree (si applicable) le pairing
 * du round suivant. Idempotent : verifie via `bracketSlot` que le
 * next round n'existe pas deja.
 *
 * Doit etre appele a partir de :
 *   - `recordLeagueMatchResult` (apres `played`)
 *   - `recordForfeit` (apres `forfeit_*`)
 *
 * Renvoie `{advanced: true}` si un nouveau pairing a ete cree,
 * `{advanced: false, reason}` sinon (ex: pas un pairing playoff,
 * round suivant deja existant, c'etait la finale).
 */
export type AdvanceOutcome =
  | { readonly advanced: true; readonly nextSlot: string }
  | {
      readonly advanced: false;
      readonly reason:
        | "not-a-playoff-pairing"
        | "no-next-round"
        | "next-already-exists"
        | "winner-undetermined";
    };

export async function advancePlayoffsAfterPairingComplete(
  pairingId: string,
): Promise<AdvanceOutcome> {
  const client = prisma as unknown as PrismaWithLeague;

  const pairing = (await client.leaguePairing.findFirst({
    where: { id: pairingId },
    select: {
      id: true,
      status: true,
      homeParticipantId: true,
      awayParticipantId: true,
      round: {
        select: {
          id: true,
          seasonId: true,
          roundNumber: true,
          kind: true,
          bracketSlot: true,
        },
      },
    },
  })) as {
    id: string;
    status: string;
    homeParticipantId: string;
    awayParticipantId: string;
    round: {
      id: string;
      seasonId: string;
      roundNumber: number;
      kind: string;
      bracketSlot: string | null;
    };
  } | null;

  if (!pairing || pairing.round.kind !== "playoff" || !pairing.round.bracketSlot) {
    return { advanced: false, reason: "not-a-playoff-pairing" };
  }

  const slot = pairing.round.bracketSlot;
  const next = nextSlotFor(slot);
  if (!next) {
    // C'etait la finale : pas de round suivant.
    return { advanced: false, reason: "no-next-round" };
  }

  // Determine le winner du pairing.
  const winnerId = winnerFromStatus(pairing);
  if (!winnerId) {
    return { advanced: false, reason: "winner-undetermined" };
  }

  // Round suivant : existe deja (genere par un sibling pairing) ?
  const nextRound = (await client.leagueRound.findFirst({
    where: {
      seasonId: pairing.round.seasonId,
      bracketSlot: next.nextSlot,
    },
    select: { id: true },
    // Toujours un seul round par slot (1-pairing-per-round).
  })) as { id: string } | null;

  if (nextRound) {
    // Le round existe : on update le pairing pour ajouter ce winner
    // dans le bon cote (home si side=home, sinon away).
    const existingPairing = (await client.leaguePairing.findFirst({
      where: { roundId: nextRound.id },
      select: { id: true, homeParticipantId: true, awayParticipantId: true },
    })) as {
      id: string;
      homeParticipantId: string;
      awayParticipantId: string;
    } | null;
    if (!existingPairing) {
      return { advanced: false, reason: "next-already-exists" };
    }
    await client.leaguePairing.update({
      where: { id: existingPairing.id },
      data:
        next.side === "home"
          ? { homeParticipantId: winnerId }
          : { awayParticipantId: winnerId },
    });
    return { advanced: true, nextSlot: next.nextSlot };
  }

  // Sinon, on cree le round + le pairing avec un placeholder pour
  // l'autre cote. On utilise le winner courant comme cote `side` ;
  // l'autre cote sera rempli par le sibling pairing quand il
  // termine. Comme placeholder, on reutilise le winnerId aux deux
  // positions (sera ecrase par l'advance suivant). Mieux : on
  // utilise une string sentinelle "TBD-{slot}". Mais notre schema
  // exige des participantId valides (FK)... on peut stocker
  // homeParticipantId = winnerId ET awayParticipantId = winnerId
  // temporairement, avec une convention "placeholder = home == away".
  // L'advancement subsequent overwrite le bon cote.
  const newRoundNumber = pairing.round.roundNumber + 1;
  const newRound = (await client.leagueRound.create({
    data: {
      seasonId: pairing.round.seasonId,
      roundNumber: newRoundNumber,
      name: playoffRoundLabel(next.nextSlot),
      kind: "playoff",
      bracketSlot: next.nextSlot,
      status: "pending",
    },
    select: { id: true },
  })) as { id: string };

  await client.leaguePairing.create({
    data: {
      roundId: newRound.id,
      homeParticipantId: next.side === "home" ? winnerId : winnerId,
      awayParticipantId: next.side === "away" ? winnerId : winnerId,
      status: "scheduled",
    },
  });

  serverLog.info(
    `[league-playoffs] season=${pairing.round.seasonId} advanced ${slot} -> ${next.nextSlot} winner=${winnerId} side=${next.side}`,
  );

  return { advanced: true, nextSlot: next.nextSlot };
}

interface PairingForWinner {
  status: string;
  homeParticipantId: string;
  awayParticipantId: string;
}

/**
 * Determine le participantId gagnant d'un pairing playoff selon son
 * `status`. Renvoie null si indetermine (status non-terminal ou
 * cancelled / draw — un draw en playoff n'est pas resolu ici, on
 * laisse l'admin trancher).
 *
 * Pour `played` : on lit le `Match.leaguePairingId` -> teamSelections
 * scores. Mais c'est complexe — on simplifie en stockant le winner
 * directement... non, le score est dans `Match`. Pour cette PR, on
 * accepte que `played` sans score (cas e2e pas de match concret) ne
 * resolve pas l'advance. C'est OK : la page recap reste la verite.
 *
 * Cas `forfeit_home` : winner = away ; `forfeit_away` : winner = home.
 */
export function winnerFromStatus(p: PairingForWinner): string | null {
  if (p.status === "forfeit_home") return p.awayParticipantId;
  if (p.status === "forfeit_away") return p.homeParticipantId;
  // Pour `played`, le winner depend du score du Match. A
  // l'extension, integrer la lookup. Pour l'instant null.
  return null;
}

/**
 * Variante exposee pour le caller qui dispose deja du winnerId
 * (calcule via le score du Match) : ne fait que la propagation
 * dans le bracket. Utile pour `recordLeagueMatchResult` qui a deja
 * `winner: 'A' | 'B' | 'draw'`.
 */
export async function advancePlayoffsWithWinner(
  pairingId: string,
  winnerSide: "home" | "away",
): Promise<AdvanceOutcome> {
  const client = prisma as unknown as PrismaWithLeague;

  const pairing = (await client.leaguePairing.findFirst({
    where: { id: pairingId },
    select: {
      id: true,
      status: true,
      homeParticipantId: true,
      awayParticipantId: true,
      round: {
        select: {
          id: true,
          seasonId: true,
          roundNumber: true,
          kind: true,
          bracketSlot: true,
        },
      },
    },
  })) as {
    id: string;
    status: string;
    homeParticipantId: string;
    awayParticipantId: string;
    round: {
      id: string;
      seasonId: string;
      roundNumber: number;
      kind: string;
      bracketSlot: string | null;
    };
  } | null;

  if (!pairing || pairing.round.kind !== "playoff" || !pairing.round.bracketSlot) {
    return { advanced: false, reason: "not-a-playoff-pairing" };
  }

  const slot = pairing.round.bracketSlot;
  const next = nextSlotFor(slot);
  if (!next) return { advanced: false, reason: "no-next-round" };

  const winnerId =
    winnerSide === "home"
      ? pairing.homeParticipantId
      : pairing.awayParticipantId;

  // Same logic as advancePlayoffsAfterPairingComplete but with
  // explicit winnerId.
  const nextRound = (await client.leagueRound.findFirst({
    where: {
      seasonId: pairing.round.seasonId,
      bracketSlot: next.nextSlot,
    },
    select: { id: true },
  })) as { id: string } | null;

  if (nextRound) {
    const existingPairing = (await client.leaguePairing.findFirst({
      where: { roundId: nextRound.id },
      select: { id: true },
    })) as { id: string } | null;
    if (!existingPairing) {
      return { advanced: false, reason: "next-already-exists" };
    }
    await client.leaguePairing.update({
      where: { id: existingPairing.id },
      data:
        next.side === "home"
          ? { homeParticipantId: winnerId }
          : { awayParticipantId: winnerId },
    });
    return { advanced: true, nextSlot: next.nextSlot };
  }

  const newRoundNumber = pairing.round.roundNumber + 1;
  const newRound = (await client.leagueRound.create({
    data: {
      seasonId: pairing.round.seasonId,
      roundNumber: newRoundNumber,
      name: playoffRoundLabel(next.nextSlot),
      kind: "playoff",
      bracketSlot: next.nextSlot,
      status: "pending",
    },
    select: { id: true },
  })) as { id: string };

  await client.leaguePairing.create({
    data: {
      roundId: newRound.id,
      homeParticipantId: winnerId,
      awayParticipantId: winnerId,
      status: "scheduled",
    },
  });

  serverLog.info(
    `[league-playoffs] season=${pairing.round.seasonId} advanced ${slot} -> ${next.nextSlot} winner=${winnerId}`,
  );

  return { advanced: true, nextSlot: next.nextSlot };
}
