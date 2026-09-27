/**
 * Pronostics de ligue — cœur LÉGER : appartenance, classement d'une saison
 * sans lecteur, statistiques d'un utilisateur.
 *
 * Volontairement sans dépendance lourde (ni `league-access`, ni
 * `league-playoffs`, qui tirent tout `services/league`) : le palmarès
 * (`league-scoring`) et les succès (`achievements`) s'appuient dessus sans
 * créer de cycle d'import avec la chaîne des résultats.
 */

import { prisma } from "../prisma";
import {
  computePredictionLeaderboard,
  gradePrediction,
  isSettledGrade,
  leaderboardLeaders,
  parsePredictionScope,
  predictionGroupOf,
  predictorDisplayName,
  type LeaderboardPrediction,
  type PredictionLeaderboard,
  type PredictionScope,
} from "./league-predictions-rules";

// ---------------------------------------------------------------------------
// Lignes et sélections partagées
// ---------------------------------------------------------------------------

export interface LeagueRow {
  readonly id: string;
  readonly creatorId: string;
  readonly isPublic: boolean;
  readonly status: string;
  readonly predictionsScope: string | null;
}

export interface PredictionRow {
  readonly userId: string;
  readonly pick: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly result: string | null;
  readonly resultHomeScore: number | null;
  readonly resultAwayScore: number | null;
  readonly user: {
    readonly coachName: string | null;
    readonly privateProfile: boolean;
  };
}

export const LEAGUE_SELECT = {
  id: true,
  creatorId: true,
  isPublic: true,
  status: true,
  predictionsScope: true,
} as const;

export const PREDICTION_SELECT = {
  userId: true,
  pick: true,
  homeScore: true,
  awayScore: true,
  result: true,
  resultHomeScore: true,
  resultAwayScore: true,
  user: { select: { coachName: true, privateProfile: true } },
} as const;

// ---------------------------------------------------------------------------
// Appartenance
// ---------------------------------------------------------------------------

/** Appartenance à la saison, lue une fois pour toutes les rencontres. */
export interface Membership {
  readonly creatorId: string;
  /** Propriétaires d'une équipe ACTIVE de la saison (groupe Coachs). */
  readonly activeCoachIds: ReadonlySet<string>;
  /** Propriétaires d'une équipe de la saison, retirée ou non. */
  readonly anyCoachIds: ReadonlySet<string>;
}

export interface MembershipSource {
  readonly league: { readonly creatorId: string };
  readonly participants: ReadonlyArray<{
    readonly status: string;
    readonly team: { readonly ownerId: string };
  }>;
}

export function membershipOf(season: MembershipSource): Membership {
  const active = new Set<string>();
  const any = new Set<string>();
  for (const p of season.participants) {
    any.add(p.team.ownerId);
    if (p.status === "active") active.add(p.team.ownerId);
  }
  return {
    creatorId: season.league.creatorId,
    activeCoachIds: active,
    anyCoachIds: any,
  };
}

/** Commissaire, ou coach d'une équipe ACTIVE : peut pronostiquer en `members`. */
export function isMember(m: Membership, userId: string | null): boolean {
  if (!userId) return false;
  return userId === m.creatorId || m.activeCoachIds.has(userId);
}

/** Déjà nommé sur la fiche de ligue : jamais anonymisé. */
export function isLeagueMember(m: Membership, userId: string): boolean {
  return userId === m.creatorId || m.anyCoachIds.has(userId);
}

// ---------------------------------------------------------------------------
// Classement d'une saison
// ---------------------------------------------------------------------------

export interface LeaderboardSource {
  readonly membership: Membership;
  readonly scope: PredictionScope;
  readonly league: LeagueRow;
  readonly predictions: ReadonlyArray<
    PredictionRow & { readonly pairing: { readonly status: string } }
  >;
}

export async function loadLeaderboardSource(
  seasonId: string,
): Promise<LeaderboardSource | null> {
  const season = (await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      league: { select: LEAGUE_SELECT },
      participants: {
        select: { status: true, team: { select: { ownerId: true } } },
      },
    },
  })) as (MembershipSource & { league: LeagueRow }) | null;
  if (!season) return null;
  const predictions = (await prisma.competitionPrediction.findMany({
    where: { pairing: { round: { seasonId } } },
    select: { ...PREDICTION_SELECT, pairing: { select: { status: true } } },
  })) as LeaderboardSource["predictions"];
  return {
    membership: membershipOf(season),
    scope: parsePredictionScope(season.league.predictionsScope),
    league: season.league,
    predictions,
  };
}

/** Lignes notées du classement ; `viewerId` ne sert qu'à l'anonymisation. */
export function leaderboardRows(
  source: LeaderboardSource,
  viewerId: string | null,
): LeaderboardPrediction[] {
  return source.predictions.map((row) => {
    const { grade, points } = gradePrediction(row, row.pairing.status);
    return {
      userId: row.userId,
      displayName: predictorDisplayName({
        coachName: row.user.coachName,
        privateProfile: row.user.privateProfile,
        isLeagueMember: isLeagueMember(source.membership, row.userId),
        isViewer: row.userId === viewerId,
      }),
      group: predictionGroupOf(source.membership.activeCoachIds.has(row.userId)),
      grade,
      points,
    };
  });
}

/**
 * Classement d'une saison sans lecteur (palmarès, succès) : aucune
 * anonymisation de membre — il ne sort jamais tel quel vers un client.
 */
export async function computeSeasonPredictionLeaderboard(
  seasonId: string,
): Promise<PredictionLeaderboard> {
  const source = await loadLeaderboardSource(seasonId);
  if (!source) return { coach: [], stands: [] };
  return computePredictionLeaderboard(leaderboardRows(source, null));
}

// ---------------------------------------------------------------------------
// Statistiques d'un utilisateur (succès)
// ---------------------------------------------------------------------------

export interface UserPredictionStats {
  /** Bons résultats, scores exacts compris. */
  readonly correct: number;
  readonly exact: number;
  /** Saisons CLÔTURÉES terminées en tête du groupe Coachs. */
  readonly oracleTitles: number;
  /** Saisons CLÔTURÉES terminées en tête du groupe Tribunes. */
  readonly standsOracleTitles: number;
}

export const EMPTY_USER_PREDICTION_STATS: UserPredictionStats = {
  correct: 0,
  exact: 0,
  oracleTitles: 0,
  standsOracleTitles: 0,
};

interface UserPredictionRow
  extends Omit<PredictionRow, "userId" | "user"> {
  readonly pairing: {
    readonly status: string;
    readonly round: {
      readonly seasonId: string;
      readonly season: { readonly status: string };
    };
  };
}

/**
 * Statistiques de pronostic d'un utilisateur, pour les succès. Les titres se
 * lisent sur les saisons CLÔTURÉES avec LA MÊME fonction que le palmarès.
 */
export async function computeUserPredictionStats(
  userId: string,
): Promise<UserPredictionStats> {
  const rows = (await prisma.competitionPrediction.findMany({
    where: { userId },
    select: {
      pick: true,
      homeScore: true,
      awayScore: true,
      result: true,
      resultHomeScore: true,
      resultAwayScore: true,
      pairing: {
        select: {
          status: true,
          round: {
            select: { seasonId: true, season: { select: { status: true } } },
          },
        },
      },
    },
  })) as readonly UserPredictionRow[];
  let correct = 0;
  let exact = 0;
  const completedSeasons = new Set<string>();
  for (const row of rows) {
    const { grade } = gradePrediction(row, row.pairing.status);
    if (grade === "exact" || grade === "outcome") correct += 1;
    if (grade === "exact") exact += 1;
    if (
      isSettledGrade(grade) &&
      row.pairing.round.season.status === "completed"
    ) {
      completedSeasons.add(row.pairing.round.seasonId);
    }
  }
  let oracleTitles = 0;
  let standsOracleTitles = 0;
  for (const seasonId of completedSeasons) {
    const board = await computeSeasonPredictionLeaderboard(seasonId);
    if (leaderboardLeaders(board.coach).some((e) => e.userId === userId)) {
      oracleTitles += 1;
    }
    if (leaderboardLeaders(board.stands).some((e) => e.userId === userId)) {
      standsOracleTitles += 1;
    }
  }
  return { correct, exact, oracleTitles, standsOracleTitles };
}
