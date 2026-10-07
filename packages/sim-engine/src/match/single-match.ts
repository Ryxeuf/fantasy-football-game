/**
 * `pnpm sim:match` — UN match, lisible de bout en bout.
 *
 * Les autres outils agrègent (bench, perf, comparaison) ou tournent en
 * hybrid (`sim:replay`). Celui-ci joue un seul match — en full driver par
 * défaut, sur les rosters du catalogue — et le rend sous la forme voulue :
 * résumé, feuille de match papier (celle de `?format=sheet` côté admin),
 * narration, ou JSON compatible avec `sim:diff-replays`.
 *
 * Module pur : la résolution des arguments, la simulation et le rendu sont
 * testables sans passer par le script.
 */

import { buildSimInputForDriver } from '../driver/engine-roster-fixture';
import { replayJournal } from '../replay/journal';
import { renderMatchSheet } from '../replay/match-sheet';
import { narrateMatch } from '../replay/narrator';
import { simulateMatch, type SimulateDriverKind } from '../simulate-match';
import {
  PRO_LEAGUE_TEAMS,
  PRO_LEAGUE_TEAM_BY_ID,
  type ProTeamProfile,
} from '../tactics/race-profiles';
import type { SimInput, SimResult } from '../types';

export const DEFAULT_MATCH_HOME = 'pit-smashers';
export const DEFAULT_MATCH_AWAY = 'kc-soaring-hawks';
export const DEFAULT_MATCH_SEED = 42;

export class SingleMatchArgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SingleMatchArgError';
  }
}

/** Arguments bruts, tels que `parseArgs` les rend (tout en chaîne). */
export interface SingleMatchArgs {
  readonly teamA?: string;
  readonly teamB?: string;
  readonly seed?: string;
  readonly driver?: string;
}

export interface SingleMatchRequest {
  readonly home: ProTeamProfile;
  readonly away: ProTeamProfile;
  readonly seed: number;
  readonly driverKind: SimulateDriverKind;
}

export interface SingleMatchRun {
  readonly request: SingleMatchRequest;
  readonly input: SimInput;
  readonly result: SimResult;
  readonly durationMs: number;
}

function resolveTeam(id: string, flag: string): ProTeamProfile {
  const team = PRO_LEAGUE_TEAM_BY_ID[id];
  if (!team) {
    const known = PRO_LEAGUE_TEAMS.map((t) => t.id).join(', ');
    throw new SingleMatchArgError(`${flag} inconnu : '${id}' (connus : ${known})`);
  }
  return team;
}

/** Valide les arguments et applique les défauts (full driver, graine 42). */
export function resolveSingleMatchRequest(args: SingleMatchArgs): SingleMatchRequest {
  const home = resolveTeam(args.teamA ?? DEFAULT_MATCH_HOME, '--teamA');
  const away = resolveTeam(args.teamB ?? DEFAULT_MATCH_AWAY, '--teamB');
  if (home.id === away.id) {
    throw new SingleMatchArgError('--teamA et --teamB doivent être deux équipes distinctes');
  }
  const seedRaw = args.seed ?? String(DEFAULT_MATCH_SEED);
  const seed = Number(seedRaw);
  if (!/^\d+$/.test(seedRaw) || !Number.isSafeInteger(seed)) {
    throw new SingleMatchArgError(`--seed doit être un entier positif (reçu '${seedRaw}')`);
  }
  const driver = args.driver ?? 'full';
  if (driver !== 'full' && driver !== 'hybrid') {
    throw new SingleMatchArgError(`--driver doit valoir 'full' ou 'hybrid' (reçu '${driver}')`);
  }
  return { home, away, seed, driverKind: driver };
}

export function runSingleMatch(
  request: SingleMatchRequest,
  now: () => number = () => performance.now(),
): SingleMatchRun {
  const input = buildSimInputForDriver(request.home, request.away, request.seed, request.driverKind);
  const start = now();
  const result = simulateMatch(input, { driverKind: request.driverKind });
  return { request, input, result, durationMs: now() - start };
}

function teamTitle(team: ProTeamProfile): string {
  return `${team.city} ${team.name} (${team.race})`;
}

export function formatSingleMatchSummary(run: SingleMatchRun): string {
  const { request, input, result } = run;
  const { summary } = result;
  const players = (input.home.roster?.length ?? 0) + (input.away.roster?.length ?? 0);
  const lines = [
    `${teamTitle(request.home)} vs ${teamTitle(request.away)}`,
    `Graine ${request.seed} · driver ${request.driverKind} · moteur ${result.engineVer} · ${Math.round(run.durationMs)} ms`,
    `Score ${summary.score.home}-${summary.score.away} (${summary.outcome}) · TD ${summary.touchdownCount} · sorties ${result.casualties.length} · turnovers ${summary.turnoverCount}`,
    `${result.events.length} évènements` +
      (result.journal ? ` · ${result.journal.steps.length} coups au journal` : '') +
      (players > 0 ? ` · rosters de ${players} joueurs` : ' · sans roster'),
  ];
  return lines.join('\n');
}

/**
 * Feuille de match papier, re-dérivée du JOURNAL comme le fait le serveur
 * (`?format=sheet`) : c'est aussi une vérification que le journal se rejoue.
 */
export function formatSingleMatchSheet(run: SingleMatchRun): string {
  const { journal } = run.result;
  if (!journal) {
    throw new SingleMatchArgError(
      'La feuille de match exige le full driver (le driver hybrid ne produit pas de journal)',
    );
  }
  const { states } = replayJournal(journal);
  return renderMatchSheet(journal, states, {
    homeName: run.request.home.name,
    awayName: run.request.away.name,
  });
}

export function formatSingleMatchNarration(run: SingleMatchRun): string {
  return narrateMatch(run.result, {
    title: `${run.request.home.name} vs ${run.request.away.name}`,
    rosters: { home: run.input.home.roster, away: run.input.away.roster },
  });
}

/**
 * JSON du résultat SANS `fullReplay` (les snapshots pèsent ~2 Mo et se
 * re-dérivent du journal). `events` reste au premier niveau : la sortie se
 * passe telle quelle à `sim:diff-replays`.
 */
export function formatSingleMatchJson(run: SingleMatchRun): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fullReplay, ...rest } = run.result;
  return JSON.stringify(
    {
      seed: run.request.seed,
      driverKind: run.request.driverKind,
      homeId: run.request.home.id,
      awayId: run.request.away.id,
      ...rest,
    },
    null,
    2,
  );
}
