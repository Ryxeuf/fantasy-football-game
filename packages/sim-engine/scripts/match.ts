#!/usr/bin/env tsx
/**
 * `pnpm sim:match` — joue UN match et le rend lisible.
 *
 * Full driver par défaut, sur les rosters du catalogue (13 joueurs par
 * équipe) : c'est le match que le serveur simule en production.
 *
 * Usage examples
 * --------------
 *   pnpm sim:match                                     # résumé, Smashers vs Soaring Hawks, graine 42
 *   pnpm sim:match --sheet                             # + feuille de match papier (dés compris)
 *   pnpm sim:match --teamA=buf-snow-ogres --teamB=gb-cheese-halflings --seed=7 --narration
 *   pnpm sim:match --json > /tmp/a.json                # JSON pour sim:diff-replays
 *   pnpm sim:match --driver=hybrid                     # driver abstrait (pas de feuille)
 *   pnpm sim:match --teams                             # liste des équipes
 *
 * Options
 *   --teamA=<id>        Équipe à domicile (défaut pit-smashers)
 *   --teamB=<id>        Équipe à l'extérieur (défaut kc-soaring-hawks)
 *   --seed=<n>          Graine (défaut 42) — même graine ⇒ même match
 *   --driver=<kind>     full (défaut) | hybrid
 *   --sheet             Ajoute la feuille de match papier, re-dérivée du journal
 *   --narration         Ajoute la narration évènement par évènement
 *   --json              N'imprime QUE le JSON du résultat (events au premier niveau)
 *   --teams             Liste les équipes Pro League et quitte
 *   --help              Affiche cette aide
 */

import { parseArgs } from 'node:util';

import {
  SingleMatchArgError,
  formatSingleMatchJson,
  formatSingleMatchNarration,
  formatSingleMatchSheet,
  formatSingleMatchSummary,
  resolveSingleMatchRequest,
  runSingleMatch,
} from '../src/match/single-match';
import { PRO_LEAGUE_TEAMS } from '../src/tactics/race-profiles';

const HELP = `pnpm sim:match — joue un match et le rend lisible

Usage:
  pnpm sim:match [--teamA=<id>] [--teamB=<id>] [--seed=<n>] [--driver=full|hybrid] [--sheet] [--narration]
  pnpm sim:match [...] --json
  pnpm sim:match --teams
  pnpm sim:match --help

Options:
  --teamA=<id>      Équipe à domicile (défaut pit-smashers)
  --teamB=<id>      Équipe à l'extérieur (défaut kc-soaring-hawks)
  --seed=<n>        Graine (défaut 42)
  --driver=<kind>   full (défaut, vrais rosters) | hybrid
  --sheet           Feuille de match papier (full driver uniquement)
  --narration       Narration évènement par évènement
  --json            JSON seul (compatible sim:diff-replays)
  --teams           Liste les équipes et quitte
  --help            Affiche cette aide
`;

function main(argv: readonly string[]): number {
  let values: Record<string, string | boolean | undefined>;
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: {
        teamA: { type: 'string' },
        teamB: { type: 'string' },
        seed: { type: 'string' },
        driver: { type: 'string' },
        sheet: { type: 'boolean' },
        narration: { type: 'boolean' },
        json: { type: 'boolean' },
        teams: { type: 'boolean' },
        help: { type: 'boolean' },
      },
      strict: true,
    }));
  } catch (err: unknown) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n\n${HELP}`);
    return 2;
  }

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (values.teams) {
    for (const t of PRO_LEAGUE_TEAMS) {
      process.stdout.write(`${t.id.padEnd(24)} ${t.city} ${t.name} (${t.race})\n`);
    }
    return 0;
  }

  try {
    const request = resolveSingleMatchRequest({
      teamA: values.teamA as string | undefined,
      teamB: values.teamB as string | undefined,
      seed: values.seed as string | undefined,
      driver: values.driver as string | undefined,
    });
    if (values.sheet && request.driverKind !== 'full') {
      throw new SingleMatchArgError('--sheet exige le full driver (--driver=full)');
    }
    const run = runSingleMatch(request);

    if (values.json) {
      process.stdout.write(`${formatSingleMatchJson(run)}\n`);
      return 0;
    }
    const sections = [formatSingleMatchSummary(run)];
    if (values.sheet) sections.push(formatSingleMatchSheet(run));
    if (values.narration) sections.push(formatSingleMatchNarration(run));
    process.stdout.write(`${sections.join('\n\n')}\n`);
    return 0;
  } catch (err: unknown) {
    if (err instanceof SingleMatchArgError) {
      process.stderr.write(`${err.message}\n`);
      return 2;
    }
    throw err;
  }
}

process.exit(main(process.argv.slice(2)));
