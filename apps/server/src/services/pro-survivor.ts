/**
 * Sprint Q lot Q.D.2 — Service Survivor Pick'em.
 *
 * Le concept reprend le NFL Survivor classique :
 *  - 1 pick par user par round (semaine)
 *  - L'equipe piquee doit gagner pour rester "alive"
 *  - Une equipe ne peut etre piquee qu'une fois par saison
 *  - Un user elimine ne peut plus piquer
 *
 * Les saisons Pro League existantes font office de saisons survivor —
 * pas de table dediee.
 */

import { prisma } from "../prisma";

export type SurvivorErrorCode =
  | "SEASON_NOT_FOUND"
  | "ROUND_NOT_FOUND"
  | "ROUND_LOCKED"
  | "TEAM_NOT_IN_ROUND"
  | "TEAM_ALREADY_PICKED"
  | "ALREADY_ELIMINATED"
  | "ALREADY_PICKED_THIS_WEEK"
  | "INVALID_INPUT";

export class SurvivorError extends Error {
  constructor(
    public readonly code: SurvivorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SurvivorError";
  }
}

export type SurvivorStatus = "pending" | "alive" | "eliminated";

export interface SubmitSurvivorPickInput {
  readonly seasonId: string;
  readonly userId: string;
  readonly roundId: string;
  readonly teamId: string;
}

export interface SubmitSurvivorPickResult {
  readonly entryId: string;
  readonly seasonId: string;
  readonly userId: string;
  readonly roundId: string;
  readonly weekN: number;
  readonly pickedTeamId: string;
  readonly status: SurvivorStatus;
}

/**
 * Soumet un pick survivor pour un user. Refuse si :
 *  - round introuvable ou status != "pending"
 *  - team ne joue pas ce round
 *  - team deja piquee dans une autre weekN de la meme saison
 *  - user deja elimine
 *  - user deja pick sur ce round (deja submitted)
 */
export async function submitSurvivorPick(
  input: SubmitSurvivorPickInput,
): Promise<SubmitSurvivorPickResult> {
  const round = (await prisma.proLeagueRound.findUnique({
    where: { id: input.roundId },
    select: {
      id: true,
      seasonId: true,
      roundNumber: true,
      status: true,
    },
  })) as {
    id: string;
    seasonId: string;
    roundNumber: number;
    status: string;
  } | null;

  if (!round) {
    throw new SurvivorError("ROUND_NOT_FOUND", "Round introuvable");
  }
  if (round.seasonId !== input.seasonId) {
    throw new SurvivorError(
      "ROUND_NOT_FOUND",
      "Round n'appartient pas a cette saison",
    );
  }
  if (round.status !== "pending") {
    throw new SurvivorError(
      "ROUND_LOCKED",
      "Round deja commence ou termine — picks fermes",
    );
  }

  // Verifie que la team joue dans ce round.
  const match = (await prisma.proLeagueMatch.findFirst({
    where: {
      roundId: input.roundId,
      OR: [{ homeTeamId: input.teamId }, { awayTeamId: input.teamId }],
    },
    select: { id: true },
  })) as { id: string } | null;

  if (!match) {
    throw new SurvivorError(
      "TEAM_NOT_IN_ROUND",
      "Cette equipe ne joue pas dans ce round",
    );
  }

  // Verifie que la team n'a pas deja ete piquee dans cette saison.
  const previousPick = await prisma.proSurvivorEntry.findUnique({
    where: {
      seasonId_userId_pickedTeamId: {
        seasonId: input.seasonId,
        userId: input.userId,
        pickedTeamId: input.teamId,
      },
    },
    select: { id: true, weekN: true },
  });
  if (previousPick) {
    throw new SurvivorError(
      "TEAM_ALREADY_PICKED",
      `Cette equipe a deja ete piquee (semaine ${previousPick.weekN})`,
    );
  }

  // Verifie que le user n'est pas elimine sur cette saison.
  const eliminated = await prisma.proSurvivorEntry.findFirst({
    where: {
      seasonId: input.seasonId,
      userId: input.userId,
      status: "eliminated",
    },
    select: { id: true },
  });
  if (eliminated) {
    throw new SurvivorError(
      "ALREADY_ELIMINATED",
      "Vous etes deja elimine sur cette saison",
    );
  }

  // Verifie qu'un pick n'existe pas deja pour cette semaine.
  const existingForRound = await prisma.proSurvivorEntry.findUnique({
    where: {
      seasonId_userId_roundId: {
        seasonId: input.seasonId,
        userId: input.userId,
        roundId: input.roundId,
      },
    },
    select: { id: true },
  });
  if (existingForRound) {
    throw new SurvivorError(
      "ALREADY_PICKED_THIS_WEEK",
      "Vous avez deja pick pour cette semaine",
    );
  }

  const entry = (await prisma.proSurvivorEntry.create({
    data: {
      seasonId: input.seasonId,
      userId: input.userId,
      roundId: input.roundId,
      weekN: round.roundNumber,
      pickedTeamId: input.teamId,
      status: "pending",
    },
    select: {
      id: true,
      seasonId: true,
      userId: true,
      roundId: true,
      weekN: true,
      pickedTeamId: true,
      status: true,
    },
  })) as {
    id: string;
    seasonId: string;
    userId: string;
    roundId: string;
    weekN: number;
    pickedTeamId: string;
    status: string;
  };

  return {
    entryId: entry.id,
    seasonId: entry.seasonId,
    userId: entry.userId,
    roundId: entry.roundId,
    weekN: entry.weekN,
    pickedTeamId: entry.pickedTeamId,
    status: entry.status as SurvivorStatus,
  };
}

export type MatchResultForTeam = "win" | "loss" | "draw";

/** Determine le resultat d'un match du point de vue d'une equipe. */
export function computeTeamResult(
  outcome: string,
  isHome: boolean,
): MatchResultForTeam {
  if (outcome === "draw") return "draw";
  if (outcome === "home") return isHome ? "win" : "loss";
  if (outcome === "away") return isHome ? "loss" : "win";
  return "draw";
}

export interface SettleRoundInput {
  readonly roundId: string;
}

export interface SettleRoundResult {
  readonly roundId: string;
  readonly entriesSettled: number;
  readonly alive: number;
  readonly eliminated: number;
}

/**
 * Settle tous les survivor entries d'un round termine. Pour chaque
 * entry "pending" :
 *  - Trouve le match ou la team piquee a joue
 *  - Calcule le resultat (win/loss/draw)
 *  - win → status="alive", loss/draw → "eliminated"
 *
 * Idempotent : skip les entries deja settle (status != "pending").
 */
export async function settleSurvivorRound(
  input: SettleRoundInput,
): Promise<SettleRoundResult> {
  const entries = (await prisma.proSurvivorEntry.findMany({
    where: { roundId: input.roundId, status: "pending" },
    select: {
      id: true,
      pickedTeamId: true,
    },
  })) as Array<{ id: string; pickedTeamId: string }>;

  if (entries.length === 0) {
    return {
      roundId: input.roundId,
      entriesSettled: 0,
      alive: 0,
      eliminated: 0,
    };
  }

  const teamIds = Array.from(new Set(entries.map((e) => e.pickedTeamId)));
  const matches = (await prisma.proLeagueMatch.findMany({
    where: {
      roundId: input.roundId,
      OR: [
        { homeTeamId: { in: teamIds } },
        { awayTeamId: { in: teamIds } },
      ],
    },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      outcome: true,
    },
  })) as Array<{
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    outcome: string | null;
  }>;

  let alive = 0;
  let eliminated = 0;

  for (const entry of entries) {
    const m = matches.find(
      (mm) =>
        mm.homeTeamId === entry.pickedTeamId ||
        mm.awayTeamId === entry.pickedTeamId,
    );
    if (!m || !m.outcome) {
      continue; // pas de match settle pour cette team, on saute
    }
    const isHome = m.homeTeamId === entry.pickedTeamId;
    const result = computeTeamResult(m.outcome, isHome);
    const status: SurvivorStatus = result === "win" ? "alive" : "eliminated";
    if (status === "alive") alive += 1;
    else eliminated += 1;
    await prisma.proSurvivorEntry.update({
      where: { id: entry.id },
      data: { status, result, matchId: m.id },
    });
  }

  return {
    roundId: input.roundId,
    entriesSettled: alive + eliminated,
    alive,
    eliminated,
  };
}

export interface SurvivorMyStatus {
  readonly seasonId: string;
  readonly isAlive: boolean;
  readonly entries: ReadonlyArray<{
    readonly id: string;
    readonly roundId: string;
    readonly weekN: number;
    readonly pickedTeamId: string;
    readonly status: SurvivorStatus;
    readonly result: MatchResultForTeam | null;
  }>;
  readonly pickedTeamIds: readonly string[];
}

/** Renvoie le statut survivor d'un user pour une saison donnee. */
export async function getMySurvivorStatus(
  seasonId: string,
  userId: string,
): Promise<SurvivorMyStatus> {
  const entries = (await prisma.proSurvivorEntry.findMany({
    where: { seasonId, userId },
    select: {
      id: true,
      roundId: true,
      weekN: true,
      pickedTeamId: true,
      status: true,
      result: true,
    },
    orderBy: { weekN: "asc" },
  })) as Array<{
    id: string;
    roundId: string;
    weekN: number;
    pickedTeamId: string;
    status: string;
    result: string | null;
  }>;

  const isAlive =
    entries.length === 0
      ? true
      : !entries.some((e) => e.status === "eliminated");

  return {
    seasonId,
    isAlive,
    entries: entries.map((e) => ({
      id: e.id,
      roundId: e.roundId,
      weekN: e.weekN,
      pickedTeamId: e.pickedTeamId,
      status: e.status as SurvivorStatus,
      result: e.result as MatchResultForTeam | null,
    })),
    pickedTeamIds: entries.map((e) => e.pickedTeamId),
  };
}

export interface SurvivorStandingsEntry {
  readonly userId: string;
  readonly userName: string | null;
  // BUG fix audit round 6 (CRITICAL/PII) : `userEmail` retire.
  // Avant, le standings public exposait chaque email participant via
  // GET /pro-league/survivor/:seasonId/standings → PII / GDPR.
  readonly weeksSurvived: number;
  readonly isAlive: boolean;
}

/**
 * Standings agreges : pour chaque participant de la saison, nombre de
 * semaines survecues + statut actuel. Trie par weeksSurvived desc, puis
 * isAlive desc, puis name asc.
 */
export async function getSurvivorStandings(
  seasonId: string,
): Promise<SurvivorStandingsEntry[]> {
  // Audit round 6 (CRITICAL/PII) : drop `email` du select. Le sort
  // fallback utilise userId (non plus email).
  const entries = (await prisma.proSurvivorEntry.findMany({
    where: { seasonId },
    select: {
      userId: true,
      status: true,
      user: { select: { name: true } },
    },
  })) as Array<{
    userId: string;
    status: string;
    user: { name: string | null };
  }>;

  if (entries.length === 0) return [];

  const byUser = new Map<
    string,
    {
      userName: string | null;
      alive: number;
      eliminated: number;
      pending: number;
    }
  >();

  for (const e of entries) {
    if (!byUser.has(e.userId)) {
      byUser.set(e.userId, {
        userName: e.user.name,
        alive: 0,
        eliminated: 0,
        pending: 0,
      });
    }
    const bucket = byUser.get(e.userId)!;
    if (e.status === "alive") bucket.alive += 1;
    else if (e.status === "eliminated") bucket.eliminated += 1;
    else bucket.pending += 1;
  }

  const standings: SurvivorStandingsEntry[] = [];
  for (const [userId, b] of byUser) {
    standings.push({
      userId,
      userName: b.userName,
      weeksSurvived: b.alive,
      isAlive: b.eliminated === 0,
    });
  }

  standings.sort((a, b) => {
    if (b.weeksSurvived !== a.weeksSurvived) {
      return b.weeksSurvived - a.weeksSurvived;
    }
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    // Audit round 6 : fallback sur userId (pas email) pour le sort.
    const nA = a.userName ?? a.userId;
    const nB = b.userName ?? b.userId;
    return nA.localeCompare(nB);
  });

  return standings;
}
