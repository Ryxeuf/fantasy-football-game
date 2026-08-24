/**
 * Rattrapage : crédite aux équipes existantes le reliquat de leur budget
 * de construction.
 *
 * Jusqu'au correctif « Résumé du budget », les deux flux de création
 * (`POST /team/build` et `POST /team/create-from-roster`) écrivaient
 * `treasury: 0` : l'or non dépensé à la construction était perdu. La fiche
 * d'équipe affichait donc un « Budget restant » (recalculé côté web) face à
 * une trésorerie à 0.
 *
 * Ce script ne touche QUE les équipes manifestement concernées :
 *  - `treasury = 0` (une trésorerie non nulle a déjà vécu, on n'y touche pas) ;
 *  - aucun match joué (ni `LocalMatch`, ni feuille de match de ligue) —
 *    au-delà, la trésorerie a une histoire (gains, achats) que ce calcul
 *    « budget − dépenses » ne saurait reconstituer ;
 *  - reliquat strictement positif.
 *
 * Usage :
 *   pnpm --filter server db:backfill-treasury          # simulation
 *   pnpm --filter server db:backfill-treasury -- --apply
 */

import { prisma } from '../prisma';
import { buildTeamBudgetSummary } from '../services/team-budget-summary';
import { serverLog } from '../utils/server-log';

async function hasPlayed(teamId: string): Promise<boolean> {
  const [localMatches, sheets] = await Promise.all([
    prisma.localMatch.count({
      where: { OR: [{ teamAId: teamId }, { teamBId: teamId }] },
    }),
    prisma.leagueParticipant.count({ where: { teamId } }),
  ]);
  return localMatches > 0 || sheets > 0;
}

export async function backfillTeamTreasury(apply: boolean): Promise<{
  scanned: number;
  updated: number;
  skipped: number;
}> {
  const teams = await prisma.team.findMany({
    where: { treasury: 0, deletedAt: null },
    include: { players: true, starPlayers: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const team of teams) {
    if (await hasPlayed(team.id)) {
      skipped += 1;
      continue;
    }
    const summary = await buildTeamBudgetSummary(
      prisma,
      team,
      team.players,
      team.starPlayers,
    );
    const treasury = Math.max(0, summary.remaining);
    if (treasury === 0) {
      skipped += 1;
      continue;
    }
    serverLog.info(
      `[backfill-treasury] ${team.name} (${team.id}) : +${treasury} po`,
    );
    if (apply) {
      await prisma.team.update({ where: { id: team.id }, data: { treasury } });
    }
    updated += 1;
  }

  return { scanned: teams.length, updated, skipped };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const result = await backfillTeamTreasury(apply);
  serverLog.info(
    `[backfill-treasury] ${apply ? 'APPLIQUE' : 'SIMULATION'} — ` +
      `${result.scanned} equipes scannees, ${result.updated} a crediter, ` +
      `${result.skipped} ignorees`,
  );
}

// Exécution directe uniquement (le module reste importable par les tests).
if (process.argv[1]?.includes('backfill-team-treasury')) {
  main()
    .catch((e: unknown) => {
      serverLog.error('[backfill-treasury] echec', e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
