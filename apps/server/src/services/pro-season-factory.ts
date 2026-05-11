/**
 * Lot P.B.3 — Pro League season factory.
 *
 * Operations administrateur sur les saisons Pro League. Chaque fonction
 * est idempotente OU refuse l'action si elle est destructrice et que le
 * pre-requis n'est pas rempli (ex: refuse `regenerateSchedule` si un
 * match a deja ete simule, cf. `pro-league-scheduler.ts`).
 *
 * Compose avec :
 *  - `buildProLeagueSchedule` / `regenerateProLeagueSchedule` (deja existants)
 *    pour la generation du round-robin.
 *
 * Toutes les operations qui touchent la DB le font via une seule
 * `$transaction` quand plusieurs tables sont impactees, pour garantir
 * l'atomicite (pas d'etat intermediaire visible).
 */

import { prisma } from "../prisma";

export class SeasonFactoryError extends Error {
  constructor(
    public readonly code:
      | "SEASON_NOT_FOUND"
      | "SEASON_HAS_RESULTS"
      | "MATCH_NOT_FOUND"
      | "MATCH_ALREADY_COMPLETED"
      | "INVALID_INPUT"
      | "DUPLICATE_YEAR",
    message: string,
  ) {
    super(message);
    this.name = "SeasonFactoryError";
  }
}

// ---------------------------------------------------------------------------
// resetStandings
// ---------------------------------------------------------------------------

export interface ResetStandingsResult {
  readonly seasonId: string;
  readonly resetCount: number;
}

/**
 * Remet a zero tous les `ProLeagueStandings` d'une saison (played, wins,
 * draws, losses, points, td*, casualties*, form vide). Conserve les
 * lignes (un standings par team x saison) car elles peuvent etre
 * referencees ailleurs ; on les vide sans les supprimer.
 *
 * Refuse si la saison est `archived` (donnees historiques figees).
 */
export async function resetStandings(
  seasonId: string,
): Promise<ResetStandingsResult> {
  const season = await prisma.proLeagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new SeasonFactoryError(
      "SEASON_NOT_FOUND",
      `Saison '${seasonId}' introuvable`,
    );
  }
  if (season.status === "archived") {
    throw new SeasonFactoryError(
      "SEASON_HAS_RESULTS",
      "Impossible de reset une saison archivee",
    );
  }

  const result = await prisma.proLeagueStandings.updateMany({
    where: { seasonId },
    data: {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      tdFor: 0,
      tdAgainst: 0,
      casualtiesFor: 0,
      casualtiesAgainst: 0,
      form: [],
    },
  });

  return { seasonId, resetCount: result.count };
}

// ---------------------------------------------------------------------------
// cancelSeason
// ---------------------------------------------------------------------------

export interface CancelSeasonResult {
  readonly seasonId: string;
  readonly previousStatus: string;
}

/**
 * Annule une saison : passe `status` a "cancelled". Idempotent : appel
 * sur une saison deja annulee renvoie le previous status (= "cancelled").
 * Refuse `archived` (intouchable).
 */
export async function cancelSeason(
  seasonId: string,
): Promise<CancelSeasonResult> {
  const season = await prisma.proLeagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new SeasonFactoryError(
      "SEASON_NOT_FOUND",
      `Saison '${seasonId}' introuvable`,
    );
  }
  if (season.status === "archived") {
    throw new SeasonFactoryError(
      "SEASON_HAS_RESULTS",
      "Impossible d'annuler une saison archivee",
    );
  }

  const previousStatus = season.status;
  if (previousStatus !== "cancelled") {
    await prisma.proLeagueSeason.update({
      where: { id: seasonId },
      data: { status: "cancelled" },
    });
  }
  return { seasonId, previousStatus };
}

// ---------------------------------------------------------------------------
// forceForfeit
// ---------------------------------------------------------------------------

export type WinnerSide = "home" | "away";

export interface ForceForfeitInput {
  readonly matchId: string;
  readonly winnerSide: WinnerSide;
}

export interface ForceForfeitResult {
  readonly matchId: string;
  readonly winnerSide: WinnerSide;
  readonly previousStatus: string;
}

/**
 * Forfait administratif sur un match Pro League : passe `status` a
 * "completed" avec `outcome` = "home" | "away" et `scoreHome/Away` mis
 * a (1, 0) ou (0, 1). N'execute pas le sim-engine et ne genere pas de
 * replay — c'est une decision purement administrative.
 *
 * Refuse si le match est deja `completed` (idempotence stricte ; pour
 * corriger un resultat, utiliser un endpoint dedie ulterieur).
 */
export async function forceForfeit(
  input: ForceForfeitInput,
): Promise<ForceForfeitResult> {
  const { matchId, winnerSide } = input;
  if (winnerSide !== "home" && winnerSide !== "away") {
    throw new SeasonFactoryError(
      "INVALID_INPUT",
      "winnerSide doit etre 'home' ou 'away'",
    );
  }

  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: { id: true, status: true },
  });
  if (!match) {
    throw new SeasonFactoryError(
      "MATCH_NOT_FOUND",
      `Match '${matchId}' introuvable`,
    );
  }
  if (match.status === "completed") {
    throw new SeasonFactoryError(
      "MATCH_ALREADY_COMPLETED",
      "Le match est deja completed",
    );
  }

  const now = new Date();
  await prisma.proLeagueMatch.update({
    where: { id: matchId },
    data: {
      status: "completed",
      outcome: winnerSide,
      scoreHome: winnerSide === "home" ? 1 : 0,
      scoreAway: winnerSide === "away" ? 1 : 0,
      simulatedAt: now,
      completedAt: now,
    },
  });

  return {
    matchId,
    winnerSide,
    previousStatus: match.status,
  };
}

// ---------------------------------------------------------------------------
// cloneSeason
// ---------------------------------------------------------------------------

export interface CloneSeasonInput {
  readonly fromSeasonId: string;
  readonly year: number;
  /** Si null, hérite `driverKind` de la saison source. */
  readonly driverKind?: "hybrid" | "full" | null;
}

export interface CloneSeasonResult {
  readonly newSeasonId: string;
  readonly fromSeasonId: string;
  readonly year: number;
}

/**
 * Clone une saison Pro League : copie la `ProLeagueSeason` (meme league,
 * meme driverKind, meme engineVer) en pointant sur une nouvelle `year`.
 * Les `ProLeagueStandings` sont initialisees a zero pour les memes 16
 * teams. Les rounds + matches NE sont PAS clones — appeler ensuite
 * `regenerateProLeagueSchedule(newSeasonId)` pour generer un calendrier
 * fresh.
 *
 * Idempotence : refuse si une saison avec (leagueId, year) existe deja.
 */
export async function cloneSeason(
  input: CloneSeasonInput,
): Promise<CloneSeasonResult> {
  const from = await prisma.proLeagueSeason.findUnique({
    where: { id: input.fromSeasonId },
    select: {
      id: true,
      leagueId: true,
      engineVer: true,
      driverKind: true,
    },
  });
  if (!from) {
    throw new SeasonFactoryError(
      "SEASON_NOT_FOUND",
      `Saison '${input.fromSeasonId}' introuvable`,
    );
  }

  const duplicate = await prisma.proLeagueSeason.findUnique({
    where: {
      leagueId_year: { leagueId: from.leagueId, year: input.year },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new SeasonFactoryError(
      "DUPLICATE_YEAR",
      `Une saison existe deja pour leagueId=${from.leagueId} year=${input.year}`,
    );
  }

  // Recupere les teams pour initialiser le standings.
  const teams = (await prisma.proTeam.findMany({
    where: { leagueId: from.leagueId },
    select: { id: true },
  })) as Array<{ id: string }>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await prisma.$transaction(async (tx: any) => {
    const newSeason = await tx.proLeagueSeason.create({
      data: {
        leagueId: from.leagueId,
        year: input.year,
        status: "scheduled",
        engineVer: from.engineVer,
        driverKind: input.driverKind ?? from.driverKind,
      },
      select: { id: true },
    });

    if (teams.length > 0) {
      await tx.proLeagueStandings.createMany({
        data: teams.map((team) => ({
          seasonId: newSeason.id as string,
          teamId: team.id,
        })),
      });
    }

    return newSeason;
  });

  return {
    newSeasonId: created.id as string,
    fromSeasonId: from.id as string,
    year: input.year,
  };
}
