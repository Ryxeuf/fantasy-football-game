/**
 * Pronostics de COUPE — service exposé aux routes (lecture d'un lecteur,
 * classement, écritures d'un pronostic, portée, clôtures manuelles).
 *
 * Pendant de `league-predictions` sur les rencontres de coupe : toute
 * DÉCISION vit dans le module pur `league-predictions-rules` (portée,
 * saisie, note, clôture, éligibilité, classement, anonymisation), commun aux
 * deux compétitions. Ce module ne fait qu'assembler les lignes d'une coupe.
 *
 * Ce qui change par rapport à la ligue (cf. `openspec/specs/cup-predictions`) :
 *  - membres : commissaire + propriétaires d'une équipe inscrite (un
 *    inscrit n'a pas de statut de retrait : tous sont « actifs ») ;
 *  - un exempt n'est pas une rencontre : il n'est pas servi ; un
 *    placeholder de bracket (`home === away`) est servi non pronosticable ;
 *  - visibilité : celle de `GET /cup/:id` (tout compte connecté).
 *
 * Invariants conservés : rien des pronostics des autres avant la clôture
 * (pas même leur nombre) — c'est la réponse qui les omet ; classement
 * DÉRIVÉ, jamais persisté.
 */

import { prisma } from "../prisma";
import { isCupBracketVisible } from "./cup-playoffs";
import {
  PREDICTION_SELECT,
  isLeagueMember,
  isMember,
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
  type LeaderboardPrediction,
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

export type CupPredictionErrorCode =
  | "cup_not_found"
  | "pairing_not_found"
  | "round_not_found"
  | "prediction_not_found"
  | "forbidden"
  | "predictions_off"
  | "not_member"
  | "own_match"
  | "placeholder"
  | "closed"
  | "invalid_prediction";

export class CupPredictionError extends Error {
  constructor(
    public readonly code: CupPredictionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CupPredictionError";
  }
}

const INPUT_ERROR_MESSAGES: Readonly<Record<PredictionInputError, string>> = {
  invalid_pick: "Choix invalide : domicile, nul ou extérieur",
  partial_score: "Le score se donne pour les deux équipes, ou pas du tout",
  invalid_score: "Score invalide",
  score_pick_mismatch: "Le score ne correspond pas au vainqueur choisi",
};

function eligibilityError(
  reason: Exclude<PredictionEligibility, "ok">,
): CupPredictionError {
  switch (reason) {
    case "predictions-off":
      return new CupPredictionError(
        "predictions_off",
        "Les pronostics sont désactivés sur cette coupe",
      );
    case "anonymous":
    case "not-member":
      return new CupPredictionError(
        "not_member",
        "Les pronostics de cette coupe sont réservés à ses membres",
      );
    case "own-match":
      return new CupPredictionError(
        "own_match",
        "Impossible de pronostiquer une rencontre de sa propre équipe",
      );
    case "placeholder":
      return new CupPredictionError(
        "placeholder",
        "Cette rencontre n'est pas encore connue",
      );
    case "closed":
      return new CupPredictionError(
        "closed",
        "Les pronostics de cette rencontre sont fermés",
      );
  }
}

// ---------------------------------------------------------------------------
// Vues servies (mêmes formes que la ligue, pour un écran commun)
// ---------------------------------------------------------------------------

export interface CupPredictionViewer {
  readonly userId: string | null;
  readonly isAdmin?: boolean;
}

export interface CupPredictionTeamView {
  /** = `teamId` : une coupe n'a pas d'inscription distincte à exposer. */
  readonly participantId: string;
  readonly teamId: string;
  readonly name: string;
  readonly roster: string;
  readonly logoUrl: string | null;
  readonly coachName: string | null;
}

export interface CupPredictionView {
  readonly pick: PredictionPick;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly grade: PredictionGrade;
  readonly points: number;
}

export interface CupOtherPredictionView extends CupPredictionView {
  readonly userId: string;
  readonly displayName: string;
  readonly group: PredictionGroup;
  readonly isViewer: boolean;
}

export interface CupPairingPredictionsView {
  readonly id: string;
  readonly status: string;
  readonly scheduledAt: Date | null;
  readonly closesAt: Date | null;
  readonly closed: boolean;
  readonly placeholder: boolean;
  readonly home: CupPredictionTeamView;
  readonly away: CupPredictionTeamView;
  readonly result: {
    readonly outcome: PredictionResult;
    readonly homeScore: number | null;
    readonly awayScore: number | null;
  } | null;
  readonly eligibility: PredictionEligibility;
  readonly canClose: boolean;
  readonly myPrediction: CupPredictionView | null;
  /** `null` tant que la rencontre est ouverte. */
  readonly predictions: readonly CupOtherPredictionView[] | null;
  /** `null` tant que la rencontre est ouverte. */
  readonly distribution: PickDistribution | null;
}

export interface CupRoundPredictionsView {
  readonly id: string;
  readonly roundNumber: number;
  readonly name: string | null;
  readonly status: string;
  readonly kind: string;
  readonly canClose: boolean;
  readonly pairings: readonly CupPairingPredictionsView[];
}

export interface CupPredictionsView {
  readonly cupId: string;
  readonly cupName: string;
  readonly scope: PredictionScope;
  /** Faux sur une coupe antérieure (colonne à `null`) : flag brut. */
  readonly scopeConfigured: boolean;
  readonly viewer: {
    readonly userId: string | null;
    readonly isCommissioner: boolean;
    readonly isMember: boolean;
    readonly group: PredictionGroup | null;
  };
  readonly rounds: readonly CupRoundPredictionsView[];
}

export interface CupLeaderboardEntryView extends PredictionLeaderboardEntry {
  readonly isViewer: boolean;
}

export interface CupPredictionLeaderboardView {
  readonly cupId: string;
  readonly scope: PredictionScope;
  readonly coach: readonly CupLeaderboardEntryView[];
  readonly stands: readonly CupLeaderboardEntryView[];
}

// ---------------------------------------------------------------------------
// Lignes Prisma
// ---------------------------------------------------------------------------

interface CupTeamRow {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly logoUrl: string | null;
  readonly ownerId: string;
  readonly owner: { readonly coachName: string | null } | null;
}

interface CupPairingRow {
  readonly id: string;
  readonly status: string;
  readonly scheduledAt: Date | null;
  readonly predictionsClosedAt: Date | null;
  readonly homeTeamId: string;
  readonly awayTeamId: string | null;
  readonly homeTeam: CupTeamRow;
  readonly awayTeam: CupTeamRow | null;
  readonly matchSheet: {
    readonly status: string;
    readonly scoreHome: number | null;
    readonly scoreAway: number | null;
  } | null;
  readonly predictions: readonly PredictionRow[];
}

interface CupRoundRow {
  readonly id: string;
  readonly roundNumber: number;
  readonly name: string | null;
  readonly status: string;
  readonly kind: string;
  readonly bracketSlot: string | null;
  readonly pairings: readonly CupPairingRow[];
}

interface CupRow {
  readonly id: string;
  readonly name: string;
  readonly creatorId: string;
  readonly status: string;
  readonly predictionsScope: string | null;
  readonly playoffsPublished: boolean | null;
  readonly participants: ReadonlyArray<{ readonly team: { readonly ownerId: string } }>;
}

const CUP_SELECT = {
  id: true,
  name: true,
  creatorId: true,
  status: true,
  predictionsScope: true,
  playoffsPublished: true,
  participants: { select: { team: { select: { ownerId: true } } } },
} as const;

const TEAM_SELECT = {
  select: {
    id: true,
    name: true,
    roster: true,
    logoUrl: true,
    ownerId: true,
    owner: { select: { coachName: true } },
  },
} as const;

/** Commissaire + propriétaires des équipes inscrites (tous actifs). */
export function cupMembership(cup: Pick<CupRow, "creatorId" | "participants">): Membership {
  const owners = new Set(cup.participants.map((p) => p.team.ownerId));
  return { creatorId: cup.creatorId, activeCoachIds: owners, anyCoachIds: owners };
}

function isPlayoffRound(round: { kind: string; bracketSlot: string | null }): boolean {
  return round.kind === "playoff" || round.bracketSlot !== null;
}

async function loadCup(cupId: string): Promise<CupRow> {
  const cup = (await prisma.cup.findUnique({
    where: { id: cupId },
    select: CUP_SELECT,
  })) as CupRow | null;
  if (!cup) throw new CupPredictionError("cup_not_found", "Coupe introuvable");
  return cup;
}

// ---------------------------------------------------------------------------
// Lecture d'une coupe
// ---------------------------------------------------------------------------

function teamView(team: CupTeamRow): CupPredictionTeamView {
  return {
    participantId: team.id,
    teamId: team.id,
    name: team.name,
    roster: team.roster,
    logoUrl: team.logoUrl ?? null,
    coachName: team.owner?.coachName ?? null,
  };
}

function resultView(pairing: CupPairingRow): CupPairingPredictionsView["result"] {
  if (pairing.status === "cancelled") {
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
  if (sheet && sheet.status === "validated" && sheet.scoreHome !== null && sheet.scoreAway !== null) {
    return {
      outcome: outcomeOf(sheet.scoreHome, sheet.scoreAway),
      homeScore: sheet.scoreHome,
      awayScore: sheet.scoreAway,
    };
  }
  return null;
}

function predictionView(row: PredictionRow, pairingStatus: string): CupPredictionView {
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
  pairing: CupPairingRow,
  membership: Membership,
  viewerId: string | null,
): CupOtherPredictionView[] {
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
    .sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName, "fr"));
}

export async function getCupPredictions(input: {
  readonly cupId: string;
  readonly viewer: CupPredictionViewer;
  readonly now?: Date;
}): Promise<CupPredictionsView> {
  const now = input.now ?? new Date();
  const cup = await loadCup(input.cupId);
  const viewerId = input.viewer.userId;
  const membership = cupMembership(cup);
  const scope = parsePredictionScope(cup.predictionsScope);
  const isCommissioner = viewerId !== null && viewerId === cup.creatorId;
  const isAdmin = input.viewer.isAdmin === true;
  const member = isMember(membership, viewerId);
  const base = {
    cupId: cup.id,
    cupName: cup.name,
    scope,
    scopeConfigured: cup.predictionsScope !== null,
    viewer: {
      userId: viewerId,
      isCommissioner,
      isMember: member,
      group: viewerId ? predictionGroupOf(membership.activeCoachIds.has(viewerId)) : null,
    },
  };
  // Pronostics coupés : rien à servir.
  if (scope === "off") return { ...base, rounds: [] };

  const rounds = (await prisma.cupRound.findMany({
    where: { cupId: cup.id },
    orderBy: { roundNumber: "asc" },
    select: {
      id: true,
      roundNumber: true,
      name: true,
      status: true,
      kind: true,
      bracketSlot: true,
      pairings: {
        orderBy: { tableNumber: "asc" },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          predictionsClosedAt: true,
          homeTeamId: true,
          awayTeamId: true,
          homeTeam: TEAM_SELECT,
          awayTeam: TEAM_SELECT,
          matchSheet: { select: { status: true, scoreHome: true, scoreAway: true } },
          predictions: { select: PREDICTION_SELECT },
        },
      },
    },
  })) as unknown as CupRoundRow[];

  const bracketVisible = isCupBracketVisible(cup.playoffsPublished);
  const out: CupRoundPredictionsView[] = [];
  for (const round of rounds) {
    const hiddenPlayoff = isPlayoffRound(round) && !bracketVisible;
    // Un bracket non publié ne fuite par AUCUNE lecture (cf. calendrier).
    if (hiddenPlayoff && !isCommissioner && !isAdmin) continue;
    const pairings = round.pairings
      // Un exempt n'est pas une rencontre : rien à pronostiquer.
      .filter((p): p is CupPairingRow & { awayTeam: CupTeamRow; awayTeamId: string } =>
        p.awayTeam !== null && p.awayTeamId !== null,
      )
      .map((pairing): CupPairingPredictionsView => {
        const closed = isPredictionClosed(
          {
            status: pairing.status,
            predictionsClosedAt: pairing.predictionsClosedAt,
            scheduledAt: pairing.scheduledAt,
            hiddenPlayoff,
            leagueArchived: cup.status === "archivee",
          },
          now,
        );
        const placeholder = isPlaceholderPairing(pairing.homeTeamId, pairing.awayTeamId);
        const ownsPairingTeam =
          viewerId !== null &&
          (viewerId === pairing.homeTeam.ownerId || viewerId === pairing.awayTeam.ownerId);
        const mine = viewerId ? pairing.predictions.find((p) => p.userId === viewerId) : undefined;
        return {
          id: pairing.id,
          status: pairing.status,
          scheduledAt: pairing.scheduledAt,
          closesAt: predictionClosesAt(pairing),
          closed,
          placeholder,
          home: teamView(pairing.homeTeam),
          away: teamView(pairing.awayTeam),
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
          distribution: closed ? pickDistribution(pairing.predictions.map((p) => p.pick)) : null,
        };
      });
    if (pairings.length === 0) continue;
    out.push({
      id: round.id,
      roundNumber: round.roundNumber,
      name: round.name,
      status: round.status,
      kind: round.kind,
      canClose: (isAdmin || isCommissioner) && pairings.some((p) => !p.closed),
      pairings,
    });
  }
  return { ...base, rounds: out };
}

// ---------------------------------------------------------------------------
// Classement
// ---------------------------------------------------------------------------

export async function getCupPredictionLeaderboard(input: {
  readonly cupId: string;
  readonly viewer: CupPredictionViewer;
}): Promise<CupPredictionLeaderboardView> {
  const cup = await loadCup(input.cupId);
  const scope = parsePredictionScope(cup.predictionsScope);
  if (scope === "off") return { cupId: cup.id, scope, coach: [], stands: [] };
  const membership = cupMembership(cup);
  const viewerId = input.viewer.userId;
  const rows = (await prisma.competitionPrediction.findMany({
    where: { cupPairing: { round: { cupId: cup.id } } },
    select: { ...PREDICTION_SELECT, cupPairing: { select: { status: true } } },
  })) as unknown as Array<PredictionRow & { cupPairing: { status: string } }>;
  const graded: LeaderboardPrediction[] = rows.map((row) => {
    const { grade, points } = gradePrediction(row, row.cupPairing.status);
    return {
      userId: row.userId,
      displayName: predictorDisplayName({
        coachName: row.user.coachName,
        privateProfile: row.user.privateProfile,
        isLeagueMember: isLeagueMember(membership, row.userId),
        isViewer: row.userId === viewerId,
      }),
      group: predictionGroupOf(membership.activeCoachIds.has(row.userId)),
      grade,
      points,
    };
  });
  const board = computePredictionLeaderboard(graded);
  const mark = (e: PredictionLeaderboardEntry): CupLeaderboardEntryView => ({
    ...e,
    isViewer: e.userId === viewerId,
  });
  return {
    cupId: cup.id,
    scope,
    coach: board.coach.map(mark),
    stands: board.stands.map(mark),
  };
}

// ---------------------------------------------------------------------------
// Écritures
// ---------------------------------------------------------------------------

interface CupPairingContext {
  readonly id: string;
  readonly status: string;
  readonly scheduledAt: Date | null;
  readonly predictionsClosedAt: Date | null;
  readonly homeTeamId: string;
  readonly awayTeamId: string | null;
  readonly homeTeam: { readonly ownerId: string };
  readonly awayTeam: { readonly ownerId: string } | null;
  readonly round: {
    readonly id: string;
    readonly kind: string;
    readonly bracketSlot: string | null;
    readonly cup: CupRow;
  };
}

async function loadPairingContext(cupPairingId: string): Promise<CupPairingContext> {
  const pairing = (await prisma.cupPairing.findUnique({
    where: { id: cupPairingId },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      predictionsClosedAt: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { ownerId: true } },
      awayTeam: { select: { ownerId: true } },
      round: {
        select: {
          id: true,
          kind: true,
          bracketSlot: true,
          cup: { select: CUP_SELECT },
        },
      },
    },
  })) as CupPairingContext | null;
  // Un exempt n'est pas une rencontre pronosticable : introuvable.
  if (!pairing || !pairing.awayTeam || !pairing.awayTeamId) {
    throw new CupPredictionError("pairing_not_found", "Rencontre introuvable");
  }
  return pairing;
}

function isPairingClosed(pairing: CupPairingContext, now: Date): boolean {
  const cup = pairing.round.cup;
  return isPredictionClosed(
    {
      status: pairing.status,
      predictionsClosedAt: pairing.predictionsClosedAt,
      scheduledAt: pairing.scheduledAt,
      hiddenPlayoff: isPlayoffRound(pairing.round) && !isCupBracketVisible(cup.playoffsPublished),
      leagueArchived: cup.status === "archivee",
    },
    now,
  );
}

function assertCanPredict(pairing: CupPairingContext, userId: string, now: Date): void {
  const cup = pairing.round.cup;
  const eligibility = predictionEligibility({
    scope: parsePredictionScope(cup.predictionsScope),
    viewerId: userId,
    isMember: isMember(cupMembership(cup), userId),
    ownsPairingTeam:
      userId === pairing.homeTeam.ownerId || userId === pairing.awayTeam?.ownerId,
    placeholder: isPlaceholderPairing(pairing.homeTeamId, pairing.awayTeamId ?? ""),
    closed: isPairingClosed(pairing, now),
  });
  if (eligibility !== "ok") throw eligibilityError(eligibility);
}

export async function upsertCupPrediction(input: {
  readonly cupPairingId: string;
  readonly userId: string;
  readonly pick: unknown;
  readonly homeScore?: number | null;
  readonly awayScore?: number | null;
  readonly now?: Date;
}): Promise<{ pick: PredictionPick; homeScore: number | null; awayScore: number | null }> {
  const now = input.now ?? new Date();
  const pairing = await loadPairingContext(input.cupPairingId);
  assertCanPredict(pairing, input.userId, now);
  const check = validatePredictionInput(input);
  if (!check.ok) {
    throw new CupPredictionError("invalid_prediction", INPUT_ERROR_MESSAGES[check.error]);
  }
  const data = {
    pick: check.value.pick,
    homeScore: check.value.homeScore,
    awayScore: check.value.awayScore,
  };
  await prisma.competitionPrediction.upsert({
    where: { cupPairingId_userId: { cupPairingId: pairing.id, userId: input.userId } },
    create: { cupPairingId: pairing.id, userId: input.userId, ...data },
    update: data,
  });
  return data;
}

export async function deleteCupPrediction(input: {
  readonly cupPairingId: string;
  readonly userId: string;
  readonly now?: Date;
}): Promise<{ readonly deleted: true }> {
  const now = input.now ?? new Date();
  const pairing = await loadPairingContext(input.cupPairingId);
  if (isPairingClosed(pairing, now)) throw eligibilityError("closed");
  const result = await prisma.competitionPrediction.deleteMany({
    where: { cupPairingId: pairing.id, userId: input.userId },
  });
  if (result.count === 0) {
    throw new CupPredictionError(
      "prediction_not_found",
      "Aucun pronostic à retirer sur cette rencontre",
    );
  }
  return { deleted: true };
}

/**
 * Portée des pronostics d'une coupe. Règle de LECTURE : aucun compteur
 * persisté n'en dépend — commissaire ou admin, à tout moment.
 */
export async function setCupPredictionsScope(input: {
  readonly cupId: string;
  readonly viewer: { readonly userId: string; readonly isAdmin?: boolean };
  readonly scope: PredictionScope;
}): Promise<{ readonly predictionsScope: PredictionScope }> {
  const cup = await loadCup(input.cupId);
  if (!input.viewer.isAdmin && cup.creatorId !== input.viewer.userId) {
    throw new CupPredictionError(
      "forbidden",
      "Seul le commissaire règle les pronostics de la coupe",
    );
  }
  await prisma.cup.update({
    where: { id: cup.id },
    data: { predictionsScope: input.scope },
  });
  return { predictionsScope: input.scope };
}

/**
 * « Coup d'envoi » d'une rencontre : un de ses coachs, le commissaire ou un
 * admin. N'écrit que sur une rencontre OUVERTE (cf. la ligue : une clôture
 * write-once posée pour une raison passagère lui survivrait).
 */
export async function closeCupPairingPredictions(input: {
  readonly cupPairingId: string;
  readonly viewer: { readonly userId: string; readonly isAdmin?: boolean };
  readonly now?: Date;
}): Promise<{ readonly closedAt: Date | null }> {
  const now = input.now ?? new Date();
  const pairing = await loadPairingContext(input.cupPairingId);
  const userId = input.viewer.userId;
  const allowed =
    input.viewer.isAdmin === true ||
    userId === pairing.round.cup.creatorId ||
    userId === pairing.homeTeam.ownerId ||
    userId === pairing.awayTeam?.ownerId;
  if (!allowed) {
    throw new CupPredictionError(
      "forbidden",
      "Seuls les coachs de la rencontre et le commissaire la ferment",
    );
  }
  if (pairing.predictionsClosedAt) return { closedAt: pairing.predictionsClosedAt };
  if (isPairingClosed(pairing, now)) return { closedAt: null };
  await prisma.cupPairing.updateMany({
    where: { id: pairing.id, predictionsClosedAt: null },
    data: { predictionsClosedAt: now },
  });
  return { closedAt: now };
}

/** Ferme toute une ronde : commissaire ou admin, rencontres ouvertes seulement. */
export async function closeCupRoundPredictions(input: {
  readonly roundId: string;
  readonly viewer: { readonly userId: string; readonly isAdmin?: boolean };
  readonly now?: Date;
}): Promise<{ readonly closed: number }> {
  const now = input.now ?? new Date();
  const round = (await prisma.cupRound.findUnique({
    where: { id: input.roundId },
    select: {
      id: true,
      kind: true,
      bracketSlot: true,
      cup: { select: CUP_SELECT },
      pairings: {
        select: { id: true, status: true, scheduledAt: true, predictionsClosedAt: true },
      },
    },
  })) as {
    id: string;
    kind: string;
    bracketSlot: string | null;
    cup: CupRow;
    pairings: Array<{
      id: string;
      status: string;
      scheduledAt: Date | null;
      predictionsClosedAt: Date | null;
    }>;
  } | null;
  if (!round) throw new CupPredictionError("round_not_found", "Ronde introuvable");
  if (!input.viewer.isAdmin && round.cup.creatorId !== input.viewer.userId) {
    throw new CupPredictionError("forbidden", "Seul le commissaire ferme une ronde entière");
  }
  const hiddenPlayoff = isPlayoffRound(round) && !isCupBracketVisible(round.cup.playoffsPublished);
  const leagueArchived = round.cup.status === "archivee";
  const openIds = round.pairings
    .filter((p) => !isPredictionClosed({ ...p, hiddenPlayoff, leagueArchived }, now))
    .map((p) => p.id);
  if (openIds.length === 0) return { closed: 0 };
  const out = await prisma.cupPairing.updateMany({
    where: { id: { in: openIds }, predictionsClosedAt: null },
    data: { predictionsClosedAt: now },
  });
  return { closed: out.count };
}
