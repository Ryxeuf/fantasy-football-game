/**
 * Lot F — Creation/edition manuelle de pairings de ligue.
 *
 * Permet au commissaire (createur de la ligue) d'ajouter des matchs
 * en dehors du calendrier auto-genere (`league-scheduler.ts`), de
 * deplacer ou supprimer des pairings non-joues, et de creer des
 * rounds "personnalises" (amicaux, rounds bonus, etc.).
 *
 * Garde-fous :
 *   - Pas de mutation possible si un match a deja ete lance/joue
 *     pour ce pairing (`matchId` non-null OU status >= played).
 *   - L'ajout d'un pairing necessite que les 2 participants soient
 *     bien inscrits a la saison (status='active').
 *   - Pas de doublon : on refuse un pairing identique (meme home,
 *     meme away, meme round) deja present.
 */

import { prisma } from "../prisma";

export class LeagueManualPairingError extends Error {
  constructor(
    public readonly code:
      | "round_not_found"
      | "season_not_found"
      | "pairing_not_found"
      | "participant_not_found"
      | "participant_not_active"
      | "duplicate_pairing"
      | "same_participant"
      | "pairing_already_played"
      | "round_completed",
    message: string,
  ) {
    super(message);
    this.name = "LeagueManualPairingError";
  }
}

export interface CreateManualRoundInput {
  seasonId: string;
  /** Optionnel — nom personnalise du round ("Amical mid-season"). */
  name?: string;
  /** "regular" (default) ou "playoff". */
  kind?: "regular" | "playoff";
  startDate?: Date | null;
  endDate?: Date | null;
}

/**
 * Crée un round vide en fin de saison (roundNumber = max+1). Permet
 * d'ajouter des matchs hors du round-robin auto-genere.
 */
export async function createManualRound(input: CreateManualRoundInput) {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: input.seasonId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new LeagueManualPairingError(
      "season_not_found",
      `Saison introuvable: ${input.seasonId}`,
    );
  }

  const last = await prisma.leagueRound.findFirst({
    where: { seasonId: input.seasonId },
    orderBy: { roundNumber: "desc" },
    select: { roundNumber: true },
  });
  const nextNumber = (last?.roundNumber ?? 0) + 1;

  return prisma.leagueRound.create({
    data: {
      seasonId: input.seasonId,
      roundNumber: nextNumber,
      name: input.name ?? `Journee ${nextNumber}`,
      kind: input.kind ?? "regular",
      status: "pending",
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    },
  });
}

export interface CreateManualPairingInput {
  roundId: string;
  homeParticipantId: string;
  awayParticipantId: string;
  scheduledAt?: Date | null;
  deadlineAt?: Date | null;
}

/**
 * Crée un pairing dans un round existant. Verifications :
 *   - le round existe et n'est pas "completed".
 *   - les deux participants existent, sont actifs, appartiennent a
 *     la meme saison que le round.
 *   - le couple (home, away, round) n'existe pas deja.
 *   - home != away.
 */
export async function createManualPairing(input: CreateManualPairingInput) {
  if (input.homeParticipantId === input.awayParticipantId) {
    throw new LeagueManualPairingError(
      "same_participant",
      "Le meme participant ne peut pas jouer contre lui-meme",
    );
  }

  const round = await prisma.leagueRound.findUnique({
    where: { id: input.roundId },
    select: { id: true, seasonId: true, status: true },
  });
  if (!round) {
    throw new LeagueManualPairingError(
      "round_not_found",
      `Round introuvable: ${input.roundId}`,
    );
  }
  if (round.status === "completed") {
    throw new LeagueManualPairingError(
      "round_completed",
      "Round termine : impossible d'ajouter un pairing",
    );
  }

  const participants = await prisma.leagueParticipant.findMany({
    where: {
      id: { in: [input.homeParticipantId, input.awayParticipantId] },
    },
    select: { id: true, seasonId: true, status: true },
  });
  if (participants.length !== 2) {
    throw new LeagueManualPairingError(
      "participant_not_found",
      "Un ou plusieurs participants introuvables",
    );
  }
  for (const p of participants) {
    if (p.seasonId !== round.seasonId) {
      throw new LeagueManualPairingError(
        "participant_not_found",
        "Un participant n'appartient pas a la saison du round",
      );
    }
    if (p.status !== "active") {
      throw new LeagueManualPairingError(
        "participant_not_active",
        `Le participant ${p.id} n'est pas actif (status=${p.status})`,
      );
    }
  }

  // Refus du doublon (meme couple dans le meme round, indifferent
  // a l'ordre home/away).
  const existing = await prisma.leaguePairing.findFirst({
    where: {
      roundId: input.roundId,
      OR: [
        {
          homeParticipantId: input.homeParticipantId,
          awayParticipantId: input.awayParticipantId,
        },
        {
          homeParticipantId: input.awayParticipantId,
          awayParticipantId: input.homeParticipantId,
        },
      ],
    },
    select: { id: true },
  });
  if (existing) {
    throw new LeagueManualPairingError(
      "duplicate_pairing",
      "Un pairing existe deja pour ces 2 participants dans ce round",
    );
  }

  return prisma.leaguePairing.create({
    data: {
      roundId: input.roundId,
      homeParticipantId: input.homeParticipantId,
      awayParticipantId: input.awayParticipantId,
      status: "scheduled",
      scheduledAt: input.scheduledAt ?? null,
      deadlineAt: input.deadlineAt ?? null,
    },
  });
}

/**
 * Supprime un pairing — uniquement si pas encore joue (status =
 * scheduled OU cancelled, pas de matchId).
 */
export async function deleteManualPairing(input: { pairingId: string }) {
  const pairing = await prisma.leaguePairing.findUnique({
    where: { id: input.pairingId },
    include: { match: { select: { id: true } } },
  });
  if (!pairing) {
    throw new LeagueManualPairingError(
      "pairing_not_found",
      `Pairing introuvable: ${input.pairingId}`,
    );
  }
  // Le pairing est consomme si un match a ete cree et joue (status
  // played/forfeit_*).
  const consumedStatuses = new Set([
    "played",
    "forfeit_home",
    "forfeit_away",
  ]);
  if (consumedStatuses.has(pairing.status) || pairing.match) {
    throw new LeagueManualPairingError(
      "pairing_already_played",
      "Pairing deja joue : suppression impossible",
    );
  }
  await prisma.leaguePairing.delete({ where: { id: input.pairingId } });
  return { deleted: true };
}

export interface UpdateManualPairingInput {
  pairingId: string;
  scheduledAt?: Date | null;
  deadlineAt?: Date | null;
  /** Optionnel — deplace le pairing vers un autre round. */
  targetRoundId?: string;
}

/** Met a jour un pairing (deplacement / re-programmation). */
export async function updateManualPairing(input: UpdateManualPairingInput) {
  const pairing = await prisma.leaguePairing.findUnique({
    where: { id: input.pairingId },
    include: { match: { select: { id: true } } },
  });
  if (!pairing) {
    throw new LeagueManualPairingError(
      "pairing_not_found",
      `Pairing introuvable: ${input.pairingId}`,
    );
  }
  if (pairing.match || pairing.status === "played") {
    throw new LeagueManualPairingError(
      "pairing_already_played",
      "Pairing deja joue : modification impossible",
    );
  }

  let roundIdToUse = pairing.roundId;
  if (input.targetRoundId && input.targetRoundId !== pairing.roundId) {
    const target = await prisma.leagueRound.findUnique({
      where: { id: input.targetRoundId },
      select: { id: true, seasonId: true, status: true },
    });
    if (!target) {
      throw new LeagueManualPairingError(
        "round_not_found",
        `Round cible introuvable: ${input.targetRoundId}`,
      );
    }
    if (target.status === "completed") {
      throw new LeagueManualPairingError(
        "round_completed",
        "Round cible termine : impossible de deplacer le pairing",
      );
    }
    // Coherence saison (on ne deplace pas inter-saison).
    const currentRound = await prisma.leagueRound.findUnique({
      where: { id: pairing.roundId },
      select: { seasonId: true },
    });
    if (currentRound && currentRound.seasonId !== target.seasonId) {
      throw new LeagueManualPairingError(
        "round_not_found",
        "Le round cible n'appartient pas a la meme saison",
      );
    }
    roundIdToUse = target.id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = { roundId: roundIdToUse };
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
  if (input.deadlineAt !== undefined) data.deadlineAt = input.deadlineAt;

  return prisma.leaguePairing.update({
    where: { id: input.pairingId },
    data,
  });
}
