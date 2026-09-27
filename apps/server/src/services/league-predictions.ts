/**
 * Pronostics de ligue — service (lectures et écritures Prisma).
 *
 * Toute DÉCISION vit dans le module pur `league-predictions-rules` ; ce
 * service charge les lignes, appelle les règles et écrit. Il est le SEUL
 * chemin d'écriture de `CompetitionPrediction`.
 *
 * Trois invariants à ne pas perdre (cf. `openspec/changes/league-match-predictions`) :
 *  - la visibilité de la ligue passe AVANT toute autre règle : une ligue
 *    privée invisible est introuvable, en lecture comme en écriture ;
 *  - rien des pronostics des autres ne sort avant la clôture d'une rencontre
 *    — pas même leur nombre : c'est la réponse qui les omet, pas l'écran ;
 *  - le classement est DÉRIVÉ, jamais persisté : on stocke le résultat d'une
 *    rencontre sur ses pronostics, et les points se recalculent à la lecture.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { canViewLeagueRow, type LeagueViewer } from "./league-access";
import { isPlayoffBracketVisible } from "./league-playoffs";
import { createInAppNotification } from "./in-app-notifications";
import {
  computePredictionLeaderboard,
  gradePrediction,
  isPlaceholderPairing,
  isPredictionClosed,
  leaderboardLeaders,
  outcomeOf,
  parsePredictionScope,
  pickDistribution,
  predictionClosesAt,
  predictionEligibility,
  predictionGroupOf,
  predictorDisplayName,
  validatePredictionInput,
  isSettledGrade,
  type GradablePrediction,
  type LeaderboardPrediction,
  type PickDistribution,
  type PredictionEligibility,
  type PredictionGrade,
  type PredictionGroup,
  type PredictionInputError,
  type PredictionLeaderboard,
  type PredictionLeaderboardEntry,
  type PredictionPick,
  type PredictionResult,
  type PredictionScope,
} from "./league-predictions-rules";

// ---------------------------------------------------------------------------
// Erreurs typées
// ---------------------------------------------------------------------------

export type LeaguePredictionErrorCode =
  | "season_not_found"
  | "pairing_not_found"
  | "round_not_found"
  | "league_not_found"
  | "prediction_not_found"
  | "forbidden"
  | "predictions_off"
  | "not_member"
  | "own_match"
  | "placeholder"
  | "closed"
  | "invalid_prediction";

export class LeaguePredictionError extends Error {
  constructor(
    public readonly code: LeaguePredictionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LeaguePredictionError";
  }
}

const INPUT_ERROR_MESSAGES: Readonly<Record<PredictionInputError, string>> = {
  invalid_pick: "Choix invalide : domicile, nul ou extérieur",
  partial_score:
    "Le score se donne pour les deux équipes, ou pas du tout",
  invalid_score: "Score invalide",
  score_pick_mismatch: "Le score ne correspond pas au vainqueur choisi",
};

/** Refus d'écriture, du motif d'éligibilité à l'erreur typée. */
function eligibilityError(
  reason: Exclude<PredictionEligibility, "ok">,
): LeaguePredictionError {
  switch (reason) {
    case "predictions-off":
      return new LeaguePredictionError(
        "predictions_off",
        "Les pronostics sont désactivés sur cette ligue",
      );
    case "anonymous":
    case "not-member":
      return new LeaguePredictionError(
        "not_member",
        "Les pronostics de cette ligue sont réservés à ses membres",
      );
    case "own-match":
      return new LeaguePredictionError(
        "own_match",
        "Impossible de pronostiquer une rencontre de sa propre équipe",
      );
    case "placeholder":
      return new LeaguePredictionError(
        "placeholder",
        "Cette rencontre n'est pas encore connue",
      );
    case "closed":
      return new LeaguePredictionError(
        "closed",
        "Les pronostics de cette rencontre sont fermés",
      );
  }
}

// ---------------------------------------------------------------------------
// Vues servies
// ---------------------------------------------------------------------------

export interface PredictionTeamView {
  readonly participantId: string;
  readonly teamId: string;
  readonly name: string;
  readonly roster: string;
  readonly logoUrl: string | null;
  readonly coachName: string | null;
}

export interface PredictionView {
  readonly pick: PredictionPick;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly grade: PredictionGrade;
  readonly points: number;
}

export interface OtherPredictionView extends PredictionView {
  readonly userId: string;
  readonly displayName: string;
  readonly group: PredictionGroup;
  readonly isViewer: boolean;
}

export interface PairingResultView {
  readonly outcome: PredictionResult;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
}

export interface PairingPredictionsView {
  readonly id: string;
  readonly status: string;
  readonly scheduledAt: Date | null;
  readonly closesAt: Date | null;
  readonly closed: boolean;
  readonly placeholder: boolean;
  readonly home: PredictionTeamView;
  readonly away: PredictionTeamView;
  readonly result: PairingResultView | null;
  readonly eligibility: PredictionEligibility;
  /** Le lecteur peut fermer cette rencontre (coach de la rencontre, commissaire, admin). */
  readonly canClose: boolean;
  readonly myPrediction: PredictionView | null;
  /** Pronostics de tous — `null` tant que la rencontre est ouverte. */
  readonly predictions: readonly OtherPredictionView[] | null;
  /** Répartition des choix — `null` tant que la rencontre est ouverte. */
  readonly distribution: PickDistribution | null;
}

export interface RoundPredictionsView {
  readonly id: string;
  readonly roundNumber: number;
  readonly name: string | null;
  readonly status: string;
  readonly kind: string;
  readonly startDate: Date | null;
  /** Le lecteur peut fermer toute la journée (commissaire, admin). */
  readonly canClose: boolean;
  readonly pairings: readonly PairingPredictionsView[];
}

export interface SeasonPredictionsView {
  readonly seasonId: string;
  readonly leagueId: string;
  /** Portée EFFECTIVE. */
  readonly scope: PredictionScope;
  /** Faux sur une ligue antérieure (colonne à `null`) : flag brut. */
  readonly scopeConfigured: boolean;
  readonly viewer: {
    readonly userId: string | null;
    readonly isCommissioner: boolean;
    readonly isMember: boolean;
    readonly group: PredictionGroup | null;
  };
  readonly rounds: readonly RoundPredictionsView[];
}

export interface LeaderboardEntryView extends PredictionLeaderboardEntry {
  readonly isViewer: boolean;
}

export interface SeasonPredictionLeaderboardView {
  readonly seasonId: string;
  readonly scope: PredictionScope;
  readonly coach: readonly LeaderboardEntryView[];
  readonly stands: readonly LeaderboardEntryView[];
}

// ---------------------------------------------------------------------------
// Chargements
// ---------------------------------------------------------------------------

interface PredictionRow {
  readonly userId: string;
  readonly pick: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly result: string | null;
  readonly resultHomeScore: number | null;
  readonly resultAwayScore: number | null;
  readonly user: { readonly coachName: string | null; readonly privateProfile: boolean };
}

interface ParticipantRow {
  readonly id: string;
  readonly teamId: string;
  readonly team: {
    readonly id: string;
    readonly name: string;
    readonly roster: string;
    readonly logoUrl: string | null;
    readonly ownerId: string;
    readonly owner: { readonly coachName: string | null } | null;
  };
}

interface PairingRow {
  readonly id: string;
  readonly status: string;
  readonly scheduledAt: Date | null;
  readonly predictionsClosedAt: Date | null;
  readonly homeParticipantId: string;
  readonly awayParticipantId: string;
  readonly homeParticipant: ParticipantRow;
  readonly awayParticipant: ParticipantRow;
  readonly matchSheet: {
    readonly status: string;
    readonly scoreHome: number | null;
    readonly scoreAway: number | null;
  } | null;
  readonly predictions: readonly PredictionRow[];
}

interface RoundRow {
  readonly id: string;
  readonly roundNumber: number;
  readonly name: string | null;
  readonly status: string;
  readonly kind: string;
  readonly bracketSlot: string | null;
  readonly startDate: Date | null;
  readonly pairings: readonly PairingRow[];
}

interface LeagueRow {
  readonly id: string;
  readonly creatorId: string;
  readonly isPublic: boolean;
  readonly status: string;
  readonly predictionsScope: string | null;
}

interface SeasonRow {
  readonly id: string;
  readonly status: string;
  readonly playoffsPublished: boolean | null;
  readonly league: LeagueRow;
  readonly participants: ReadonlyArray<{
    readonly status: string;
    readonly team: { readonly ownerId: string };
  }>;
  readonly rounds: readonly RoundRow[];
}

const LEAGUE_SELECT = {
  id: true,
  creatorId: true,
  isPublic: true,
  status: true,
  predictionsScope: true,
} as const;

const PARTICIPANT_SELECT = {
  id: true,
  teamId: true,
  team: {
    select: {
      id: true,
      name: true,
      roster: true,
      logoUrl: true,
      ownerId: true,
      owner: { select: { coachName: true } },
    },
  },
} as const;

const PREDICTION_SELECT = {
  userId: true,
  pick: true,
  homeScore: true,
  awayScore: true,
  result: true,
  resultHomeScore: true,
  resultAwayScore: true,
  user: { select: { coachName: true, privateProfile: true } },
} as const;

async function loadSeason(seasonId: string): Promise<SeasonRow | null> {
  return (await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      status: true,
      playoffsPublished: true,
      league: { select: LEAGUE_SELECT },
      participants: {
        select: { status: true, team: { select: { ownerId: true } } },
      },
      rounds: {
        orderBy: { roundNumber: "asc" },
        select: {
          id: true,
          roundNumber: true,
          name: true,
          status: true,
          kind: true,
          bracketSlot: true,
          startDate: true,
          pairings: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              status: true,
              scheduledAt: true,
              predictionsClosedAt: true,
              homeParticipantId: true,
              awayParticipantId: true,
              homeParticipant: { select: PARTICIPANT_SELECT },
              awayParticipant: { select: PARTICIPANT_SELECT },
              matchSheet: {
                select: { status: true, scoreHome: true, scoreAway: true },
              },
              predictions: { select: PREDICTION_SELECT },
            },
          },
        },
      },
    },
  })) as SeasonRow | null;
}

/** Appartenance à la saison, lue une fois pour toutes les rencontres. */
interface Membership {
  readonly creatorId: string;
  /** Propriétaires d'une équipe ACTIVE de la saison (groupe Coachs). */
  readonly activeCoachIds: ReadonlySet<string>;
  /** Propriétaires d'une équipe de la saison, retirée ou non. */
  readonly anyCoachIds: ReadonlySet<string>;
}

function membershipOf(season: {
  readonly league: { readonly creatorId: string };
  readonly participants: ReadonlyArray<{
    readonly status: string;
    readonly team: { readonly ownerId: string };
  }>;
}): Membership {
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
function isMember(m: Membership, userId: string | null): boolean {
  if (!userId) return false;
  return userId === m.creatorId || m.activeCoachIds.has(userId);
}

/** Déjà nommé sur la fiche de ligue : jamais anonymisé. */
function isLeagueMember(m: Membership, userId: string): boolean {
  return userId === m.creatorId || m.anyCoachIds.has(userId);
}

function isPlayoffRound(round: { kind: string; bracketSlot: string | null }) {
  // `kind` a pour défaut "regular" : un tour de bracket créé à la main ne se
  // déclare pas play-off, `bracketSlot` suffit à le reconnaître.
  return round.kind === "playoff" || round.bracketSlot !== null;
}

function toVisibilityRow(league: LeagueRow) {
  return { id: league.id, creatorId: league.creatorId, isPublic: league.isPublic };
}

// ---------------------------------------------------------------------------
// Lecture d'une saison
// ---------------------------------------------------------------------------

function teamView(p: ParticipantRow): PredictionTeamView {
  return {
    participantId: p.id,
    teamId: p.teamId,
    name: p.team.name,
    roster: p.team.roster,
    logoUrl: p.team.logoUrl ?? null,
    coachName: p.team.owner?.coachName ?? null,
  };
}

/**
 * Résultat affiché d'une rencontre : forfait / annulation, sinon le résultat
 * copié au règlement, sinon le score de la feuille validée (même source que
 * le calendrier).
 */
function resultView(pairing: PairingRow): PairingResultView | null {
  if (
    pairing.status === "forfeit_home" ||
    pairing.status === "forfeit_away" ||
    pairing.status === "cancelled"
  ) {
    return { outcome: "void", homeScore: null, awayScore: null };
  }
  if (pairing.status !== "played") return null;
  const settled = pairing.predictions.find((p) => p.result !== null);
  if (settled) {
    return {
      outcome: settled.result as PredictionResult,
      homeScore: settled.resultHomeScore,
      awayScore: settled.resultAwayScore,
    };
  }
  const sheet = pairing.matchSheet;
  if (
    sheet &&
    sheet.status === "validated" &&
    sheet.scoreHome !== null &&
    sheet.scoreAway !== null
  ) {
    return {
      outcome: outcomeOf(sheet.scoreHome, sheet.scoreAway),
      homeScore: sheet.scoreHome,
      awayScore: sheet.scoreAway,
    };
  }
  return null;
}

function predictionView(row: PredictionRow, pairingStatus: string): PredictionView {
  const { grade, points } = gradePrediction(row, pairingStatus);
  return {
    pick: row.pick as PredictionPick,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    grade,
    points,
  };
}

function othersView(
  pairing: PairingRow,
  membership: Membership,
  viewerId: string | null,
): OtherPredictionView[] {
  return pairing.predictions
    .map((row) => ({
      ...predictionView(row, pairing.status),
      userId: row.userId,
      displayName: predictorDisplayName({
        coachName: row.user.coachName,
        privateProfile: row.user.privateProfile,
        isLeagueMember: isLeagueMember(membership, row.userId),
        isViewer: row.userId === viewerId,
      }),
      group: predictionGroupOf(membership.activeCoachIds.has(row.userId)),
      isViewer: row.userId === viewerId,
    }))
    .sort(
      (a, b) =>
        b.points - a.points || a.displayName.localeCompare(b.displayName, "fr"),
    );
}

export async function getSeasonPredictions(input: {
  readonly seasonId: string;
  readonly viewer: LeagueViewer;
  readonly now?: Date;
}): Promise<SeasonPredictionsView> {
  const now = input.now ?? new Date();
  const season = await loadSeason(input.seasonId);
  if (
    !season ||
    !(await canViewLeagueRow(toVisibilityRow(season.league), input.viewer))
  ) {
    throw new LeaguePredictionError("season_not_found", "Saison introuvable");
  }
  const league = season.league;
  const viewerId = input.viewer.userId;
  const membership = membershipOf(season);
  const scope = parsePredictionScope(league.predictionsScope);
  const isCommissioner = viewerId !== null && viewerId === league.creatorId;
  const isAdmin = input.viewer.isAdmin === true;
  const member = isMember(membership, viewerId);

  const base = {
    seasonId: season.id,
    leagueId: league.id,
    scope,
    scopeConfigured: league.predictionsScope !== null,
    viewer: {
      userId: viewerId,
      isCommissioner,
      isMember: member,
      group: viewerId
        ? predictionGroupOf(membership.activeCoachIds.has(viewerId))
        : null,
    },
  };
  // Pronostics coupés : rien à servir — pas même le calendrier des
  // pronostics d'une ligue qui en a eu.
  if (scope === "off") return { ...base, rounds: [] };

  const playoffsVisible = isPlayoffBracketVisible(season.playoffsPublished);
  const rounds: RoundPredictionsView[] = [];
  for (const round of season.rounds) {
    const hiddenPlayoff = isPlayoffRound(round) && !playoffsVisible;
    // Gater un contenu, c'est gater TOUTES ses lectures : une journée de
    // play-off non publiée n'apparaît qu'au commissaire (comme au calendrier).
    if (hiddenPlayoff && !isCommissioner) continue;

    const pairings = round.pairings.map((pairing): PairingPredictionsView => {
      const closed = isPredictionClosed(
        {
          status: pairing.status,
          predictionsClosedAt: pairing.predictionsClosedAt,
          scheduledAt: pairing.scheduledAt,
          hiddenPlayoff,
          leagueArchived: league.status === "archived",
        },
        now,
      );
      const placeholder = isPlaceholderPairing(
        pairing.homeParticipantId,
        pairing.awayParticipantId,
      );
      const homeOwner = pairing.homeParticipant.team.ownerId;
      const awayOwner = pairing.awayParticipant.team.ownerId;
      const ownsPairingTeam =
        viewerId !== null && (viewerId === homeOwner || viewerId === awayOwner);
      const mine = viewerId
        ? pairing.predictions.find((p) => p.userId === viewerId)
        : undefined;
      return {
        id: pairing.id,
        status: pairing.status,
        scheduledAt: pairing.scheduledAt,
        closesAt: predictionClosesAt(pairing),
        closed,
        placeholder,
        home: teamView(pairing.homeParticipant),
        away: teamView(pairing.awayParticipant),
        result: resultView(pairing),
        eligibility: predictionEligibility({
          scope,
          viewerId,
          isMember: member,
          ownsPairingTeam,
          placeholder,
          closed,
        }),
        canClose:
          !closed && (isAdmin || isCommissioner || ownsPairingTeam),
        myPrediction: mine ? predictionView(mine, pairing.status) : null,
        // RIEN des autres avant la clôture — ni les choix, ni leur nombre.
        predictions: closed ? othersView(pairing, membership, viewerId) : null,
        distribution: closed
          ? pickDistribution(pairing.predictions.map((p) => p.pick))
          : null,
      };
    });
    rounds.push({
      id: round.id,
      roundNumber: round.roundNumber,
      name: round.name,
      status: round.status,
      kind: round.kind,
      startDate: round.startDate,
      canClose:
        (isAdmin || isCommissioner) && pairings.some((p) => !p.closed),
      pairings,
    });
  }
  return { ...base, rounds };
}

// ---------------------------------------------------------------------------
// Classement
// ---------------------------------------------------------------------------

interface LeaderboardSource {
  readonly membership: Membership;
  readonly scope: PredictionScope;
  readonly league: LeagueRow;
  readonly predictions: ReadonlyArray<
    PredictionRow & { readonly pairing: { readonly status: string } }
  >;
}

async function loadLeaderboardSource(
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
  })) as Pick<SeasonRow, "id" | "league" | "participants"> | null;
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

function leaderboardRows(
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
 * Classement d'une saison sans lecteur (palmarès, succès) : tous les noms,
 * aucune anonymisation — il ne sort pas tel quel vers un client.
 */
export async function computeSeasonPredictionLeaderboard(
  seasonId: string,
): Promise<PredictionLeaderboard> {
  const source = await loadLeaderboardSource(seasonId);
  if (!source) return { coach: [], stands: [] };
  return computePredictionLeaderboard(leaderboardRows(source, null));
}

export async function getSeasonPredictionLeaderboard(input: {
  readonly seasonId: string;
  readonly viewer: LeagueViewer;
}): Promise<SeasonPredictionLeaderboardView> {
  const source = await loadLeaderboardSource(input.seasonId);
  if (
    !source ||
    !(await canViewLeagueRow(toVisibilityRow(source.league), input.viewer))
  ) {
    throw new LeaguePredictionError("season_not_found", "Saison introuvable");
  }
  if (source.scope === "off") {
    return { seasonId: input.seasonId, scope: "off", coach: [], stands: [] };
  }
  const viewerId = input.viewer.userId;
  const board = computePredictionLeaderboard(leaderboardRows(source, viewerId));
  const mark = (e: PredictionLeaderboardEntry): LeaderboardEntryView => ({
    ...e,
    isViewer: e.userId === viewerId,
  });
  return {
    seasonId: input.seasonId,
    scope: source.scope,
    coach: board.coach.map(mark),
    stands: board.stands.map(mark),
  };
}

// ---------------------------------------------------------------------------
// Écritures d'un pronostic
// ---------------------------------------------------------------------------

interface PairingContext {
  readonly id: string;
  readonly status: string;
  readonly scheduledAt: Date | null;
  readonly predictionsClosedAt: Date | null;
  readonly homeParticipantId: string;
  readonly awayParticipantId: string;
  readonly homeParticipant: { readonly team: { readonly ownerId: string } };
  readonly awayParticipant: { readonly team: { readonly ownerId: string } };
  readonly round: {
    readonly id: string;
    readonly kind: string;
    readonly bracketSlot: string | null;
    readonly season: {
      readonly id: string;
      readonly playoffsPublished: boolean | null;
      readonly league: LeagueRow;
    };
  };
}

async function loadPairingContext(
  pairingId: string,
  viewer: LeagueViewer,
): Promise<PairingContext> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      predictionsClosedAt: true,
      homeParticipantId: true,
      awayParticipantId: true,
      homeParticipant: { select: { team: { select: { ownerId: true } } } },
      awayParticipant: { select: { team: { select: { ownerId: true } } } },
      round: {
        select: {
          id: true,
          kind: true,
          bracketSlot: true,
          season: {
            select: {
              id: true,
              playoffsPublished: true,
              league: { select: LEAGUE_SELECT },
            },
          },
        },
      },
    },
  })) as PairingContext | null;
  if (
    !pairing ||
    !(await canViewLeagueRow(
      toVisibilityRow(pairing.round.season.league),
      viewer,
    ))
  ) {
    throw new LeaguePredictionError("pairing_not_found", "Rencontre introuvable");
  }
  return pairing;
}

function isPairingClosed(pairing: PairingContext, now: Date): boolean {
  return isPredictionClosed(
    {
      status: pairing.status,
      predictionsClosedAt: pairing.predictionsClosedAt,
      scheduledAt: pairing.scheduledAt,
      hiddenPlayoff:
        isPlayoffRound(pairing.round) &&
        !isPlayoffBracketVisible(pairing.round.season.playoffsPublished),
      leagueArchived: pairing.round.season.league.status === "archived",
    },
    now,
  );
}

async function isActiveCoachOfSeason(
  userId: string,
  seasonId: string,
): Promise<boolean> {
  const count = await prisma.leagueParticipant.count({
    where: { seasonId, status: "active", team: { ownerId: userId } },
  });
  return count > 0;
}

async function assertCanPredict(
  pairing: PairingContext,
  userId: string,
  now: Date,
): Promise<void> {
  const league = pairing.round.season.league;
  const scope = parsePredictionScope(league.predictionsScope);
  const member =
    userId === league.creatorId ||
    (scope === "members" &&
      (await isActiveCoachOfSeason(userId, pairing.round.season.id)));
  const eligibility = predictionEligibility({
    scope,
    viewerId: userId,
    isMember: member,
    ownsPairingTeam:
      userId === pairing.homeParticipant.team.ownerId ||
      userId === pairing.awayParticipant.team.ownerId,
    placeholder: isPlaceholderPairing(
      pairing.homeParticipantId,
      pairing.awayParticipantId,
    ),
    closed: isPairingClosed(pairing, now),
  });
  if (eligibility !== "ok") throw eligibilityError(eligibility);
}

export async function upsertPrediction(input: {
  readonly pairingId: string;
  readonly viewer: LeagueViewer & { readonly userId: string };
  readonly pick: unknown;
  readonly homeScore?: number | null;
  readonly awayScore?: number | null;
  readonly now?: Date;
}): Promise<{ readonly pick: PredictionPick; readonly homeScore: number | null; readonly awayScore: number | null }> {
  const now = input.now ?? new Date();
  const pairing = await loadPairingContext(input.pairingId, input.viewer);
  await assertCanPredict(pairing, input.viewer.userId, now);
  const check = validatePredictionInput(input);
  if (!check.ok) {
    throw new LeaguePredictionError(
      "invalid_prediction",
      INPUT_ERROR_MESSAGES[check.error],
    );
  }
  const data = {
    pick: check.value.pick,
    homeScore: check.value.homeScore,
    awayScore: check.value.awayScore,
  };
  await prisma.competitionPrediction.upsert({
    where: {
      pairingId_userId: { pairingId: pairing.id, userId: input.viewer.userId },
    },
    create: { pairingId: pairing.id, userId: input.viewer.userId, ...data },
    update: data,
  });
  return data;
}

export async function deletePrediction(input: {
  readonly pairingId: string;
  readonly viewer: LeagueViewer & { readonly userId: string };
  readonly now?: Date;
}): Promise<{ readonly deleted: true }> {
  const now = input.now ?? new Date();
  const pairing = await loadPairingContext(input.pairingId, input.viewer);
  if (isPairingClosed(pairing, now)) {
    throw eligibilityError("closed");
  }
  const result = await prisma.competitionPrediction.deleteMany({
    where: { pairingId: pairing.id, userId: input.viewer.userId },
  });
  if (result.count === 0) {
    throw new LeaguePredictionError(
      "prediction_not_found",
      "Aucun pronostic à retirer sur cette rencontre",
    );
  }
  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Portée et clôtures manuelles
// ---------------------------------------------------------------------------

/**
 * Portée des pronostics. Règle de LECTURE : aucun compteur persisté n'en
 * dépend, donc elle échappe au verrou d'édition de la ligue — ouverte au
 * commissaire comme à un administrateur, ligue verrouillée comprise.
 */
export async function setLeaguePredictionsScope(input: {
  readonly leagueId: string;
  readonly viewer: LeagueViewer & { readonly userId: string };
  readonly scope: PredictionScope;
}): Promise<{ readonly predictionsScope: PredictionScope }> {
  const league = (await prisma.league.findUnique({
    where: { id: input.leagueId },
    select: LEAGUE_SELECT,
  })) as LeagueRow | null;
  if (
    !league ||
    !(await canViewLeagueRow(toVisibilityRow(league), input.viewer))
  ) {
    throw new LeaguePredictionError("league_not_found", "Ligue introuvable");
  }
  if (!input.viewer.isAdmin && league.creatorId !== input.viewer.userId) {
    throw new LeaguePredictionError(
      "forbidden",
      "Seul le commissaire règle les pronostics de la ligue",
    );
  }
  await prisma.league.update({
    where: { id: league.id },
    data: { predictionsScope: input.scope },
  });
  return { predictionsScope: input.scope };
}

/**
 * Pose la clôture d'une rencontre si elle ne l'est pas encore (write-once).
 * Best-effort : ne lève JAMAIS — appelé depuis la saisie de la feuille et
 * l'enregistrement du résultat, qu'un échec ici ne doit pas faire échouer.
 */
export async function markPairingPredictionsClosed(
  pairingId: string,
  now: Date = new Date(),
): Promise<boolean> {
  try {
    const out = await prisma.leaguePairing.updateMany({
      where: { id: pairingId, predictionsClosedAt: null },
      data: { predictionsClosedAt: now },
    });
    return out.count > 0;
  } catch (e: unknown) {
    serverLog.error(
      `[league-predictions] clôture non posée pairing=${pairingId}`,
      e,
    );
    return false;
  }
}

/** « Coup d'envoi » : un coach de la rencontre, le commissaire ou un admin. */
export async function closePairingPredictions(input: {
  readonly pairingId: string;
  readonly viewer: LeagueViewer & { readonly userId: string };
  readonly now?: Date;
}): Promise<{ readonly closedAt: Date }> {
  const now = input.now ?? new Date();
  const pairing = await loadPairingContext(input.pairingId, input.viewer);
  const userId = input.viewer.userId;
  const allowed =
    input.viewer.isAdmin === true ||
    userId === pairing.round.season.league.creatorId ||
    userId === pairing.homeParticipant.team.ownerId ||
    userId === pairing.awayParticipant.team.ownerId;
  if (!allowed) {
    throw new LeaguePredictionError(
      "forbidden",
      "Seuls les coachs de la rencontre et le commissaire la ferment",
    );
  }
  if (pairing.predictionsClosedAt) {
    return { closedAt: pairing.predictionsClosedAt };
  }
  await prisma.leaguePairing.updateMany({
    where: { id: pairing.id, predictionsClosedAt: null },
    data: { predictionsClosedAt: now },
  });
  return { closedAt: now };
}

/** Ferme toute une journée : le commissaire ou un admin. */
export async function closeRoundPredictions(input: {
  readonly roundId: string;
  readonly viewer: LeagueViewer & { readonly userId: string };
  readonly now?: Date;
}): Promise<{ readonly closed: number }> {
  const now = input.now ?? new Date();
  const round = (await prisma.leagueRound.findUnique({
    where: { id: input.roundId },
    select: {
      id: true,
      season: { select: { league: { select: LEAGUE_SELECT } } },
    },
  })) as { id: string; season: { league: LeagueRow } } | null;
  if (
    !round ||
    !(await canViewLeagueRow(toVisibilityRow(round.season.league), input.viewer))
  ) {
    throw new LeaguePredictionError("round_not_found", "Journée introuvable");
  }
  if (
    !input.viewer.isAdmin &&
    round.season.league.creatorId !== input.viewer.userId
  ) {
    throw new LeaguePredictionError(
      "forbidden",
      "Seul le commissaire ferme une journée entière",
    );
  }
  const out = await prisma.leaguePairing.updateMany({
    where: { roundId: round.id, predictionsClosedAt: null },
    data: { predictionsClosedAt: now },
  });
  return { closed: out.count };
}

// ---------------------------------------------------------------------------
// Règlement (appelé par l'entonnoir des résultats)
// ---------------------------------------------------------------------------

export interface ParticipantScore {
  readonly participantId: string;
  readonly score: number;
}

/**
 * Règle les pronostics d'une rencontre dont le résultat vient d'être
 * enregistré (`recordLeagueMatchResult`, entonnoir UNIQUE des résultats de
 * ligue). Copie l'issue et le score réel — jamais des points — et pose la
 * clôture : un résultat vu ne doit pas rouvrir la rencontre après une
 * invalidation.
 *
 * Les côtés se lisent par PARTICIPANT : l'entonnoir parle de « A » et « B »,
 * pas de domicile et d'extérieur. Un forfait en ligne (score synthétique)
 * est réglé `void`. Ne lève JAMAIS : le résultat est déjà committé.
 */
export async function settleLeaguePredictionsForResult(input: {
  readonly pairingId: string;
  readonly scores: readonly ParticipantScore[];
  readonly forfeit?: boolean;
  readonly now?: Date;
}): Promise<{ readonly settled: number }> {
  const now = input.now ?? new Date();
  try {
    await markPairingPredictionsClosed(input.pairingId, now);
    if (input.forfeit) {
      const out = await prisma.competitionPrediction.updateMany({
        where: { pairingId: input.pairingId },
        data: {
          result: "void",
          resultHomeScore: null,
          resultAwayScore: null,
          settledAt: now,
        },
      });
      return { settled: out.count };
    }
    const pairing = (await prisma.leaguePairing.findUnique({
      where: { id: input.pairingId },
      select: { homeParticipantId: true, awayParticipantId: true },
    })) as { homeParticipantId: string; awayParticipantId: string } | null;
    if (!pairing) return { settled: 0 };
    const home = input.scores.find(
      (s) => s.participantId === pairing.homeParticipantId,
    );
    const away = input.scores.find(
      (s) => s.participantId === pairing.awayParticipantId,
    );
    if (!home || !away) {
      serverLog.warn(
        `[league-predictions] règlement ignoré, côtés introuvables pairing=${input.pairingId}`,
      );
      return { settled: 0 };
    }
    const out = await prisma.competitionPrediction.updateMany({
      where: { pairingId: input.pairingId },
      data: {
        result: outcomeOf(home.score, away.score),
        resultHomeScore: home.score,
        resultAwayScore: away.score,
        settledAt: now,
      },
    });
    return { settled: out.count };
  } catch (e: unknown) {
    serverLog.error(
      `[league-predictions] règlement échoué pairing=${input.pairingId}`,
      e,
    );
    return { settled: 0 };
  }
}

/**
 * Remet en attente les pronostics d'une rencontre dont le résultat est
 * annulé (`reverseOfflineLeagueResult` : invalidation, édition ex-post). La
 * clôture, elle, reste posée. Ne lève JAMAIS.
 */
export async function unsettleLeaguePredictions(
  pairingId: string,
): Promise<{ readonly unsettled: number }> {
  try {
    const out = await prisma.competitionPrediction.updateMany({
      where: { pairingId },
      data: {
        result: null,
        resultHomeScore: null,
        resultAwayScore: null,
        settledAt: null,
      },
    });
    return { unsettled: out.count };
  } catch (e: unknown) {
    serverLog.error(
      `[league-predictions] dérèglement échoué pairing=${pairingId}`,
      e,
    );
    return { unsettled: 0 };
  }
}

// ---------------------------------------------------------------------------
// Notification de journée
// ---------------------------------------------------------------------------

/** Rencontre d'une journée et ses pronostics, pour le bilan de la journée. */
export interface RoundPairingPredictions {
  readonly status: string;
  readonly predictions: ReadonlyArray<
    GradablePrediction & { readonly userId: string }
  >;
}

interface RoundNotificationRow {
  readonly id: string;
  readonly roundNumber: number;
  readonly name: string | null;
  readonly status: string;
  readonly predictionsNotifiedAt: Date | null;
  readonly season: {
    readonly id: string;
    readonly league: { readonly id: string; readonly name: string; readonly predictionsScope: string | null };
  };
  readonly pairings: readonly RoundPairingPredictions[];
}

export interface RoundPredictionSummary {
  readonly userId: string;
  readonly points: number;
  readonly settled: number;
  readonly correct: number;
}

/** Bilan d'une journée par pronostiqueur (pur) : seuls les réglés comptent. */
export function summarizeRoundPredictions(
  pairings: readonly RoundPairingPredictions[],
): RoundPredictionSummary[] {
  const byUser = new Map<string, RoundPredictionSummary>();
  for (const pairing of pairings) {
    for (const row of pairing.predictions) {
      const { grade, points } = gradePrediction(row, pairing.status);
      if (!isSettledGrade(grade)) continue;
      const current = byUser.get(row.userId) ?? {
        userId: row.userId,
        points: 0,
        settled: 0,
        correct: 0,
      };
      byUser.set(row.userId, {
        ...current,
        points: current.points + points,
        settled: current.settled + 1,
        correct:
          current.correct + (grade === "exact" || grade === "outcome" ? 1 : 0),
      });
    }
  }
  return Array.from(byUser.values());
}

function roundLabel(round: { roundNumber: number; name: string | null }): string {
  return round.name?.trim() || `Journée ${round.roundNumber}`;
}

/**
 * Une notification par pronostiqueur quand une journée se complète — au plus
 * UNE fois par journée : `predictionsNotifiedAt` est réclamé avant l'envoi
 * (`updateMany … where null`), si bien qu'une invalidation suivie d'une
 * nouvelle saisie ne renvoie rien. Best-effort : ne lève JAMAIS.
 */
export async function notifyRoundPredictionResults(
  roundId: string,
  now: Date = new Date(),
): Promise<number> {
  try {
    const round = (await prisma.leagueRound.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        roundNumber: true,
        name: true,
        status: true,
        predictionsNotifiedAt: true,
        season: {
          select: {
            id: true,
            league: { select: { id: true, name: true, predictionsScope: true } },
          },
        },
        pairings: {
          select: {
            status: true,
            predictions: {
              select: {
                userId: true,
                pick: true,
                homeScore: true,
                awayScore: true,
                result: true,
                resultHomeScore: true,
                resultAwayScore: true,
              },
            },
          },
        },
      },
    })) as RoundNotificationRow | null;
    if (!round || round.status !== "completed" || round.predictionsNotifiedAt) {
      return 0;
    }
    if (parsePredictionScope(round.season.league.predictionsScope) === "off") {
      return 0;
    }
    const summaries = summarizeRoundPredictions(round.pairings);
    if (summaries.length === 0) return 0;

    const claim = await prisma.leagueRound.updateMany({
      where: { id: round.id, predictionsNotifiedAt: null },
      data: { predictionsNotifiedAt: now },
    });
    if (claim.count === 0) return 0;

    const label = roundLabel(round);
    const league = round.season.league;
    const url = `/leagues/${league.id}/seasons/${round.season.id}/predictions`;
    let sent = 0;
    for (const s of summaries) {
      const created = await createInAppNotification({
        userId: s.userId,
        kind: "league.predictions_settled",
        title: `${label} : tes pronostics`,
        body: `${league.name} — ${s.points} pt${s.points > 1 ? "s" : ""}, ${s.correct} bon${s.correct > 1 ? "s" : ""} résultat${s.correct > 1 ? "s" : ""} sur ${s.settled}.`,
        url,
        meta: {
          leagueId: league.id,
          seasonId: round.season.id,
          roundId: round.id,
          points: s.points,
        },
      });
      if (created) sent += 1;
    }
    return sent;
  } catch (e: unknown) {
    serverLog.error(
      `[league-predictions] notification de journée échouée round=${roundId}`,
      e,
    );
    return 0;
  }
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

/**
 * Statistiques de pronostic d'un utilisateur, pour les succès. Les titres se
 * lisent sur les saisons clôturées avec LA MÊME fonction que le palmarès.
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
          round: { select: { seasonId: true, season: { select: { status: true } } } },
        },
      },
    },
  })) as ReadonlyArray<
    Omit<PredictionRow, "userId" | "user"> & {
      readonly pairing: {
        readonly status: string;
        readonly round: {
          readonly seasonId: string;
          readonly season: { readonly status: string };
        };
      };
    }
  >;
  let correct = 0;
  let exact = 0;
  const completedSeasons = new Set<string>();
  for (const row of rows) {
    const { grade } = gradePrediction(row, row.pairing.status);
    if (grade === "exact" || grade === "outcome") correct += 1;
    if (grade === "exact") exact += 1;
    if (isSettledGrade(grade) && row.pairing.round.season.status === "completed") {
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
