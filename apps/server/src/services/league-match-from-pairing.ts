/**
 * L2.A.4 — Cree un Match a partir d'un LeaguePairing pre-genere.
 *
 * Sprint Ligues v2 : remplace la creation manuelle par matchmaking
 * pour les rencontres de ligue. Le pairing est pre-cree au demarrage
 * de la saison (cf. `league-scheduler.startSeason`). Cette fonction
 * "materialise" la rencontre en creant un Match standard, en y
 * ajoutant les TeamSelection des deux participants, et en liant le
 * tout au pairing pour faciliter la mise a jour de status par
 * `recordLeagueMatchResult` (L2.A.5).
 *
 * Contrats :
 *  - Le pairing doit etre `scheduled` (pas deja `played`, `forfeit_*`
 *    ou `cancelled`).
 *  - L'appelant doit posseder l'une des 2 equipes (verifie ici via
 *    le `Team.ownerId` des participants).
 *  - Idempotent partiel : si le pairing a deja un `matchId`, retourne
 *    l'existant sans rien recreer.
 *  - Met a jour `LeaguePairing.status='in_progress'` apres creation.
 */

import { prisma } from "../prisma";

export type CreateMatchFromPairingResult =
  | {
      readonly created: true;
      readonly matchId: string;
      readonly pairingId: string;
      readonly seasonId: string;
      readonly roundId: string;
    }
  | {
      readonly created: false;
      readonly reason: "already-materialized";
      readonly matchId: string;
      readonly pairingId: string;
    };

export interface CreateMatchFromPairingInput {
  readonly pairingId: string;
  readonly userId: string;
  readonly seed?: string;
}

interface PairingWithRelations {
  id: string;
  status: string;
  match: { id: string } | null;
  round: { id: string; seasonId: string };
  homeParticipant: {
    id: string;
    teamId: string;
    team: { id: string; ownerId: string; name: string };
  };
  awayParticipant: {
    id: string;
    teamId: string;
    team: { id: string; ownerId: string; name: string };
  };
}

const ALLOWED_STATUSES = new Set(["scheduled"]);

function generateSeed(): string {
  return `league-match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function createMatchFromPairing(
  input: CreateMatchFromPairingInput,
): Promise<CreateMatchFromPairingResult> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: input.pairingId },
    include: {
      match: { select: { id: true } },
      round: { select: { id: true, seasonId: true } },
      homeParticipant: {
        include: {
          team: { select: { id: true, ownerId: true, name: true } },
        },
      },
      awayParticipant: {
        include: {
          team: { select: { id: true, ownerId: true, name: true } },
        },
      },
    },
  })) as PairingWithRelations | null;

  if (!pairing) {
    throw new Error(`Pairing introuvable: ${input.pairingId}`);
  }

  // Idempotence : si un match existe deja, on le retourne tel quel.
  if (pairing.match) {
    return {
      created: false,
      reason: "already-materialized",
      matchId: pairing.match.id,
      pairingId: pairing.id,
    };
  }

  if (!ALLOWED_STATUSES.has(pairing.status)) {
    throw new Error(
      `Pairing dans un status incompatible (${pairing.status}). Attendu : scheduled.`,
    );
  }

  const homeOwnerId = pairing.homeParticipant.team.ownerId;
  const awayOwnerId = pairing.awayParticipant.team.ownerId;
  if (input.userId !== homeOwnerId && input.userId !== awayOwnerId) {
    throw new Error(
      "Seul un des deux coachs apparies peut lancer le match",
    );
  }

  if (homeOwnerId === awayOwnerId) {
    // Cas extreme : un coach a deux equipes inscrites et est apparie
    // contre lui-meme. Refuse pour eviter d'avoir un Match avec un
    // seul joueur connu.
    throw new Error(
      "Les deux equipes appartiennent au meme coach : pairing invalide",
    );
  }

  const seed = input.seed ?? generateSeed();

  // Transaction : creation Match + TeamSelection + update pairing en
  // une seule operation pour garantir la coherence (pas de pairing
  // `in_progress` sans Match associe).
  const result = await prisma.$transaction(async (tx: typeof prisma) => {
    const match = await tx.match.create({
      data: {
        status: "pending",
        seed,
        players: {
          connect: [{ id: homeOwnerId }, { id: awayOwnerId }],
        },
        leagueSeasonId: pairing.round.seasonId,
        leagueRoundId: pairing.round.id,
        leaguePairingId: pairing.id,
      },
      select: { id: true },
    });

    await tx.teamSelection.createMany({
      data: [
        {
          matchId: match.id,
          userId: homeOwnerId,
          teamId: pairing.homeParticipant.teamId,
          team: pairing.homeParticipant.team.name,
        },
        {
          matchId: match.id,
          userId: awayOwnerId,
          teamId: pairing.awayParticipant.teamId,
          team: pairing.awayParticipant.team.name,
        },
      ],
    });

    await tx.leaguePairing.update({
      where: { id: pairing.id },
      data: { status: "in_progress" },
    });

    return { matchId: match.id };
  });

  return {
    created: true,
    matchId: result.matchId,
    pairingId: pairing.id,
    seasonId: pairing.round.seasonId,
    roundId: pairing.round.id,
  };
}
