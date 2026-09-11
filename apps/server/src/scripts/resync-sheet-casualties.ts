/**
 * Rattrapage : sorties des feuilles de match déjà VALIDÉES.
 *
 * Depuis que « sortie » veut dire « élimination qui rapporte des PSP »
 * (`eliminationEarnsSpp`), les feuilles validées sous l'ancienne règle
 * portent des compteurs persistés faux : une agression qui blessait comptait
 * comme sortie au classement (Sor+/Sor-), créditait 2 PSP et une sortie de
 * carrière à son auteur, et pouvait déclencher un bonus « sorties
 * infligées ». La feuille, relue avec la règle courante, dit autre chose.
 *
 * `prisma/migrations/` est gitignoré (prod = `db push`) : aucun backfill de
 * migration n'est possible ici. Ce script rejoue, feuille par feuille, la
 * resynchronisation (`resyncValidatedSheetCasualties`) — deltas seulement,
 * idempotent, journalisé dans le journal d'équipe.
 *
 * Usage :
 *   pnpm --filter @bb/server db:resync-sheet-casualties                # simulation
 *   pnpm --filter @bb/server db:resync-sheet-casualties -- --apply     # application
 *   pnpm --filter @bb/server db:resync-sheet-casualties -- --pairing <id> [--apply]
 */

import { prisma } from '../prisma';
import {
  resyncValidatedSheetCasualties,
  type CasualtyResyncOutcome,
} from '../services/league-sheet-casualty-resync';
import { runAsAuditJob } from '../utils/audit-context';
import { serverLog } from '../utils/server-log';

export interface ResyncRunReport {
  readonly scanned: number;
  /** Feuilles dont au moins un compteur diverge. */
  readonly changed: number;
  /** Feuilles effectivement réécrites (0 en simulation). */
  readonly applied: number;
  readonly skipped: Array<{ pairingId: string; reason: string }>;
  readonly changes: Array<{ pairingId: string; outcome: CasualtyResyncOutcome }>;
}

/** Ligne lisible d'un plan, pour le journal du script. */
function describe(pairingId: string, outcome: CasualtyResyncOutcome): string {
  if (outcome.skipped) return `${pairingId}: ignorée (${outcome.reason})`;
  const { plan } = outcome;
  const cas =
    `sorties ${plan.casualties.before.home}/${plan.casualties.before.away}` +
    ` -> ${plan.casualties.after.home}/${plan.casualties.after.away}`;
  const players = plan.players
    .map(
      (p) =>
        `${p.teamPlayerId} (${p.side}) ${p.before}->${p.after}` +
        ` PSP ${p.sppDelta >= 0 ? '+' : ''}${p.sppDelta}`,
    )
    .join(', ');
  const bonus = plan.bonus
    ? ` ; bonus ${plan.bonus.before.home}/${plan.bonus.before.away}` +
      ` -> ${plan.bonus.after.home}/${plan.bonus.after.away}`
    : '';
  return `${pairingId}: ${cas}${players ? ` ; ${players}` : ''}${bonus}`;
}

/**
 * Parcourt les feuilles validées de ligue (ou UNE rencontre) et
 * resynchronise leurs sorties. `apply=false` : simulation.
 */
export async function resyncValidatedSheets(input: {
  apply: boolean;
  pairingId?: string;
}): Promise<ResyncRunReport> {
  const sheets = (await prisma.leagueMatchSheet.findMany({
    where: {
      status: 'validated',
      pairingId: input.pairingId ? input.pairingId : { not: null },
    },
    select: { pairingId: true },
    orderBy: { validatedAt: 'asc' },
  })) as Array<{ pairingId: string | null }>;

  const report: ResyncRunReport = {
    scanned: 0,
    changed: 0,
    applied: 0,
    skipped: [],
    changes: [],
  };
  let scanned = 0;
  let changed = 0;
  let applied = 0;
  for (const sheet of sheets) {
    if (!sheet.pairingId) continue;
    scanned += 1;
    const outcome = await resyncValidatedSheetCasualties(sheet.pairingId, {
      apply: input.apply,
    });
    if (outcome.skipped) {
      report.skipped.push({ pairingId: sheet.pairingId, reason: outcome.reason });
      continue;
    }
    if (!outcome.plan.changed) continue;
    changed += 1;
    if (outcome.applied) applied += 1;
    report.changes.push({ pairingId: sheet.pairingId, outcome });
    serverLog.info(
      `[resync-sheet-casualties] ${describe(sheet.pairingId, outcome)}`,
    );
  }
  return { ...report, scanned, changed, applied };
}

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const pairingId = readArg('--pairing');
  const r = await runAsAuditJob('league.sheet.casualties.resync', () =>
    resyncValidatedSheets({ apply, pairingId }),
  );
  for (const s of r.skipped) {
    serverLog.info(`[resync-sheet-casualties] ${s.pairingId}: ignorée (${s.reason})`);
  }
  serverLog.info(
    `[resync-sheet-casualties] ${apply ? 'APPLIQUE' : 'SIMULATION'} — ` +
      `${r.scanned} feuille(s) validée(s), ${r.changed} à resynchroniser, ` +
      `${r.applied} réécrite(s), ${r.skipped.length} ignorée(s)`,
  );
}

// Exécution directe uniquement (le module reste importable par les tests).
if (process.argv[1]?.includes('resync-sheet-casualties')) {
  main()
    .catch((e: unknown) => {
      serverLog.error('[resync-sheet-casualties] echec', e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
