/**
 * Play-offs d'une coupe : un bracket d'élimination directe posé après la
 * phase de classement.
 *
 * Le MOTEUR de bracket est partagé avec les ligues (`bracket-seeding`) : il
 * ne connaît que des identifiants opaques, on lui passe des `teamId` là où la
 * ligue passe des `participantId`. Croisement des têtes de série, carte
 * d'avancement et sélection depuis les quotas de poule sont donc les mêmes
 * des deux côtés — un second moteur aurait fini par diverger.
 *
 * Ce qui est propre à la coupe :
 *
 *  - **une ronde par slot** (`CupRound.kind = "playoff"`, `bracketSlot`), une
 *    rencontre par ronde. Même convention que la ligue : le slot se retrouve
 *    par la ronde, sans le propager jusqu'à la rencontre ;
 *  - **création paresseuse** : `startCupPlayoffs` ne crée que le PREMIER tour.
 *    Les demi-finales et la finale naissent quand leur tour amont se clôt,
 *    avec un placeholder (`home === away`) tant que le second qualifié
 *    manque — la FK exige un vrai `teamId`, c'est l'égalité qui encode « à
 *    déterminer » ;
 *  - **publication explicite** : le bracket généré n'est pas visible tant que
 *    le commissaire ne l'a pas publié, pour qu'il puisse corriger les têtes
 *    de série d'abord (cf. `Cup.playoffsPublished`, booléen à trois états).
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  firstRoundSlotsFor,
  generatePlayoffSeedingFor,
  nextSlotFor,
  selectSeedsFromPools,
  type PlayoffSize,
  type PoolQualificationInput,
} from "./bracket-seeding";
import { computeCupStandings } from "../cupScoring";
import type { CupActor } from "./cup-rounds";
import { cupByesByTeamId, listCupRounds } from "./cup-rounds";
import { groupCupStandingsByPool } from "./cup-pool";

export type CupPlayoffErrorCode =
  | "cup_not_found"
  | "forbidden"
  | "playoffs_disabled"
  | "playoffs_already_started"
  | "playoffs_not_started"
  | "regular_rounds_open"
  | "insufficient_participants"
  | "pool_qualification_mismatch"
  | "playoffs_in_progress"
  | "duplicate_team"
  | "size_mismatch"
  | "team_not_in_cup";

export class CupPlayoffError extends Error {
  constructor(
    public readonly code: CupPlayoffErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CupPlayoffError";
  }
}

/** `system` stocké sur une ronde de bracket : ni suisse, ni tirée, ni saisie. */
export const BRACKET_ROUND_SYSTEM = "bracket";

function isPlayoffSize(n: number): n is PlayoffSize {
  return n === 0 || n === 2 || n === 4 || n === 8;
}

interface CupHeader {
  id: string;
  creatorId: string;
  status: string;
  playoffSize: number;
  playoffsPublished: boolean | null;
}

async function loadCup(cupId: string): Promise<CupHeader> {
  const cup = (await prisma.cup.findUnique({
    where: { id: cupId },
    select: {
      id: true,
      creatorId: true,
      status: true,
      playoffSize: true,
      playoffsPublished: true,
    },
  })) as CupHeader | null;
  if (!cup) throw new CupPlayoffError("cup_not_found", "Coupe introuvable");
  return cup;
}

function ensureCommissioner(cup: CupHeader, actor: CupActor): void {
  if (cup.creatorId !== actor.userId && !actor.isAdmin) {
    throw new CupPlayoffError(
      "forbidden",
      "Seul le créateur de la coupe (ou un administrateur) gère les play-offs",
    );
  }
}

/**
 * Têtes de série : par quotas de poule si la coupe en déclare, sinon le
 * classement général. Les deux passent par le même moteur pur.
 */
async function resolveSeeds(
  cupId: string,
  size: PlayoffSize,
): Promise<string[]> {
  const cup = (await prisma.cup.findUnique({
    where: { id: cupId },
    include: {
      participants: {
        include: {
          team: { select: { id: true, name: true, roster: true, logoUrl: true } },
        },
      },
      pools: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          order: true,
          qualifiesForPlayoffs: true,
        },
      },
      localMatches: {
        where: { status: "completed" },
        include: {
          teamA: { select: { id: true, name: true, roster: true, logoUrl: true } },
          teamB: { select: { id: true, name: true, roster: true, logoUrl: true } },
          actions: {
            select: {
              actionType: true,
              playerTeam: true,
              armorBroken: true,
              opponentState: true,
            },
          },
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  if (!cup) throw new CupPlayoffError("cup_not_found", "Coupe introuvable");

  const rounds = await listCupRounds(cupId);
  const standings = computeCupStandings(cup, cup.localMatches, {
    byesByTeamId: cupByesByTeamId(rounds),
  }).teamStats;

  const pools = cup.pools as Array<{
    id: string;
    name: string;
    order: number;
    qualifiesForPlayoffs: number;
  }>;
  const totalQualified = pools.reduce(
    (n, p) => n + Math.max(0, p.qualifiesForPlayoffs),
    0,
  );

  if (pools.length > 0 && totalQualified > 0) {
    const poolIdByTeamId = new Map<string, string | null>(
      (
        cup.participants as Array<{ poolId: string | null; team: { id: string } }>
      ).map((p) => [p.team.id, p.poolId ?? null]),
    );
    const grouped = groupCupStandingsByPool(standings, pools, poolIdByTeamId);
    const input: PoolQualificationInput[] = pools.map((pool) => ({
      poolId: pool.id,
      poolOrder: pool.order,
      qualifiesForPlayoffs: pool.qualifiesForPlayoffs,
      ranked:
        grouped
          .find((g) => g.poolId === pool.id)
          ?.standings.map((row) => row.teamId) ?? [],
    }));
    const outcome = selectSeedsFromPools(input, size);
    if (!outcome.ok) {
      throw new CupPlayoffError(
        outcome.reason === "pool-qualification-mismatch"
          ? "pool_qualification_mismatch"
          : "insufficient_participants",
        outcome.reason === "pool-qualification-mismatch"
          ? `La somme des quotas de poule doit valoir ${size}`
          : "Une poule compte moins d'équipes que son quota de qualifiés",
      );
    }
    return [...outcome.seeds];
  }

  if (standings.length < size) {
    throw new CupPlayoffError(
      "insufficient_participants",
      `Il faut au moins ${size} équipes classées pour ce bracket`,
    );
  }
  return standings.map((row) => row.teamId);
}

export interface StartCupPlayoffsOutcome {
  readonly created: true;
  readonly roundsCreated: number;
  readonly pairingsCreated: number;
}

/**
 * Génère le PREMIER tour du bracket. Refuse tant qu'une rencontre de
 * classement reste ouverte : un bracket seedé sur un classement incomplet
 * serait faux. `force` clôt alors les rencontres restantes (annulées), ce qui
 * est un acte explicite du commissaire.
 */
export async function startCupPlayoffs(input: {
  readonly cupId: string;
  readonly actor: CupActor;
  readonly force?: boolean;
}): Promise<StartCupPlayoffsOutcome> {
  const cup = await loadCup(input.cupId);
  ensureCommissioner(cup, input.actor);

  if (!isPlayoffSize(cup.playoffSize) || cup.playoffSize === 0) {
    throw new CupPlayoffError(
      "playoffs_disabled",
      "Choisissez d'abord une taille de bracket (2, 4 ou 8)",
    );
  }
  const size: PlayoffSize = cup.playoffSize;

  const already = await prisma.cupRound.count({
    where: { cupId: cup.id, kind: "playoff" },
  });
  if (already > 0) {
    throw new CupPlayoffError(
      "playoffs_already_started",
      "Le bracket a déjà été généré",
    );
  }

  const openRegular = (await prisma.cupPairing.findMany({
    where: {
      round: { cupId: cup.id, kind: "regular" },
      status: { in: ["scheduled", "in_progress"] },
    },
    select: { id: true },
  })) as Array<{ id: string }>;
  if (openRegular.length > 0 && input.force !== true) {
    throw new CupPlayoffError(
      "regular_rounds_open",
      `${openRegular.length} rencontre(s) de classement encore ouverte(s) : terminez-les ou forcez la clôture`,
    );
  }

  // Les seeds AVANT toute écriture : on n'annule jamais de rencontres pour
  // une génération qui échouerait juste après.
  const seeds = await resolveSeeds(cup.id, size);

  const lastRound = (await prisma.cupRound.aggregate({
    where: { cupId: cup.id },
    _max: { roundNumber: true },
  })) as { _max: { roundNumber: number | null } };
  const baseRoundNumber = (lastRound._max.roundNumber ?? 0) + 1;

  const bracket = generatePlayoffSeedingFor(size, seeds, baseRoundNumber);
  const slots = firstRoundSlotsFor(size);

  if (openRegular.length > 0) {
    await prisma.cupPairing.updateMany({
      where: { id: { in: openRegular.map((p) => p.id) } },
      data: { status: "cancelled" },
    });
    serverLog.info(
      `[cup-playoffs] cup=${cup.id}: ${openRegular.length} rencontre(s) annulée(s) par une clôture forcée`,
    );
  }

  let roundNumber = baseRoundNumber;
  for (const pairing of bracket) {
    const round = (await prisma.cupRound.create({
      data: {
        cupId: cup.id,
        roundNumber,
        name: bracketSlotLabel(pairing.slot),
        system: BRACKET_ROUND_SYSTEM,
        kind: "playoff",
        bracketSlot: pairing.slot,
        status: "pending",
      },
      select: { id: true },
    })) as { id: string };
    await prisma.cupPairing.create({
      data: {
        roundId: round.id,
        tableNumber: 1,
        homeTeamId: pairing.homeParticipantId,
        awayTeamId: pairing.awayParticipantId,
        status: "scheduled",
      },
    });
    roundNumber += 1;
  }

  // Généré ≠ publié : le commissaire corrige les têtes de série d'abord.
  await prisma.cup
    .update({ where: { id: cup.id }, data: { playoffsPublished: false } })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(`[cup-playoffs] publication initiale échouée: ${msg}`);
    });

  return {
    created: true,
    roundsCreated: slots.length,
    pairingsCreated: bracket.length,
  };
}

/** Libellé lisible d'un slot, pour le nom de la ronde. */
export function bracketSlotLabel(slot: string): string {
  if (slot === "final") return "Finale";
  if (slot.startsWith("sf")) return `Demi-finale ${slot.slice(2)}`;
  if (slot.startsWith("qf")) return `Quart de finale ${slot.slice(2)}`;
  return slot;
}

export type AdvanceOutcome =
  | { readonly advanced: true; readonly nextSlot: string }
  | { readonly advanced: false; readonly reason: string };

/**
 * Place le vainqueur d'une rencontre de bracket dans le slot suivant. Crée le
 * tour aval s'il n'existe pas encore, avec un placeholder (`home === away`)
 * tant que l'autre qualifié manque.
 *
 * Un MATCH NUL ne fait avancer personne : le slot reste tel quel et la
 * rencontre doit être rejouée (ou son résultat corrigé). Même posture que la
 * ligue — inventer un vainqueur serait pire que de ne rien faire.
 */
export async function advanceCupPlayoffs(input: {
  readonly pairingId: string;
  readonly winnerTeamId: string;
}): Promise<AdvanceOutcome> {
  const pairing = (await prisma.cupPairing.findUnique({
    where: { id: input.pairingId },
    select: {
      id: true,
      round: {
        select: { id: true, cupId: true, kind: true, bracketSlot: true },
      },
    },
  })) as {
    id: string;
    round: {
      id: string;
      cupId: string;
      kind: string;
      bracketSlot: string | null;
    };
  } | null;
  if (!pairing) return { advanced: false, reason: "pairing-missing" };
  if (pairing.round.kind !== "playoff" || !pairing.round.bracketSlot) {
    return { advanced: false, reason: "not-a-playoff-pairing" };
  }

  const next = nextSlotFor(pairing.round.bracketSlot);
  if (!next) return { advanced: false, reason: "no-next-round" };

  const existing = (await prisma.cupRound.findFirst({
    where: {
      cupId: pairing.round.cupId,
      kind: "playoff",
      bracketSlot: next.nextSlot,
    },
    select: { id: true, pairings: { select: { id: true } } },
  })) as { id: string; pairings: Array<{ id: string }> } | null;

  if (existing && existing.pairings.length > 0) {
    await prisma.cupPairing.update({
      where: { id: existing.pairings[0].id },
      data:
        next.side === "home"
          ? { homeTeamId: input.winnerTeamId }
          : { awayTeamId: input.winnerTeamId },
    });
    return { advanced: true, nextSlot: next.nextSlot };
  }

  // Le numéro de ronde s'alloue sur le MAXIMUM de la coupe : reprendre
  // `round.roundNumber + 1` viserait le numéro du tour frère et la contrainte
  // unique ferait échouer la création en silence (piège vécu côté ligue).
  const max = (await prisma.cupRound.aggregate({
    where: { cupId: pairing.round.cupId },
    _max: { roundNumber: true },
  })) as { _max: { roundNumber: number | null } };

  const created = (await prisma.cupRound.create({
    data: {
      cupId: pairing.round.cupId,
      roundNumber: (max._max.roundNumber ?? 0) + 1,
      name: bracketSlotLabel(next.nextSlot),
      system: BRACKET_ROUND_SYSTEM,
      kind: "playoff",
      bracketSlot: next.nextSlot,
      status: "pending",
    },
    select: { id: true },
  })) as { id: string };

  // `home === away` encode « à déterminer » : la FK exige un vrai teamId.
  await prisma.cupPairing.create({
    data: {
      roundId: created.id,
      tableNumber: 1,
      homeTeamId: input.winnerTeamId,
      awayTeamId: input.winnerTeamId,
      status: "scheduled",
    },
  });
  return { advanced: true, nextSlot: next.nextSlot };
}

/**
 * Un bracket non publié reste invisible des coachs. `null` = coupe antérieure
 * à la colonne : visible, pour ne pas faire disparaître d'un coup un bracket
 * déjà consulté.
 */
export function isCupBracketVisible(
  playoffsPublished: boolean | null | undefined,
): boolean {
  return playoffsPublished !== false;
}

export async function setCupPlayoffsPublished(input: {
  readonly cupId: string;
  readonly actor: CupActor;
  readonly published: boolean;
}): Promise<{ playoffsPublished: boolean }> {
  const cup = await loadCup(input.cupId);
  ensureCommissioner(cup, input.actor);

  if (input.published) {
    const rounds = await prisma.cupRound.count({
      where: { cupId: cup.id, kind: "playoff" },
    });
    if (rounds === 0) {
      throw new CupPlayoffError(
        "playoffs_not_started",
        "Aucun bracket à publier pour cette coupe",
      );
    }
  }
  await prisma.cup.update({
    where: { id: cup.id },
    data: { playoffsPublished: input.published },
  });
  return { playoffsPublished: input.published };
}

/**
 * Réécrit les têtes de série du premier tour. Refusé dès qu'une rencontre du
 * bracket a commencé : rebattre les cartes après coup effacerait un résultat.
 */
export async function overrideCupPlayoffSeeds(input: {
  readonly cupId: string;
  readonly actor: CupActor;
  readonly teamIds: readonly string[];
}): Promise<{ rebuilt: number; slots: string[] }> {
  const cup = await loadCup(input.cupId);
  ensureCommissioner(cup, input.actor);
  if (!isPlayoffSize(cup.playoffSize) || cup.playoffSize === 0) {
    throw new CupPlayoffError("playoffs_disabled", "Aucun bracket configuré");
  }
  const size: PlayoffSize = cup.playoffSize;

  if (input.teamIds.length !== size) {
    throw new CupPlayoffError(
      "size_mismatch",
      `Le bracket attend exactement ${size} équipes`,
    );
  }
  if (new Set(input.teamIds).size !== input.teamIds.length) {
    throw new CupPlayoffError(
      "duplicate_team",
      "Une équipe ne peut pas occuper deux têtes de série",
    );
  }

  const registered = (await prisma.cupParticipant.findMany({
    where: { cupId: cup.id, teamId: { in: [...input.teamIds] } },
    select: { teamId: true },
  })) as Array<{ teamId: string }>;
  const known = new Set(registered.map((p) => p.teamId));
  for (const teamId of input.teamIds) {
    if (!known.has(teamId)) {
      throw new CupPlayoffError(
        "team_not_in_cup",
        `Équipe non inscrite à cette coupe : ${teamId}`,
      );
    }
  }

  const rounds = (await prisma.cupRound.findMany({
    where: { cupId: cup.id, kind: "playoff" },
    orderBy: { roundNumber: "asc" },
    select: {
      id: true,
      roundNumber: true,
      bracketSlot: true,
      pairings: { select: { id: true, status: true, localMatch: true } },
    },
  })) as Array<{
    id: string;
    roundNumber: number;
    bracketSlot: string | null;
    pairings: Array<{ id: string; status: string; localMatch: unknown }>;
  }>;
  if (rounds.length === 0) {
    throw new CupPlayoffError(
      "playoffs_not_started",
      "Générez le bracket avant d'en modifier les têtes de série",
    );
  }
  const started = rounds.some((r) =>
    r.pairings.some((p) => p.status !== "scheduled" || p.localMatch !== null),
  );
  if (started) {
    throw new CupPlayoffError(
      "playoffs_in_progress",
      "Une rencontre du bracket a déjà commencé : les têtes de série sont figées",
    );
  }

  const baseRoundNumber = Math.min(...rounds.map((r) => r.roundNumber));
  const bracket = generatePlayoffSeedingFor(
    size,
    [...input.teamIds],
    baseRoundNumber,
  );

  // Table rase puis reconstruction : un bracket à moitié réécrit serait pire
  // que pas de bracket du tout.
  await prisma.$transaction([
    prisma.cupRound.deleteMany({ where: { cupId: cup.id, kind: "playoff" } }),
  ]);

  let roundNumber = baseRoundNumber;
  for (const pairing of bracket) {
    const round = (await prisma.cupRound.create({
      data: {
        cupId: cup.id,
        roundNumber,
        name: bracketSlotLabel(pairing.slot),
        system: BRACKET_ROUND_SYSTEM,
        kind: "playoff",
        bracketSlot: pairing.slot,
        status: "pending",
      },
      select: { id: true },
    })) as { id: string };
    await prisma.cupPairing.create({
      data: {
        roundId: round.id,
        tableNumber: 1,
        homeTeamId: pairing.homeParticipantId,
        awayTeamId: pairing.awayParticipantId,
        status: "scheduled",
      },
    });
    roundNumber += 1;
  }

  return { rebuilt: bracket.length, slots: bracket.map((p) => p.slot) };
}

export interface CupBracketTeamView {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly logoUrl: string | null;
  readonly coachName: string | null;
}

export interface CupBracketRoundView {
  readonly id: string;
  readonly roundNumber: number;
  readonly slot: string;
  readonly name: string | null;
  readonly status: string;
  readonly pairingId: string | null;
  readonly pairingStatus: string | null;
  /** `true` quand le second qualifié manque encore (home === away). */
  readonly placeholder: boolean;
  readonly homeTeam: CupBracketTeamView | null;
  readonly awayTeam: CupBracketTeamView | null;
  readonly localMatch: { readonly id: string; readonly status: string } | null;
  readonly scoreLabel: string | null;
}

export interface CupBracketView {
  readonly cupId: string;
  readonly playoffSize: number;
  readonly playoffsPublished: boolean | null;
  /** `true` si aucune rencontre de classement n'est encore ouverte. */
  readonly regularRoundsComplete: boolean;
  /** Cohérence des quotas de poule avec la taille du bracket. */
  readonly poolQualification: {
    readonly totalQualified: number;
    readonly playoffSize: number;
    readonly consistent: boolean;
  };
  readonly rounds: readonly CupBracketRoundView[];
}

/**
 * Bracket d'une coupe, tel que l'écran le consomme.
 *
 * La réponse DÉPEND DU LECTEUR : tant que le bracket n'est pas publié, seul
 * le commissaire le voit — les rondes ne sont même pas chargées pour les
 * autres, pour qu'aucune tête de série provisoire ne fuite.
 */
export async function getCupBracket(input: {
  readonly cupId: string;
  readonly viewerId?: string | null;
  readonly isAdmin?: boolean;
}): Promise<CupBracketView> {
  const cup = await loadCup(input.cupId);
  const isCommissioner =
    Boolean(input.viewerId) &&
    (cup.creatorId === input.viewerId || input.isAdmin === true);

  const [openRegular, pools] = await Promise.all([
    prisma.cupPairing.count({
      where: {
        round: { cupId: cup.id, kind: "regular" },
        status: { in: ["scheduled", "in_progress"] },
      },
    }) as Promise<number>,
    prisma.cupPool.findMany({
      where: { cupId: cup.id },
      select: { qualifiesForPlayoffs: true },
    }) as Promise<Array<{ qualifiesForPlayoffs: number }>>,
  ]);
  const totalQualified = pools.reduce(
    (n, p) => n + Math.max(0, p.qualifiesForPlayoffs),
    0,
  );
  const head = {
    cupId: cup.id,
    playoffSize: cup.playoffSize,
    playoffsPublished: cup.playoffsPublished,
    regularRoundsComplete: openRegular === 0,
    poolQualification: {
      totalQualified,
      playoffSize: cup.playoffSize,
      consistent: totalQualified === 0 || totalQualified === cup.playoffSize,
    },
  };

  if (!isCupBracketVisible(cup.playoffsPublished) && !isCommissioner) {
    return { ...head, playoffsPublished: false, rounds: [] };
  }

  const rounds = (await prisma.cupRound.findMany({
    where: { cupId: cup.id, kind: "playoff" },
    orderBy: { roundNumber: "asc" },
    include: {
      pairings: {
        include: {
          homeTeam: TEAM_SELECT,
          awayTeam: TEAM_SELECT,
          localMatch: {
            select: {
              id: true,
              status: true,
              teamAId: true,
              scoreTeamA: true,
              scoreTeamB: true,
            },
          },
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any[];

  return { ...head, rounds: rounds.map(toBracketRound) };
}

const TEAM_SELECT = {
  select: {
    id: true,
    name: true,
    roster: true,
    logoUrl: true,
    owner: { select: { coachName: true } },
  },
} as const;

type TeamRow = {
  id: string;
  name: string;
  roster: string;
  logoUrl: string | null;
  owner?: { coachName: string | null } | null;
} | null;

function toBracketTeam(row: TeamRow): CupBracketTeamView | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    roster: row.roster,
    logoUrl: row.logoUrl ?? null,
    coachName: row.owner?.coachName ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBracketRound(round: any): CupBracketRoundView {
  const pairing = round.pairings?.[0] ?? null;
  const placeholder =
    Boolean(pairing) && pairing.homeTeamId === pairing.awayTeamId;
  const match = pairing?.localMatch ?? null;
  // Score orienté DOMICILE : le match local ne garantit pas que l'équipe A
  // soit celle qui reçoit.
  let scoreLabel: string | null = null;
  if (
    match &&
    match.status === "completed" &&
    typeof match.scoreTeamA === "number" &&
    typeof match.scoreTeamB === "number"
  ) {
    const homeIsA = match.teamAId === pairing.homeTeamId;
    const home = homeIsA ? match.scoreTeamA : match.scoreTeamB;
    const away = homeIsA ? match.scoreTeamB : match.scoreTeamA;
    scoreLabel = `${home} – ${away}`;
  }
  return {
    id: round.id,
    roundNumber: round.roundNumber,
    slot: round.bracketSlot ?? "",
    name: round.name ?? null,
    status: round.status,
    pairingId: pairing?.id ?? null,
    pairingStatus: pairing?.status ?? null,
    placeholder,
    homeTeam: toBracketTeam(pairing?.homeTeam ?? null),
    awayTeam: placeholder ? null : toBracketTeam(pairing?.awayTeam ?? null),
    localMatch: match ? { id: match.id, status: match.status } : null,
    scoreLabel,
  };
}
