/**
 * Application d'améliorations « au build » depuis un pool de PSP.
 *
 * Contexte : le mode « édition avancée » du builder (et les coupes qui
 * accordent des PSP de départ) permettent au coach de dépenser un pool de PSP
 * en améliorations **avant** que l'équipe ne joue. Contrairement au flux de
 * ligue, ces PSP ne proviennent PAS de `TeamPlayer.spp` (qui reste à 0) mais
 * d'un pool d'équipe.
 *
 * Implémentation DRY : on **réutilise** `applyAdvancementChoice` (validation
 * d'accès, anti-triche random-primary, surcharge de VE, transaction) via une
 * astuce « créditer-puis-dépenser » : on crédite le joueur du coût exact,
 * `applyAdvancementChoice` le consomme, le solde `spp` du joueur revient donc
 * à sa valeur initiale (0). Le pool, lui, est décrémenté.
 *
 * Chaque advancement est appliqué dans sa propre transaction (celle de
 * `applyAdvancementChoice`). L'atomicité « tout ou rien » du build est assurée
 * par le caller (`handleBuildTeam`), qui supprime l'équipe si une erreur est
 * levée ici.
 */

import { prisma } from '../prisma';
import {
  getNextAdvancementPspCost,
  type AdvancementType,
  type CharacteristicKind,
} from '@bb/game-engine';
import { applyAdvancementChoice } from './post-match-league-sequence';

/** Erreur typée d'application d'un advancement au build. */
export class CupBuildAdvancementError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'CupBuildAdvancementError';
  }
}

/** Une amélioration à appliquer, ciblant un joueur déjà créé. */
export interface BuildAdvancementInput {
  readonly playerId: string;
  readonly type: AdvancementType;
  readonly skillSlug?: string;
  readonly category?: string;
  readonly stat?: CharacteristicKind;
  readonly d8?: number;
}

export interface CupBuildAdvancementsResult {
  readonly poolSpent: number;
  readonly poolRemaining: number;
  readonly count: number;
}

function countAdvancements(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Applique une liste d'améliorations depuis un pool de PSP. Lève une
 * `CupBuildAdvancementError` au premier refus (pool insuffisant, joueur hors
 * équipe, accès invalide…). Le caller doit alors annuler le build.
 */
export async function applyCupBuildAdvancements(
  teamId: string,
  pool: number,
  advancements: readonly BuildAdvancementInput[],
): Promise<CupBuildAdvancementsResult> {
  let remaining = pool;
  let applied = 0;

  for (const adv of advancements) {
    const player = await prisma.teamPlayer.findUnique({
      where: { id: adv.playerId },
      select: { id: true, teamId: true, advancements: true },
    });
    if (!player || player.teamId !== teamId) {
      throw new CupBuildAdvancementError(
        'player-not-on-team',
        `Joueur ${adv.playerId} introuvable pour cette équipe`,
      );
    }

    const taken = countAdvancements(player.advancements);
    const cost = getNextAdvancementPspCost(taken, adv.type);
    if (cost > remaining) {
      throw new CupBuildAdvancementError(
        'pool-exceeded',
        `Pool de PSP insuffisant : ${cost} requis, ${remaining} restant`,
        { required: cost, remaining },
      );
    }

    // Crédite exactement le coût pour que `applyAdvancementChoice` puisse le
    // dépenser ; le solde `spp` du joueur reviendra à sa valeur initiale.
    await prisma.teamPlayer.update({
      where: { id: adv.playerId },
      data: { spp: { increment: cost } },
    });

    let outcome;
    try {
      outcome = await applyAdvancementChoice({
        teamId,
        playerId: adv.playerId,
        type: adv.type,
        skillSlug: adv.skillSlug,
        category: adv.category,
        stat: adv.stat,
        d8: adv.d8,
      });
    } catch (e) {
      await rollbackCredit(adv.playerId, cost);
      throw new CupBuildAdvancementError(
        'apply-failed',
        "Échec de l'application de l'amélioration",
        e,
      );
    }

    if ('skipped' in outcome) {
      await rollbackCredit(adv.playerId, cost);
      throw new CupBuildAdvancementError(
        outcome.reason,
        `Amélioration refusée : ${outcome.reason}`,
        outcome,
      );
    }

    remaining -= cost;
    applied += 1;
  }

  return { poolSpent: pool - remaining, poolRemaining: remaining, count: applied };
}

async function rollbackCredit(playerId: string, cost: number): Promise<void> {
  try {
    await prisma.teamPlayer.update({
      where: { id: playerId },
      data: { spp: { decrement: cost } },
    });
  } catch {
    // best-effort : le crédit était transitoire, le build sera annulé par le caller.
  }
}
