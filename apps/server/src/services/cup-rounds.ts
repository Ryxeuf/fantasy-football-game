/**
 * Rondes d'une coupe — appariement en ronde suisse.
 *
 * Une coupe n'avait pas de calendrier : les coachs créaient des matchs
 * locaux à la main. Le commissaire (créateur de la coupe, ou un admin)
 * génère désormais des RONDES : à chaque ronde, le moteur pur
 * `swiss-pairing` apparie les équipes inscrites selon le classement
 * courant (`computeCupStandings`), sans rematch, avec un exempt si le
 * nombre d'inscrits est impair.
 *
 * Cycle d'une rencontre (`CupPairing.status`) :
 *   scheduled   -> aucun match créé
 *   in_progress -> un match local la matérialise (`LocalMatch.cupPairingId`)
 *   played      -> le match local est terminé (classement à jour)
 *   bye         -> équipe exemptée (les points d'une victoire)
 *   cancelled   -> annulée par le commissaire
 *
 * Une ronde est `completed` quand toutes ses rencontres sont terminales ;
 * la ronde suivante ne se génère qu'à ce moment-là.
 *
 * Le classement reste dérivé des matchs locaux terminés (aucune
 * persistance de points) : les exempts y sont injectés via `byesByTeamId`.
 */

import { prisma } from "../prisma";
import {
  computeCupStandings,
  type CupWithParticipantsAndScoring,
  type LocalMatchWithRelations,
} from "../cupScoring";
import { generateSwissRound, type SwissRoundResult } from "./swiss-pairing";
import { generateRandomRound } from "./random-pairing";
import type { CupRoundSystem } from "./cup-round-systems";
import { createInAppNotification } from "./in-app-notifications";
import { serverLog } from "../utils/server-log";

export type CupRoundErrorCode =
  | "cup_not_found"
  | "forbidden"
  | "cup_not_started"
  | "cup_closed"
  | "not_enough_participants"
  | "round_in_progress"
  | "round_not_found"
  | "round_has_matches"
  | "pairing_not_found"
  | "pairing_closed"
  | "pairing_bye"
  | "pairing_has_match"
  | "team_mismatch"
  | "unknown_system"
  | "invalid_pairings";

export class CupRoundError extends Error {
  constructor(
    public readonly code: CupRoundErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CupRoundError";
  }
}

export {
  CUP_ROUND_SYSTEMS,
  isCupRoundSystem,
  type CupRoundSystem,
} from "./cup-round-systems";

/** Rencontre saisie à la main. `awayTeamId` null = équipe exemptée. */
export interface ManualCupPairingInput {
  readonly homeTeamId: string;
  readonly awayTeamId?: string | null;
}

export interface CupActor {
  readonly userId: string;
  readonly isAdmin: boolean;
}

/** Statuts d'une rencontre encore ouverte (pas de résultat). */
const OPEN_PAIRING_STATUSES: ReadonlySet<string> = new Set([
  "scheduled",
  "in_progress",
]);

/** Statuts qui comptent comme "rencontre jouée" pour l'historique suisse. */
const HISTORY_STATUSES: ReadonlySet<string> = new Set([
  "scheduled",
  "in_progress",
  "played",
]);

export interface CupPairingTeamView {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly logoUrl: string | null;
  readonly ownerId: string;
  readonly coachName: string | null;
}

export interface CupPairingView {
  readonly id: string;
  readonly tableNumber: number;
  readonly status: string;
  readonly scheduledAt: string | null;
  readonly homeTeam: CupPairingTeamView;
  /** null = exempt. */
  readonly awayTeam: CupPairingTeamView | null;
  readonly localMatch: {
    readonly id: string;
    readonly status: string;
    readonly teamAId: string;
    readonly scoreTeamA: number | null;
    readonly scoreTeamB: number | null;
  } | null;
}

export interface CupRoundView {
  readonly id: string;
  readonly roundNumber: number;
  readonly name: string | null;
  readonly system: string;
  readonly status: string;
  readonly scheduledAt: string | null;
  readonly createdAt: string;
  readonly pairings: readonly CupPairingView[];
}

const TEAM_SELECT = {
  id: true,
  name: true,
  roster: true,
  logoUrl: true,
  ownerId: true,
  owner: { select: { coachName: true } },
} as const;

const PAIRING_INCLUDE = {
  homeTeam: { select: TEAM_SELECT },
  awayTeam: { select: TEAM_SELECT },
  localMatch: {
    select: {
      id: true,
      status: true,
      teamAId: true,
      scoreTeamA: true,
      scoreTeamB: true,
    },
  },
} as const;

interface TeamRow {
  id: string;
  name: string;
  roster: string;
  logoUrl: string | null;
  ownerId: string;
  owner: { coachName: string | null } | null;
}

interface PairingRow {
  id: string;
  tableNumber: number;
  status: string;
  scheduledAt: Date | null;
  homeTeam: TeamRow;
  awayTeam: TeamRow | null;
  localMatch: {
    id: string;
    status: string;
    teamAId: string;
    scoreTeamA: number | null;
    scoreTeamB: number | null;
  } | null;
}

interface RoundRow {
  id: string;
  roundNumber: number;
  name: string | null;
  system: string;
  status: string;
  scheduledAt: Date | null;
  createdAt: Date;
  pairings: PairingRow[];
}

function toTeamView(team: TeamRow): CupPairingTeamView {
  return {
    id: team.id,
    name: team.name,
    roster: team.roster,
    logoUrl: team.logoUrl ?? null,
    ownerId: team.ownerId,
    coachName: team.owner?.coachName ?? null,
  };
}

function toRoundView(round: RoundRow): CupRoundView {
  return {
    id: round.id,
    roundNumber: round.roundNumber,
    name: round.name,
    system: round.system,
    status: round.status,
    scheduledAt: round.scheduledAt ? round.scheduledAt.toISOString() : null,
    createdAt: round.createdAt.toISOString(),
    pairings: round.pairings
      .slice()
      .sort((a, b) => a.tableNumber - b.tableNumber)
      .map((p) => ({
        id: p.id,
        tableNumber: p.tableNumber,
        status: p.status,
        scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
        homeTeam: toTeamView(p.homeTeam),
        awayTeam: p.awayTeam ? toTeamView(p.awayTeam) : null,
        localMatch: p.localMatch
          ? {
              id: p.localMatch.id,
              status: p.localMatch.status,
              teamAId: p.localMatch.teamAId,
              scoreTeamA: p.localMatch.scoreTeamA ?? null,
              scoreTeamB: p.localMatch.scoreTeamB ?? null,
            }
          : null,
      })),
  };
}

/** Rondes d'une coupe, de la première à la dernière, tables ordonnées. */
export async function listCupRounds(cupId: string): Promise<CupRoundView[]> {
  const rounds = (await prisma.cupRound.findMany({
    where: { cupId },
    orderBy: { roundNumber: "asc" },
    include: { pairings: { include: PAIRING_INCLUDE } },
  })) as RoundRow[];
  return rounds.map(toRoundView);
}

/**
 * Exempts par équipe (PUR) : injectés dans `computeCupStandings` pour que
 * l'exempt vaille les points d'une victoire.
 */
export function cupByesByTeamId(
  rounds: ReadonlyArray<{
    readonly pairings: ReadonlyArray<{
      readonly status: string;
      readonly homeTeam: { readonly id: string };
      readonly awayTeam: { readonly id: string } | null;
    }>;
  }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const round of rounds) {
    for (const p of round.pairings) {
      if (p.status === "bye" && p.awayTeam === null) {
        out[p.homeTeam.id] = (out[p.homeTeam.id] ?? 0) + 1;
      }
    }
  }
  return out;
}

async function loadCupForActor(cupId: string) {
  const cup = (await prisma.cup.findUnique({
    where: { id: cupId },
    select: { id: true, name: true, creatorId: true, status: true, validated: true },
  })) as {
    id: string;
    name: string;
    creatorId: string;
    status: string;
    validated: boolean;
  } | null;
  if (!cup) throw new CupRoundError("cup_not_found", "Coupe introuvable");
  return cup;
}

function ensureCommissioner(
  cup: { creatorId: string },
  actor: CupActor,
): void {
  if (cup.creatorId !== actor.userId && !actor.isAdmin) {
    throw new CupRoundError(
      "forbidden",
      "Seul le créateur de la coupe (ou un administrateur) gère les rondes",
    );
  }
}

/**
 * Génère la ronde suivante d'une coupe. Trois systèmes (cf.
 * `CUP_ROUND_SYSTEMS`) : tirage au sort, ronde suisse, ou saisie manuelle.
 * Les trois partagent les MÊMES garde-fous — coupe en cours, deux inscrits
 * au minimum, ronde précédente terminée — et produisent la même chose :
 * `CupRound` + `CupPairing` en une transaction, puis notification des
 * coachs appariés. Seul l'appariement change.
 *
 * `pairings` n'est lu qu'en mode `manual` ; il est alors OBLIGATOIRE.
 */
export async function generateCupRound(input: {
  cupId: string;
  actor: CupActor;
  system?: CupRoundSystem;
  pairings?: readonly ManualCupPairingInput[];
}): Promise<CupRoundView> {
  const system: CupRoundSystem = input.system ?? "swiss";
  const cupHeader = await loadCupForActor(input.cupId);
  ensureCommissioner(cupHeader, input.actor);
  if (cupHeader.status === "terminee" || cupHeader.status === "archivee") {
    throw new CupRoundError("cup_closed", "Coupe terminée : plus de ronde à générer");
  }
  if (cupHeader.status !== "en_cours" && !cupHeader.validated) {
    throw new CupRoundError(
      "cup_not_started",
      "Validez la coupe (fin des inscriptions) avant de générer une ronde",
    );
  }

  const cup = (await prisma.cup.findUnique({
    where: { id: input.cupId },
    include: {
      participants: {
        include: {
          team: { select: { id: true, name: true, roster: true, logoUrl: true } },
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
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: { pairings: { include: PAIRING_INCLUDE } },
      },
    },
  })) as
    | (CupWithParticipantsAndScoring & {
        localMatches: LocalMatchWithRelations[];
        rounds: RoundRow[];
      })
    | null;
  if (!cup) throw new CupRoundError("cup_not_found", "Coupe introuvable");

  const teamIds = cup.participants.map((p) => p.team.id);
  if (teamIds.length < 2) {
    throw new CupRoundError(
      "not_enough_participants",
      "Au moins deux équipes inscrites sont nécessaires",
    );
  }
  const lastRound = cup.rounds[cup.rounds.length - 1] ?? null;
  if (
    lastRound &&
    lastRound.pairings.some((p) => OPEN_PAIRING_STATUSES.has(p.status))
  ) {
    throw new CupRoundError(
      "round_in_progress",
      `La ronde ${lastRound.roundNumber} n'est pas terminée : toutes ses rencontres doivent être jouées (ou annulées)`,
    );
  }

  // Classement courant (exempts compris) -> ordre d'appariement.
  const standings = computeCupStandings(cup, cup.localMatches, {
    byesByTeamId: cupByesByTeamId(cup.rounds),
  });
  const participantSet = new Set(teamIds);
  const ranked = standings.teamStats
    .map((s) => s.teamId)
    .filter((id) => participantSet.has(id));
  // Une équipe inscrite sans ligne de classement (impossible en pratique :
  // `computeCupStandings` initialise tous les participants) irait en queue.
  for (const id of teamIds) if (!ranked.includes(id)) ranked.push(id);

  const playedPairs: Array<[string, string]> = [];
  const byes: string[] = [];
  const homeCounts: Record<string, number> = {};
  for (const round of cup.rounds) {
    for (const p of round.pairings) {
      if (p.status === "bye" || !p.awayTeam) {
        if (p.status === "bye") byes.push(p.homeTeam.id);
        continue;
      }
      if (!HISTORY_STATUSES.has(p.status)) continue;
      playedPairs.push([p.homeTeam.id, p.awayTeam.id]);
      homeCounts[p.homeTeam.id] = (homeCounts[p.homeTeam.id] ?? 0) + 1;
    }
  }

  const roundNumber = (lastRound?.roundNumber ?? 0) + 1;
  const history = { playedPairs, byes, homeCounts };
  const result: SwissRoundResult =
    system === "manual"
      ? buildManualRound(input.pairings, teamIds)
      : system === "random"
        ? // Graine = coupe + numéro de ronde : le tirage est REJOUABLE (deux
          // appels rendent la même ronde) et deux rondes de la même coupe ne
          // partagent pas leur ordre.
          generateRandomRound(ranked, history, `${cup.id}:${roundNumber}`)
        : generateSwissRound(
            ranked.map((teamId) => ({ teamId })),
            history,
          );

  const created = (await prisma.$transaction(async (tx: typeof prisma) => {
    const round = (await tx.cupRound.create({
      data: {
        cupId: cup.id,
        roundNumber,
        name: `Ronde ${roundNumber}`,
        system,
        status: "pending",
      },
      select: { id: true },
    })) as { id: string };
    await tx.cupPairing.createMany({
      data: [
        ...result.pairings.map((p) => ({
          roundId: round.id,
          tableNumber: p.table,
          homeTeamId: p.home,
          awayTeamId: p.away,
          status: "scheduled",
        })),
        ...(result.bye
          ? [
              {
                roundId: round.id,
                tableNumber: result.pairings.length + 1,
                homeTeamId: result.bye,
                awayTeamId: null,
                status: "bye",
              },
            ]
          : []),
      ],
    });
    return round;
  })) as { id: string };

  if (result.rematchForced) {
    serverLog.warn(
      `[cup-rounds] cup=${cup.id} round=${roundNumber}: rematch inévitable (toutes les combinaisons déjà jouées)`,
    );
  }

  const view = await loadRoundView(created.id);
  await notifyRoundPairings(cup.id, cupHeader.name, view);
  return view;
}

/**
 * Rétro-compatibilité : `POST /cup/:id/rounds/swiss` existait avant les
 * autres systèmes et reste servi tel quel.
 */
export async function generateSwissCupRound(input: {
  cupId: string;
  actor: CupActor;
}): Promise<CupRoundView> {
  return generateCupRound({ ...input, system: "swiss" });
}

/**
 * Valide et met en forme des rencontres saisies à la main.
 *
 * Le commissaire pose ce qu'il veut, mais une ronde reste une ronde : une
 * équipe ne peut pas jouer deux fois, ni contre elle-même, ni contre une
 * équipe non inscrite, et il ne peut y avoir qu'un seul exempt (par
 * définition, l'exempt est celui qui reste). Une saisie qui violerait ça
 * produirait un classement faux, pas une ronde exotique — d'où le refus.
 *
 * Une équipe inscrite mais ABSENTE de la saisie est acceptée : elle ne joue
 * simplement pas cette ronde (report, forfait à venir). C'est le propre de
 * la saisie manuelle, et c'est ce qui la distingue d'un appariement généré.
 */
export function buildManualRound(
  pairings: readonly ManualCupPairingInput[] | undefined,
  participantIds: readonly string[],
): SwissRoundResult {
  if (!pairings || pairings.length === 0) {
    throw new CupRoundError(
      "invalid_pairings",
      "Saisie manuelle : aucune rencontre fournie",
    );
  }
  const allowed = new Set(participantIds);
  const used = new Set<string>();
  const out: Array<{ home: string; away: string; table: number }> = [];
  let bye: string | null = null;

  pairings.forEach((p, index) => {
    const home = p.homeTeamId;
    const away = p.awayTeamId ?? null;
    if (!allowed.has(home)) {
      throw new CupRoundError(
        "invalid_pairings",
        `Équipe non inscrite à la coupe : ${home}`,
      );
    }
    if (used.has(home)) {
      throw new CupRoundError(
        "invalid_pairings",
        `L'équipe ${home} apparaît deux fois dans la ronde`,
      );
    }
    used.add(home);

    if (away === null) {
      if (bye !== null) {
        throw new CupRoundError(
          "invalid_pairings",
          "Une ronde ne peut compter qu'une seule équipe exemptée",
        );
      }
      bye = home;
      return;
    }
    if (away === home) {
      throw new CupRoundError(
        "invalid_pairings",
        "Une équipe ne peut pas s'affronter elle-même",
      );
    }
    if (!allowed.has(away)) {
      throw new CupRoundError(
        "invalid_pairings",
        `Équipe non inscrite à la coupe : ${away}`,
      );
    }
    if (used.has(away)) {
      throw new CupRoundError(
        "invalid_pairings",
        `L'équipe ${away} apparaît deux fois dans la ronde`,
      );
    }
    used.add(away);
    out.push({ home, away, table: index + 1 });
  });

  // Tables renumérotées en continu : l'exempt ne doit pas laisser un trou.
  return {
    pairings: out.map((p, i) => ({ ...p, table: i + 1 })),
    bye,
    rematchForced: false,
  };
}

async function loadRoundView(roundId: string): Promise<CupRoundView> {
  const round = (await prisma.cupRound.findUnique({
    where: { id: roundId },
    include: { pairings: { include: PAIRING_INCLUDE } },
  })) as RoundRow | null;
  if (!round) throw new CupRoundError("round_not_found", "Ronde introuvable");
  return toRoundView(round);
}

/** Notification interne des coachs appariés (jamais bloquante). */
async function notifyRoundPairings(
  cupId: string,
  cupName: string,
  round: CupRoundView,
): Promise<void> {
  const url = `/cups/${cupId}`;
  for (const p of round.pairings) {
    if (!p.awayTeam) {
      await createInAppNotification({
        userId: p.homeTeam.ownerId,
        kind: "cup.round_pairing",
        title: `Ronde ${round.roundNumber} — ${cupName}`,
        body: `${p.homeTeam.name} est exemptée pour la ronde ${round.roundNumber} (les points d'une victoire)`,
        url,
        meta: { cupId, roundId: round.id, pairingId: p.id, bye: true },
      });
      continue;
    }
    const sides: Array<[CupPairingTeamView, CupPairingTeamView]> = [
      [p.homeTeam, p.awayTeam],
      [p.awayTeam, p.homeTeam],
    ];
    for (const [mine, theirs] of sides) {
      await createInAppNotification({
        userId: mine.ownerId,
        kind: "cup.round_pairing",
        title: `Ronde ${round.roundNumber} — ${cupName}`,
        body: `${mine.name} affronte ${theirs.name} (table ${p.tableNumber})`,
        url,
        meta: { cupId, roundId: round.id, pairingId: p.id },
      });
    }
  }
}

/**
 * Supprime la DERNIÈRE ronde (erreur du commissaire), tant qu'aucune de
 * ses rencontres n'a de match local ni de résultat.
 */
export async function deleteLastCupRound(input: {
  cupId: string;
  actor: CupActor;
}): Promise<{ deleted: true; roundNumber: number }> {
  const cup = await loadCupForActor(input.cupId);
  ensureCommissioner(cup, input.actor);
  const last = (await prisma.cupRound.findFirst({
    where: { cupId: cup.id },
    orderBy: { roundNumber: "desc" },
    select: {
      id: true,
      roundNumber: true,
      pairings: { select: { status: true, localMatch: { select: { id: true } } } },
    },
  })) as {
    id: string;
    roundNumber: number;
    pairings: Array<{ status: string; localMatch: { id: string } | null }>;
  } | null;
  if (!last) throw new CupRoundError("round_not_found", "Aucune ronde à supprimer");
  if (
    last.pairings.some((p) => p.localMatch !== null || p.status === "played")
  ) {
    throw new CupRoundError(
      "round_has_matches",
      "Des matchs de cette ronde ont déjà été créés ou joués : suppression impossible",
    );
  }
  await prisma.cupRound.delete({ where: { id: last.id } });
  return { deleted: true, roundNumber: last.roundNumber };
}

interface PairingForActor {
  id: string;
  status: string;
  /** Match local rattaché (la FK vit sur `LocalMatch.cupPairingId`). */
  localMatch: { id: string } | null;
  homeTeamId: string;
  awayTeamId: string | null;
  homeTeam: { ownerId: string };
  awayTeam: { ownerId: string } | null;
  round: { id: string; cupId: string; cup: { creatorId: string } };
}

async function loadPairingForActor(pairingId: string): Promise<PairingForActor> {
  const pairing = (await prisma.cupPairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      status: true,
      localMatch: { select: { id: true } },
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { ownerId: true } },
      awayTeam: { select: { ownerId: true } },
      round: { select: { id: true, cupId: true, cup: { select: { creatorId: true } } } },
    },
  })) as PairingForActor | null;
  if (!pairing) throw new CupRoundError("pairing_not_found", "Rencontre introuvable");
  return pairing;
}

/**
 * Date prévisionnelle d'une rencontre de coupe : coachs impliqués ou
 * commissaire, tant que la rencontre est ouverte. `null` efface la date.
 */
export async function scheduleCupPairing(input: {
  pairingId: string;
  actor: CupActor;
  scheduledAt: Date | null;
}): Promise<{ pairingId: string; scheduledAt: Date | null }> {
  const pairing = await loadPairingForActor(input.pairingId);
  const involved =
    pairing.homeTeam.ownerId === input.actor.userId ||
    pairing.awayTeam?.ownerId === input.actor.userId;
  const commissioner =
    pairing.round.cup.creatorId === input.actor.userId || input.actor.isAdmin;
  if (!involved && !commissioner) {
    throw new CupRoundError(
      "forbidden",
      "Seuls les deux coachs de la rencontre et le commissaire peuvent la planifier",
    );
  }
  if (pairing.status === "bye") {
    throw new CupRoundError("pairing_bye", "Une équipe exemptée n'a pas de rencontre à planifier");
  }
  if (!OPEN_PAIRING_STATUSES.has(pairing.status)) {
    throw new CupRoundError("pairing_closed", "Rencontre terminée : plus de date à prévoir");
  }
  await prisma.cupPairing.update({
    where: { id: pairing.id },
    data: { scheduledAt: input.scheduledAt },
    select: { id: true },
  });
  return { pairingId: pairing.id, scheduledAt: input.scheduledAt };
}

/** Annulation d'une rencontre par le commissaire (forfait double, retrait…). */
export async function cancelCupPairing(input: {
  pairingId: string;
  actor: CupActor;
}): Promise<{ pairingId: string; status: "cancelled"; roundCompleted: boolean }> {
  const pairing = await loadPairingForActor(input.pairingId);
  ensureCommissioner(pairing.round.cup, input.actor);
  if (pairing.status === "bye") {
    throw new CupRoundError("pairing_bye", "Un exempt ne s'annule pas");
  }
  if (!OPEN_PAIRING_STATUSES.has(pairing.status)) {
    throw new CupRoundError("pairing_closed", "Rencontre déjà terminée");
  }
  if (pairing.localMatch) {
    throw new CupRoundError(
      "pairing_has_match",
      "Un match local existe pour cette rencontre : annulez-le d'abord",
    );
  }
  await prisma.cupPairing.update({
    where: { id: pairing.id },
    data: { status: "cancelled" },
    select: { id: true },
  });
  const roundCompleted = await maybeCompleteCupRound(pairing.round.id);
  return { pairingId: pairing.id, status: "cancelled", roundCompleted };
}

/** Passe la ronde `completed` quand plus aucune rencontre n'est ouverte. */
export async function maybeCompleteCupRound(roundId: string): Promise<boolean> {
  const open = await prisma.cupPairing.count({
    where: { roundId, status: { in: Array.from(OPEN_PAIRING_STATUSES) } },
  });
  if (open > 0) return false;
  await prisma.cupRound.update({
    where: { id: roundId },
    data: { status: "completed" },
    select: { id: true },
  });
  return true;
}

/**
 * Résout la rencontre visée par `POST /local-match` : la coupe qu'elle
 * impose et les deux équipes attendues. Les contrôles d'appartenance des
 * équipes sont refaits ici (une rencontre ne se joue qu'entre ses deux
 * équipes).
 */
export async function resolveCupPairingForMatch(input: {
  pairingId: string;
  teamAId: string;
  teamBId: string | null;
  cupId?: string | null;
}): Promise<{ cupId: string; pairingId: string }> {
  const pairing = await loadPairingForActor(input.pairingId);
  if (input.cupId && input.cupId !== pairing.round.cupId) {
    throw new CupRoundError("team_mismatch", "La rencontre n'appartient pas à cette coupe");
  }
  if (pairing.status === "bye" || !pairing.awayTeamId) {
    throw new CupRoundError("pairing_bye", "Une équipe exemptée ne joue pas cette ronde");
  }
  if (pairing.status !== "scheduled" || pairing.localMatch) {
    throw new CupRoundError(
      pairing.localMatch ? "pairing_has_match" : "pairing_closed",
      pairing.localMatch
        ? "Un match existe déjà pour cette rencontre"
        : "Rencontre terminée ou annulée",
    );
  }
  const expected = new Set([pairing.homeTeamId, pairing.awayTeamId]);
  if (
    !input.teamBId ||
    !expected.has(input.teamAId) ||
    !expected.has(input.teamBId) ||
    input.teamAId === input.teamBId
  ) {
    throw new CupRoundError(
      "team_mismatch",
      "Le match doit opposer exactement les deux équipes de la rencontre",
    );
  }
  return { cupId: pairing.round.cupId, pairingId: pairing.id };
}

/**
 * Marque la rencontre `in_progress` une fois son match local créé (le
 * match porte `cupPairingId`, unique : deux coachs qui cliquent en même
 * temps ne peuvent pas créer deux matchs pour la même rencontre). Écriture
 * CONDITIONNELLE sur le statut : renvoie `false` si la rencontre n'était
 * plus à jouer — l'appelant retire alors son match.
 */
export async function attachLocalMatchToCupPairing(input: {
  pairingId: string;
}): Promise<boolean> {
  const updated = (await prisma.cupPairing.updateMany({
    where: { id: input.pairingId, status: "scheduled" },
    data: { status: "in_progress" },
  })) as { count: number };
  if (updated.count !== 1) return false;
  const pairing = (await prisma.cupPairing.findUnique({
    where: { id: input.pairingId },
    select: { roundId: true },
  })) as { roundId: string } | null;
  if (pairing) {
    await prisma.cupRound.updateMany({
      where: { id: pairing.roundId, status: "pending" },
      data: { status: "in_progress" },
    });
  }
  return true;
}

async function pairingOfLocalMatch(
  localMatchId: string,
): Promise<{ id: string; roundId: string; status: string } | null> {
  const match = (await prisma.localMatch.findUnique({
    where: { id: localMatchId },
    select: { cupPairingId: true },
  })) as { cupPairingId: string | null } | null;
  if (!match?.cupPairingId) return null;
  return (await prisma.cupPairing.findUnique({
    where: { id: match.cupPairingId },
    select: { id: true, roundId: true, status: true },
  })) as { id: string; roundId: string; status: string } | null;
}

/** Match local terminé -> rencontre `played`, ronde complétée si besoin. */
export async function settleCupPairingForLocalMatch(
  localMatchId: string,
): Promise<{ settled: boolean; roundCompleted: boolean }> {
  const pairing = await pairingOfLocalMatch(localMatchId);
  if (!pairing) return { settled: false, roundCompleted: false };
  if (pairing.status !== "played") {
    await prisma.cupPairing.update({
      where: { id: pairing.id },
      data: { status: "played" },
      select: { id: true },
    });
  }
  const roundCompleted = await maybeCompleteCupRound(pairing.roundId);
  return { settled: true, roundCompleted };
}

/** Match local annulé ou supprimé -> la rencontre redevient à jouer. */
export async function detachLocalMatchFromCupPairing(
  localMatchId: string,
): Promise<boolean> {
  const pairing = await pairingOfLocalMatch(localMatchId);
  if (!pairing) return false;
  await prisma.localMatch.update({
    where: { id: localMatchId },
    data: { cupPairingId: null },
    select: { id: true },
  });
  await prisma.cupPairing.update({
    where: { id: pairing.id },
    data: { status: "scheduled" },
    select: { id: true },
  });
  // Une ronde complétée par ce match redevient ouverte.
  await prisma.cupRound.updateMany({
    where: { id: pairing.roundId, status: "completed" },
    data: { status: "in_progress" },
  });
  return true;
}
