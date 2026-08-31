/**
 * Rattrapage : PSP fantômes et coûts manquants sur les améliorations
 * achetées AU BUILD.
 *
 * Jusqu'au correctif, `applyCupBuildAdvancements` créditait le joueur du
 * coût du règlement de tournoi (Garde primaire Élite = 8 PSP sous NAF World
 * Cup 2027) mais `applyAdvancementChoice` ne débitait que le barème standard
 * (6). Deux dégâts, tous deux persistés :
 *
 *  1. l'écart restait en **SPP fantômes** sur le joueur — 12 PSP jamais
 *     gagnés sur une équipe Ogre — dépensables ensuite en compétences
 *     supplémentaires, et HORS des règles du tournoi (le financement « SPP
 *     du joueur » n'est pas soumis au règlement) ;
 *  2. l'amélioration ne portait ni `pspCost` ni `fundedBy`, si bien que la
 *     comptabilité du pool retombait sur le barème standard : 54 PSP
 *     annoncés dépensés sur un pool de 66.
 *
 * Le point 2 est déjà corrigé À LA LECTURE (`fallbackPspCostForTeam`) —
 * `prisma/migrations/` est gitignoré, aucun backfill de migration n'est
 * possible ici. Ce script FIGE ce calcul de lecture dans la donnée et
 * reprend les SPP fantômes.
 *
 * Périmètre volontairement étroit : une équipe n'est touchée que si
 *  - elle a un pool de construction (`startingPspPool > 0`) ;
 *  - son roster n'est pas figé (`isTeamRosterFrozen`) — au-delà, les SPP
 *    ont une histoire de match que ce calcul ne saurait reconstituer ;
 *  - le joueur porte des améliorations sans `pspCost`.
 *
 * Le solde SPP n'est JAMAIS remonté, seulement ramené à 0 quand tout son
 * contenu est un résidu de build : un joueur dont les SPP viennent d'un
 * match est laissé intact.
 *
 * Usage :
 *   pnpm --filter server db:repair-build-psp            # simulation
 *   pnpm --filter server db:repair-build-psp -- --apply
 */

import {
  advancementPspCost,
  parseAdvancements,
  type PoolFundedAdvancement,
} from '@bb/game-engine';
import { prisma } from '../prisma';
import { fallbackPspCostForTeam } from '../services/team-advancement-editing';
import { isTeamRosterFrozen } from '../services/team-lock-status';
import { serverLog } from '../utils/server-log';

export interface RepairResult {
  readonly scannedTeams: number;
  readonly repairedTeams: number;
  readonly repairedPlayers: number;
  /** SPP fantômes retirés au total. */
  readonly sppReclaimed: number;
}

/**
 * Une amélioration est « de build » quand rien ne la rattache aux SPP du
 * joueur : pas de `fundedBy: 'player'`. C'est la même convention que
 * `poolSpentForPlayer` (absence de source ⇒ pool).
 */
function isBuildFunded(adv: PoolFundedAdvancement): boolean {
  return adv.fundedBy !== 'player';
}

export async function repairBuildAdvancementPsp(
  apply: boolean,
): Promise<RepairResult> {
  const teams = await prisma.team.findMany({
    where: { startingPspPool: { gt: 0 }, deletedAt: null },
    select: {
      id: true,
      name: true,
      ruleset: true,
      tournamentRuleset: true,
      players: { select: { id: true, name: true, spp: true, advancements: true } },
    },
  });

  let repairedTeams = 0;
  let repairedPlayers = 0;
  let sppReclaimed = 0;

  for (const team of teams) {
    if (await isTeamRosterFrozen(team.id)) continue;

    const fallback = await fallbackPspCostForTeam(
      team.tournamentRuleset,
      team.ruleset,
    );
    let touchedTeam = false;

    for (const player of team.players) {
      const advancements = parseAdvancements(player.advancements);
      if (advancements.length === 0) continue;
      // Rien à figer : tous les coûts sont déjà persistés.
      if (advancements.every((a) => typeof a.pspCost === 'number')) continue;

      // Coût RÉEL de chaque amélioration, au barème qui l'a facturée.
      const repaired = advancements.map((adv, index) => ({
        ...adv,
        pspCost: advancementPspCost(adv, index, fallback),
        fundedBy: adv.fundedBy ?? ('pool' as const),
      }));

      // SPP fantômes : l'écart entre ce que le build a crédité (le coût
      // réel) et ce qu'il a débité (le barème standard, via `pspCost`
      // absent). On ne reprend que ce qui reste effectivement sur le
      // joueur, et jamais au-delà de 0.
      const residue = repaired.reduce((sum, adv, index) => {
        if (!isBuildFunded(adv)) return sum;
        const charged = advancementPspCost(
          { type: adv.type },
          index,
        );
        return sum + Math.max(0, adv.pspCost - charged);
      }, 0);
      const reclaim = Math.min(player.spp, Math.max(0, residue));

      serverLog.info(
        `[repair-build-psp] ${team.name} / ${player.name} : ` +
          `${advancements.length} amelioration(s) figee(s), ` +
          `${reclaim} SPP fantome(s) repris (solde ${player.spp} -> ${player.spp - reclaim})`,
      );

      if (apply) {
        await prisma.teamPlayer.update({
          where: { id: player.id },
          data: {
            advancements: JSON.stringify(repaired),
            ...(reclaim > 0 ? { spp: { decrement: reclaim } } : {}),
          },
        });
      }
      repairedPlayers += 1;
      sppReclaimed += reclaim;
      touchedTeam = true;
    }

    if (touchedTeam) repairedTeams += 1;
  }

  return {
    scannedTeams: teams.length,
    repairedTeams,
    repairedPlayers,
    sppReclaimed,
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const r = await repairBuildAdvancementPsp(apply);
  serverLog.info(
    `[repair-build-psp] ${apply ? 'APPLIQUE' : 'SIMULATION'} — ` +
      `${r.scannedTeams} equipe(s) scannee(s), ${r.repairedTeams} a reparer, ` +
      `${r.repairedPlayers} joueur(s), ${r.sppReclaimed} SPP fantome(s)`,
  );
}

// Exécution directe uniquement (le module reste importable par les tests).
if (process.argv[1]?.includes('repair-build-advancement-psp')) {
  main()
    .catch((e: unknown) => {
      serverLog.error('[repair-build-psp] echec', e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
