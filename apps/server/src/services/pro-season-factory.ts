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
import { ENGINE_VER as CURRENT_ENGINE_VER } from "@bb/sim-engine";
import { OLD_WORLD_LEAGUE_SLUG } from "../seeders/pro-league";

export class SeasonFactoryError extends Error {
  constructor(
    public readonly code:
      | "SEASON_NOT_FOUND"
      | "SEASON_HAS_RESULTS"
      | "MATCH_NOT_FOUND"
      | "MATCH_ALREADY_COMPLETED"
      | "INVALID_INPUT"
      | "DUPLICATE_YEAR"
      | "LEAGUE_NOT_FOUND"
      | "NO_TEAMS",
    message: string,
  ) {
    super(message);
    this.name = "SeasonFactoryError";
  }
}

// ---------------------------------------------------------------------------
// createSeason — bootstrap d'une saison Pro League from scratch
// ---------------------------------------------------------------------------

export interface CreateSeasonInput {
  /** Annee de la saison (2020..2100, unique par ligue). */
  readonly year: number;
  /** Driver de simulation : default "hybrid". */
  readonly driverKind?: "hybrid" | "full";
  /** engineVer pinne : default CURRENT_ENGINE_VER de @bb/sim-engine. */
  readonly engineVer?: string;
}

export interface CreateSeasonResult {
  readonly seasonId: string;
  readonly leagueId: string;
  readonly year: number;
  readonly engineVer: string;
  readonly driverKind: string;
}

/**
 * Cree une nouvelle saison Pro League pour la ligue singleton
 * `old-world-league`. Initialise les `ProLeagueStandings` a zero pour
 * les 16 teams (ou ce qui est en DB).
 *
 * Le schedule n'est PAS genere ici — appeler ensuite
 * `buildProLeagueSchedule({ seasonId })` pour creer les 15 rounds + 120
 * matches du round-robin.
 *
 * Refuse si :
 *  - la ligue singleton n'est pas seedee (LEAGUE_NOT_FOUND) ;
 *  - une saison avec ce `year` existe deja (DUPLICATE_YEAR) ;
 *  - aucune team n'est en DB (NO_TEAMS).
 */
export async function createSeason(
  input: CreateSeasonInput,
): Promise<CreateSeasonResult> {
  if (!Number.isInteger(input.year) || input.year < 2020 || input.year > 2100) {
    throw new SeasonFactoryError(
      "INVALID_INPUT",
      `year doit etre un entier 2020..2100 (recu: ${input.year})`,
    );
  }

  const league = await prisma.proLeague.findUnique({
    where: { slug: OLD_WORLD_LEAGUE_SLUG },
    select: { id: true },
  });
  if (!league) {
    throw new SeasonFactoryError(
      "LEAGUE_NOT_FOUND",
      `Ligue '${OLD_WORLD_LEAGUE_SLUG}' introuvable. Lance d'abord le seed (Utilitaires → Reseed Pro League).`,
    );
  }

  const duplicate = await prisma.proLeagueSeason.findUnique({
    where: { leagueId_year: { leagueId: league.id, year: input.year } },
    select: { id: true },
  });
  if (duplicate) {
    throw new SeasonFactoryError(
      "DUPLICATE_YEAR",
      `Une saison existe deja pour year=${input.year}`,
    );
  }

  const teams = (await prisma.proTeam.findMany({
    where: { leagueId: league.id },
    select: { id: true },
  })) as Array<{ id: string }>;
  if (teams.length === 0) {
    throw new SeasonFactoryError(
      "NO_TEAMS",
      "Aucune equipe en DB. Lance d'abord le seed (Utilitaires → Reseed Pro League).",
    );
  }

  const driverKind = input.driverKind ?? "hybrid";
  const engineVer = input.engineVer ?? CURRENT_ENGINE_VER;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await prisma.$transaction(async (tx: any) => {
    const newSeason = await tx.proLeagueSeason.create({
      data: {
        leagueId: league.id,
        year: input.year,
        status: "scheduled",
        engineVer,
        driverKind,
      },
      select: { id: true },
    });
    await tx.proLeagueStandings.createMany({
      data: teams.map((team) => ({
        seasonId: newSeason.id as string,
        teamId: team.id,
      })),
    });
    return newSeason;
  });

  return {
    seasonId: created.id as string,
    leagueId: league.id,
    year: input.year,
    engineVer,
    driverKind,
  };
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
  // BUG fix audit round 8 (HIGH) : avant, seul `archived` etait refuse.
  // Un admin click accidentel sur "reset" pendant un season `in_progress`
  // (matches deja completed) wipait les standings live → impact direct
  // sur le classement public. Refuse si au moins 1 match completed
  // sauf si la saison n'a jamais demarre (status='scheduled').
  if (season.status === "in_progress") {
    const completedCount = await prisma.proLeagueMatch.count({
      where: { seasonId, status: "completed" },
    });
    if (completedCount > 0) {
      throw new SeasonFactoryError(
        "SEASON_HAS_RESULTS",
        `Saison en cours avec ${completedCount} matchs completed — reset refuse pour eviter une perte de donnees. Cancel la saison d'abord.`,
      );
    }
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
    // BUG fix audit round 8 (HIGH/race) : avant, read `season.status`,
    // branch, puis `update()` inconditionnel. Un autre admin pouvant
    // archive la saison entre read et write → cancel ecrase l'archive.
    // Fix : updateMany WHERE conditionnel `status: { notIn: [archived,
    // cancelled] }` → no-op si la saison est dans un etat protege.
    await prisma.proLeagueSeason.updateMany({
      where: {
        id: seasonId,
        status: { notIn: ["archived", "cancelled"] },
      },
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

  // BUG fix audit round 7 (HIGH/race) : avant, read `match.status`,
  // check, puis `update()` sequentiel hors transaction. Deux admin
  // forfeit racing pouvaient tous deux passer le check et tous deux
  // overwrite outcome / scoreHome / scoreAway → inversion possible
  // (un admin set winner='home', l'autre 'away' → resultat final
  // depend de l'ordre des writes, pas du premier admin).
  // Fix : updateMany conditionnel WHERE status: { not: "completed" }
  // → un seul appel reussit. Si count===0, throw MATCH_ALREADY_COMPLETED.
  const now = new Date();
  const updateResult = await prisma.proLeagueMatch.updateMany({
    where: { id: matchId, status: { not: "completed" } },
    data: {
      status: "completed",
      outcome: winnerSide,
      scoreHome: winnerSide === "home" ? 1 : 0,
      scoreAway: winnerSide === "away" ? 1 : 0,
      simulatedAt: now,
      completedAt: now,
    },
  });
  if (updateResult.count === 0) {
    throw new SeasonFactoryError(
      "MATCH_ALREADY_COMPLETED",
      "Le match est deja completed (race condition concurrent forfeit)",
    );
  }

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
