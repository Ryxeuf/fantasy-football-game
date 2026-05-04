/**
 * L2.A.11 — Service de gestion des forfaits de pairing.
 *
 * Sprint Ligues v2 PR3 : applique automatiquement le forfait sur les
 * pairings dont la deadline est depassee et qui n'ont pas encore ete
 * joues. Idempotent : un pairing deja `played` / `forfeit_*` /
 * `cancelled` est ignore.
 *
 * Politique de forfait (par defaut, configurable plus tard) :
 *   - Si aucun match n'a ete cree (`status=scheduled` -> `pairing.match=null`)
 *     a la deadline, on considere les deux equipes responsables :
 *     pas de match donne, mais le pairing est marque "no-show". Pour
 *     ne pas penaliser un seul cote, on inscrit forfeit_home par
 *     defaut (le home est cense organiser la rencontre). Override
 *     possible via `recordForfeit({pairingId, side})`.
 *   - Si un match est `pending`/`in_progress` mais pas termine, le
 *     pairing est marque selon le cote demande (`side`) ou le cote
 *     "home" par defaut.
 *
 * Comptabilisation : un forfait s'inscrit dans le classement avec un
 * score symbolique 0-2 (le perdant prend 2 TD encaisses, le gagnant
 * 2 TD inscrits). On reutilise `recordLeagueMatchResult` pour passer
 * par la meme transaction (compteurs + ELO + flag `leagueScoredAt`),
 * en synthetisant un Match temporaire si necessaire — ou plus simple,
 * en appliquant un update direct sur les LeagueParticipant et le
 * pairing, sans Match. Pour rester coherent avec la machine d'etats
 * existante, on choisit la 2e voie : un forfait n'a pas de Match.
 *
 * Le pairing prend `status='forfeit_home'` ou `'forfeit_away'`. Les
 * compteurs `wins/draws/losses/points/touchdownsFor/touchdownsAgainst`
 * sont mis a jour dans la meme transaction. ELO saisonnier non
 * impacte par les forfaits (regle metier : on ne veut pas qu'un
 * coach perde des points pour une no-show de l'adversaire ; rester
 * neutre est l'option la plus juste).
 */

import { prisma } from "../prisma";
import { persistSeasonAwards } from "./league-scoring";
import { serverLog } from "../utils/server-log";

export type ForfeitSide = "home" | "away";

export interface RecordForfeitInput {
  readonly pairingId: string;
  /**
   * Cote qui forfait. Le cote oppose remporte la rencontre 2-0.
   * Default : "home" (suit la convention "le home etait responsable
   * d'organiser la rencontre" en l'absence d'information).
   */
  readonly side?: ForfeitSide;
  /**
   * Score TD attribue a l'equipe gagnante. Default : 2 (BB officiel
   * pour un forfait, et symetrique a la regle pratique des ligues
   * du commerce).
   */
  readonly winnerScore?: number;
}

export type RecordForfeitOutcome =
  | {
      readonly recorded: true;
      readonly pairingId: string;
      readonly side: ForfeitSide;
      readonly winnerParticipantId: string;
      readonly loserParticipantId: string;
    }
  | {
      readonly skipped: true;
      readonly reason:
        | "pairing-missing"
        | "pairing-not-terminal-eligible"
        | "match-already-scored";
    };

const NON_TERMINAL = new Set(["scheduled", "in_progress"]);

interface PairingWithRelations {
  id: string;
  status: string;
  match: { id: string; leagueScoredAt: Date | null } | null;
  round: { id: string; seasonId: string };
  homeParticipantId: string;
  awayParticipantId: string;
  homeParticipant: {
    id: string;
    seasonId: string;
  };
  awayParticipant: {
    id: string;
    seasonId: string;
  };
}

interface SeasonBareme {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
}

async function loadPairing(
  pairingId: string,
): Promise<PairingWithRelations | null> {
  return (await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    include: {
      match: { select: { id: true, leagueScoredAt: true } },
      round: { select: { id: true, seasonId: true } },
      homeParticipant: { select: { id: true, seasonId: true } },
      awayParticipant: { select: { id: true, seasonId: true } },
    },
  })) as PairingWithRelations | null;
}

async function loadSeasonBareme(seasonId: string): Promise<SeasonBareme | null> {
  const row = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: {
      league: {
        select: {
          winPoints: true,
          drawPoints: true,
          lossPoints: true,
          forfeitPoints: true,
        },
      },
    },
  });
  if (!row) return null;
  return row.league;
}

/**
 * Applique un forfait sur un pairing. Idempotent.
 */
export async function recordForfeit(
  input: RecordForfeitInput,
): Promise<RecordForfeitOutcome> {
  const pairing = await loadPairing(input.pairingId);
  if (!pairing) {
    return { skipped: true, reason: "pairing-missing" };
  }

  if (!NON_TERMINAL.has(pairing.status)) {
    return { skipped: true, reason: "pairing-not-terminal-eligible" };
  }

  // Si un match existe et a deja ete comptabilise (`leagueScoredAt`),
  // on ne peut pas appliquer un forfait dessus : la rencontre est
  // joue. Cas extreme : course entre fin-de-match et cron.
  if (pairing.match?.leagueScoredAt) {
    return { skipped: true, reason: "match-already-scored" };
  }

  const side: ForfeitSide = input.side ?? "home";
  const winnerScore = input.winnerScore ?? 2;
  const winnerParticipantId =
    side === "home"
      ? pairing.awayParticipantId
      : pairing.homeParticipantId;
  const loserParticipantId =
    side === "home"
      ? pairing.homeParticipantId
      : pairing.awayParticipantId;

  const seasonId = pairing.round.seasonId;
  const bareme = await loadSeasonBareme(seasonId);
  if (!bareme) {
    return { skipped: true, reason: "pairing-missing" };
  }

  const newPairingStatus =
    side === "home" ? "forfeit_home" : "forfeit_away";

  // Transaction : on met a jour
  //   - les compteurs des deux participants (wins/losses/points/td)
  //   - le pairing (`status` + `updatedAt`)
  //   - le match associe si present (`leagueScoredAt` pour eviter une
  //     double comptabilisation par recordLeagueMatchResult).
  const updates = [
    prisma.leagueParticipant.update({
      where: { id: winnerParticipantId },
      data: {
        wins: { increment: 1 },
        points: { increment: bareme.winPoints },
        touchdownsFor: { increment: winnerScore },
      },
    }),
    prisma.leagueParticipant.update({
      where: { id: loserParticipantId },
      data: {
        losses: { increment: 1 },
        // Le perdant recoit `forfeitPoints` (peut etre negatif) au
        // lieu de `lossPoints`, c'est la difference cle entre forfait
        // et defaite reguliere.
        points: { increment: bareme.forfeitPoints },
        touchdownsAgainst: { increment: winnerScore },
      },
    }),
    prisma.leaguePairing.update({
      where: { id: pairing.id },
      data: { status: newPairingStatus },
    }),
  ];

  if (pairing.match) {
    updates.push(
      prisma.match.update({
        where: { id: pairing.match.id },
        data: { leagueScoredAt: new Date() },
      }),
    );
  }

  await prisma.$transaction(updates);

  // Cloture de round / saison si applicable. Reutilise la meme
  // logique que `recordLeagueMatchResult` mais simplifiee : on ne
  // s'occupe que du round et de la saison liee a ce pairing.
  await maybeCompleteRoundAndSeason(pairing.round.id, seasonId);

  serverLog.info(
    `[league-forfeit] pairing=${pairing.id} side=${side} winner=${winnerParticipantId} loser=${loserParticipantId}`,
  );

  return {
    recorded: true,
    pairingId: pairing.id,
    side,
    winnerParticipantId,
    loserParticipantId,
  };
}

async function maybeCompleteRoundAndSeason(
  roundId: string,
  seasonId: string,
): Promise<void> {
  const pendingPairings = await prisma.leaguePairing.count({
    where: {
      roundId,
      status: { in: ["scheduled", "in_progress"] },
    },
  });
  if (pendingPairings > 0) return;

  await prisma.leagueRound.update({
    where: { id: roundId },
    data: { status: "completed" },
  });

  const remaining = await prisma.leagueRound.findMany({
    where: { seasonId, status: { not: "completed" } },
    select: { id: true },
  });
  if (remaining.length === 0) {
    await prisma.leagueSeason.update({
      where: { id: seasonId },
      data: { status: "completed" },
    });
    // L2.C.1 — fire-and-forget : snapshot d'awards quand la saison
    // se cloture par un forfait final.
    persistSeasonAwards(seasonId).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(
        `[league-forfeit] persistSeasonAwards failed: ${msg}`,
      );
    });
  }
}

/**
 * Sweep : applique un forfait sur tous les pairings dont la
 * `deadlineAt` est depassee et qui n'ont pas encore de resultat.
 * Appele par un job/cron toutes les heures (en prod) ou
 * declenchable manuellement.
 *
 * Limite : on traite un batch de `limit` pairings par appel pour
 * eviter une transaction trop longue. Un appel suivant prendra le
 * reste.
 */
export interface SweepDeadlinePairingsInput {
  readonly now?: Date;
  readonly limit?: number;
  readonly defaultSide?: ForfeitSide;
}

export interface SweepDeadlinePairingsOutcome {
  readonly inspected: number;
  readonly forfeited: number;
  readonly skipped: number;
}

export async function sweepDeadlinePairings(
  input: SweepDeadlinePairingsInput = {},
): Promise<SweepDeadlinePairingsOutcome> {
  const now = input.now ?? new Date();
  const limit = Math.max(1, Math.min(input.limit ?? 50, 500));
  const defaultSide: ForfeitSide = input.defaultSide ?? "home";

  const due = await prisma.leaguePairing.findMany({
    where: {
      status: { in: ["scheduled", "in_progress"] },
      deadlineAt: { not: null, lte: now },
    },
    select: { id: true },
    take: limit,
    orderBy: { deadlineAt: "asc" },
  });

  let forfeited = 0;
  let skipped = 0;
  for (const p of due) {
    const r = await recordForfeit({ pairingId: p.id, side: defaultSide });
    if ("recorded" in r && r.recorded) {
      forfeited += 1;
    } else {
      skipped += 1;
    }
  }

  return { inspected: due.length, forfeited, skipped };
}
