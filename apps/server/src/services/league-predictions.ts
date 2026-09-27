/**
 * Pronostics de ligue — service exposé aux routes (lectures d'un lecteur,
 * écritures d'un pronostic, portée, clôtures manuelles).
 *
 * Toute DÉCISION vit dans le module pur `league-predictions-rules`. Les
 * fonctions appelées par la chaîne des résultats (règlement, clôture posée
 * par la feuille, notification de journée) vivent dans
 * `league-predictions-settlement`, et le classement sans lecteur dans
 * `league-predictions-core` : ce module-ci importe `league-access` (donc tout
 * `services/league`) et ne doit être importé que par des routes.
 *
 * Trois invariants à ne pas perdre (cf. `openspec/changes/league-match-predictions`) :
 *  - la visibilité de la ligue passe AVANT toute autre règle : une ligue
 *    privée invisible est introuvable, en lecture comme en écriture ;
 *  - rien des pronostics des autres ne sort avant la clôture d'une rencontre
 *    — pas même leur nombre : c'est la réponse qui les omet, pas l'écran ;
 *  - le classement est DÉRIVÉ, jamais persisté.
 */

import { prisma } from "../prisma";
import { canViewLeagueRow, type LeagueViewer } from "./league-access";
import { isPlayoffBracketVisible } from "./league-playoffs";
import {
  LEAGUE_SELECT,
  PREDICTION_SELECT,
  isLeagueMember,
  isMember,
  leaderboardRows,
  loadLeaderboardSource,
  membershipOf,
  type LeagueRow,
  type Membership,
  type PredictionRow,
} from "./league-predictions-core";
import {
  computePredictionLeaderboard,
  gradePrediction,
  isPlaceholderPairing,
  isPredictionClosed,
  outcomeOf,
  parsePredictionScope,
  pickDistribution,
  predictionClosesAt,
  predictionEligibility,
  predictionGroupOf,
  predictorDisplayName,
  validatePredictionInput,
  type PickDistribution,
  type PredictionEligibility,
  type PredictionGrade,
  type PredictionGroup,
  type PredictionInputError,
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
  partial_score: "Le score se donne pour les deux équipes, ou pas du tout",
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
// Chargement d'une saison
// ---------------------------------------------------------------------------

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
        canClose: !closed && (isAdmin || isCommissioner || ownsPairingTeam),
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
      canClose: (isAdmin || isCommissioner) && pairings.some((p) => !p.closed),
      pairings,
    });
  }
  return { ...base, rounds };
}

// ---------------------------------------------------------------------------
// Classement d'un lecteur
// ---------------------------------------------------------------------------

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

export interface SavedPrediction {
  readonly pick: PredictionPick;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
}

export async function upsertPrediction(input: {
  readonly pairingId: string;
  readonly viewer: LeagueViewer & { readonly userId: string };
  readonly pick: unknown;
  readonly homeScore?: number | null;
  readonly awayScore?: number | null;
  readonly now?: Date;
}): Promise<SavedPrediction> {
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
 * « Coup d'envoi » : un coach de la rencontre, le commissaire ou un admin.
 *
 * N'écrit que sur une rencontre OUVERTE. Fermée pour une autre raison — jouée,
 * date passée, play-off non publié, ligue archivée —, elle n'a rien à fermer,
 * et une clôture posée alors SURVIVRAIT à sa raison (write-once) : le bracket
 * une fois publié, la ligue désarchivée ou la date reportée, la rencontre
 * resterait fermée. `closedAt: null` = rien d'écrit.
 */
export async function closePairingPredictions(input: {
  readonly pairingId: string;
  readonly viewer: LeagueViewer & { readonly userId: string };
  readonly now?: Date;
}): Promise<{ readonly closedAt: Date | null }> {
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
  if (isPairingClosed(pairing, now)) return { closedAt: null };
  await prisma.leaguePairing.updateMany({
    where: { id: pairing.id, predictionsClosedAt: null },
    data: { predictionsClosedAt: now },
  });
  return { closedAt: now };
}

interface RoundCloseRow {
  readonly id: string;
  readonly kind: string;
  readonly bracketSlot: string | null;
  readonly season: {
    readonly playoffsPublished: boolean | null;
    readonly league: LeagueRow;
  };
  readonly pairings: ReadonlyArray<{
    readonly id: string;
    readonly status: string;
    readonly scheduledAt: Date | null;
    readonly predictionsClosedAt: Date | null;
  }>;
}

/**
 * Ferme toute une journée : le commissaire ou un admin. Seules ses rencontres
 * encore OUVERTES reçoivent la clôture (cf. `closePairingPredictions`).
 */
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
      kind: true,
      bracketSlot: true,
      season: {
        select: {
          playoffsPublished: true,
          league: { select: LEAGUE_SELECT },
        },
      },
      pairings: {
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          predictionsClosedAt: true,
        },
      },
    },
  })) as RoundCloseRow | null;
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
  const hiddenPlayoff =
    isPlayoffRound(round) &&
    !isPlayoffBracketVisible(round.season.playoffsPublished);
  const leagueArchived = round.season.league.status === "archived";
  const openIds = round.pairings
    .filter(
      (p) =>
        !isPredictionClosed({ ...p, hiddenPlayoff, leagueArchived }, now),
    )
    .map((p) => p.id);
  if (openIds.length === 0) return { closed: 0 };
  const out = await prisma.leaguePairing.updateMany({
    where: { id: { in: openIds }, predictionsClosedAt: null },
    data: { predictionsClosedAt: now },
  });
  return { closed: out.count };
}
