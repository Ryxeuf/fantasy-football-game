/**
 * Feuille de match de COUPE : ce que la validation écrit, et ce qu'elle
 * n'écrit pas.
 *
 * Une coupe se joue en résurrection : aucun PSP, aucune blessure, aucune
 * mort, aucun or, aucun fan dévoué, aucune évolution, aucun achat, aucun
 * licenciement. Le pipeline d'après-match de la ligue
 * (`recordOfflineLeagueResult`) n'est donc PAS appelé — c'est la seule
 * différence de fond entre les deux feuilles, tout le reste (saisie,
 * soumission, validation, invalidation) est le MÊME code.
 *
 * Reste à faire remonter le résultat au classement. Le classement d'une
 * coupe est DÉRIVÉ de ses `LocalMatch` terminés (`computeCupStandings`,
 * `computeCupPlayerLeaderboards`, podiums par action). Plutôt que de
 * dupliquer ces trois lectures pour qu'elles sachent aussi lire une
 * feuille, la validation MATÉRIALISE la rencontre en `LocalMatch`
 * « complété » et rejoue le journal de la feuille en `LocalMatchAction` —
 * exactement ce que fait la ligue avec son `Match` offline synthétique.
 * Classement, podiums et classements individuels continuent donc de
 * fonctionner sans une ligne de changement.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  detachLocalMatchFromCupPairing,
  settleCupPairingForLocalMatch,
} from "./cup-rounds";

export {
  sheetEventsToLocalMatchActions,
  type CupLocalMatchActionDraft,
  type CupPlayerNameResolver,
  type CupSheetEvent,
} from "./cup-sheet-actions";
import type { CupLocalMatchActionDraft } from "./cup-sheet-actions";

export interface SettleCupMatchSheetInput {
  readonly cupId: string;
  readonly cupPairingId: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly creatorId: string;
  readonly scoreHome: number;
  readonly scoreAway: number;
  readonly actions: readonly CupLocalMatchActionDraft[];
}

export interface SettleCupMatchSheetResult {
  readonly localMatchId: string;
  readonly roundCompleted: boolean;
}

/**
 * Matérialise (ou remet à jour) le `LocalMatch` d'une rencontre de coupe et
 * clôt la rencontre. IDEMPOTENT : revalider une feuille réécrit le score et
 * le journal d'actions au lieu d'empiler un second match — `cupPairingId`
 * est unique côté base, un doublon est structurellement impossible.
 */
export async function settleCupMatchSheet(
  input: SettleCupMatchSheetInput,
): Promise<SettleCupMatchSheetResult> {
  const existing = (await prisma.localMatch.findUnique({
    where: { cupPairingId: input.cupPairingId },
    select: { id: true },
  })) as { id: string } | null;

  const scores = {
    status: "completed",
    completedAt: new Date(),
    scoreTeamA: input.scoreHome,
    scoreTeamB: input.scoreAway,
  };

  let localMatchId: string;
  if (existing) {
    await prisma.localMatch.update({ where: { id: existing.id }, data: scores });
    await prisma.localMatchAction.deleteMany({
      where: { matchId: existing.id },
    });
    localMatchId = existing.id;
  } else {
    const created = (await prisma.localMatch.create({
      data: {
        ...scores,
        // Le match n'est pas jouable : il matérialise une feuille validée.
        isPublic: true,
        creatorId: input.creatorId,
        teamAId: input.homeTeamId,
        teamBId: input.awayTeamId,
        cupId: input.cupId,
        cupPairingId: input.cupPairingId,
        teamAOwnerValidated: true,
        teamBOwnerValidated: true,
        startedAt: new Date(),
      },
      select: { id: true },
    })) as { id: string };
    localMatchId = created.id;
  }

  if (input.actions.length > 0) {
    await prisma.localMatchAction.createMany({
      data: input.actions.map((a) => ({ ...a, matchId: localMatchId })),
    });
  }

  const settled = await settleCupPairingForLocalMatch(localMatchId);
  return { localMatchId, roundCompleted: settled.roundCompleted };
}

/**
 * Défait la matérialisation d'une feuille de coupe invalidée : le match
 * local synthétique et ses actions disparaissent, la rencontre repasse
 * `scheduled` et la ronde se rouvre. Le classement, entièrement dérivé,
 * revient donc de lui-même à son état d'avant validation.
 *
 * Best-effort sur le détachement : la suppression en cascade des actions
 * est portée par la FK, et une rencontre déjà détachée n'est pas une erreur.
 */
export async function revertCupMatchSheet(input: {
  readonly cupPairingId: string;
}): Promise<{ removed: boolean }> {
  const existing = (await prisma.localMatch.findUnique({
    where: { cupPairingId: input.cupPairingId },
    select: { id: true },
  })) as { id: string } | null;
  if (!existing) return { removed: false };

  try {
    await detachLocalMatchFromCupPairing(existing.id);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.error(
      `[cup-match-sheet] détachement de la rencontre échoué: ${msg}`,
    );
  }
  await prisma.localMatchAction.deleteMany({ where: { matchId: existing.id } });
  await prisma.localMatch.delete({ where: { id: existing.id } });
  return { removed: true };
}

/** Statuts de coupe qui ferment la fenêtre de correction d'une feuille. */
const CLOSED_CUP_STATUSES = new Set(["terminee", "archivee"]);

/**
 * Fenêtre d'invalidation d'une feuille de coupe. Contrairement à la ligue,
 * il n'y a rien à « dé-appliquer » sur les équipes : la seule contrainte est
 * que la coupe soit encore en cours — un palmarès publié ne se réécrit pas.
 */
export async function canInvalidateCupMatchSheet(input: {
  readonly cupId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const cup = (await prisma.cup.findUnique({
    where: { id: input.cupId },
    select: { status: true },
  })) as { status: string } | null;
  if (!cup) return { ok: false, reason: "cup_not_found" };
  if (CLOSED_CUP_STATUSES.has(cup.status)) {
    return { ok: false, reason: "cup-completed" };
  }
  return { ok: true };
}
