/**
 * Replay narrator — sprint Pro League 0.E.2 (enrichi 1.F follow-up).
 *
 * Convertit la timeline d'un `SimResult` en texte narratif lisible
 * pour le panel humain BB experts (lot 0.E.3) : grille de notation
 * "lisibilite tactique, coherence drives, identite raciale, moments
 * memorables". Le narrateur n'invente rien — il reformate les events
 * 0.A.3 dans une langue accessible aux coachs FUMBBL/NAF.
 *
 * Enrichissement (post-merge Phase 1) :
 *  - Prefixe `[T+MM:SS]` sur chaque event via `displayAtMs`.
 *  - Delta de yardline entre TURN_STARTs successifs ("+7 yds").
 *  - Annotations skills sur BLOCK (wrestle) et DODGE (tackle suppress).
 *  - Detail armor/injury (rolls 2d6) sur KO et CASUALTY.
 *  - Score live affiche apres chaque TD.
 *
 * Pure function : aucune I/O. Le CLI `pnpm sim:replay` (script
 * `scripts/replay.ts`) appelle ce narrateur avec les SimResults
 * issus de `runBench`/`simulateMatch`.
 */

import type { MatchEvent } from '@bb/shared-types';

import type { SimResult } from '../types';

export interface NarrateOptions {
  /** Override the default `=== Home vs Away ===` header. */
  title?: string;
  /** Hide the FINAL score footer (useful when concatenating). */
  hideFooter?: boolean;
  /** Hide the `[T+MM:SS]` timestamp prefix (default: shown). */
  hideTimestamps?: boolean;
}

interface MetaShape {
  [key: string]: unknown;
}

function getMeta(ev: MatchEvent): MetaShape {
  return (ev.meta ?? {}) as MetaShape;
}

function n(value: unknown, fallback = '?'): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

/** Format displayAtMs as `[T+MM:SS]`. */
function formatTimestamp(displayAtMs: number): string {
  const total = Math.max(0, Math.floor(displayAtMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `[T+${mm}:${ss}]`;
}

function renderKickoff(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const home = n(meta.home);
  const away = n(meta.away);
  const weather = n(meta.weather, 'nice');
  const receiver = n(meta.receivingTeam, 'home');
  return `KICKOFF — ${home} hosts ${away} (weather: ${weather}, ${receiver} receives).`;
}

interface TurnStartContext {
  prevYardline?: number;
  prevDrivingTeam?: string;
}

function renderTurnStart(ev: MatchEvent, ctx: TurnStartContext): string {
  const meta = getMeta(ev);
  const score = (meta.score as { home: number; away: number } | undefined) ?? {
    home: 0,
    away: 0,
  };
  const yardline = typeof meta.ballYardline === 'number' ? meta.ballYardline : null;
  const drivingTeam = n(meta.drivingTeam);

  let delta = '';
  if (
    yardline !== null &&
    ctx.prevYardline !== undefined &&
    ctx.prevDrivingTeam === drivingTeam
  ) {
    const d = yardline - ctx.prevYardline;
    if (d !== 0) {
      const sign = d > 0 ? '+' : '';
      delta = ` (drive ${sign}${d} yds)`;
    }
  }

  return `Half ${n(meta.half)} • Turn ${n(meta.turn)} — ${drivingTeam} in possession at yardline ${n(meta.ballYardline)} (score ${score.home}-${score.away})${delta}`;
}

function renderBlock(ev: MatchEvent): string {
  const meta = getMeta(ev);
  if (meta.kind === 'foul') {
    const armorTotal = n(meta.armorTotal);
    const armorBroken = meta.armorBroken === true;
    const sentOff = meta.sentOff === true;
    const injury = meta.injuryOutcome ? ` → ${n(meta.injuryOutcome)}` : '';
    return `  FOUL — ${n(meta.foulerId)} fouls ${n(meta.victimId)} (armor=${armorTotal}, broken=${armorBroken}${injury}${sentOff ? ', sent off!' : ''}).`;
  }
  const dice = (meta.rolls as string[] | undefined)?.join('/') ?? '?';
  const chosen = n(meta.chosen);
  const resolution = n(meta.resolution);
  const wrestle = meta.useWrestle === true ? ', wrestled' : '';
  return `  BLOCK — ${n(meta.attackerId)} blocks ${n(meta.defenderId)}: dice [${dice}], chose ${chosen}, ${resolution}${wrestle}.`;
}

function renderDodge(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const success = meta.success === true;
  const target = n(meta.target);
  const roll = n(meta.roll);
  const reroll = meta.usedReroll === true ? ' (rerolled)' : '';
  const tackleNote =
    meta.rerollSuppressedByTackle === true ? ' [tackle blocks reroll]' : '';
  return `  DODGE — ${n(meta.playerId)} dodges to ${formatPos(meta.to)}${reroll}${tackleNote}: needs ${target}+, rolled ${roll} → ${success ? 'success' : 'fail'}.`;
}

function renderPass(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const success = meta.success === true;
  const range = n(meta.range);
  const target = n(meta.target);
  const roll = n(meta.roll);
  const fumble = meta.fumble === true ? ' (fumble!)' : '';
  return `  PASS — ${n(meta.passerId)} attempts a ${range} pass: needs ${target}+, rolled ${roll}${fumble} → ${success ? 'caught' : 'failed'}.`;
}

function renderTd(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const team = n(meta.team);
  const score = (meta.scoreAfter as { home: number; away: number } | undefined) ?? {
    home: 0,
    away: 0,
  };
  return `  Touchdown! ${team} crosses the line. Score is now ${score.home}-${score.away}.`;
}

function renderMove(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const team = n(meta.team);
  const yards = typeof meta.yards === 'number' ? meta.yards : 0;
  const kind = String(meta.kind ?? 'run');
  const from = typeof meta.from === 'number' ? meta.from : null;
  const to = typeof meta.to === 'number' ? meta.to : null;
  const range = from !== null && to !== null ? ` (yardline ${from} → ${to})` : '';
  // Sprint Pro League #4 — narrative taglines per move kind.
  switch (kind) {
    case 'halt':
      return `  HALT — ${team} drive stalls : the defense holds the line${range}.`;
    case 'positioning':
      return `  POSITIONING — ${team} pushes the line forward, +${yards} yds${range}.`;
    case 'run':
      return `  RUN — ${team} ball carrier drives through the middle, +${yards} yds${range}.`;
    case 'sweep':
      return `  SWEEP — ${team} sweeps wide, +${yards} yds${range}.`;
    case 'breakaway':
      return `  BREAKAWAY — ${team} breaks open daylight, +${yards} yds${range}.`;
    case 'scoring_run':
      return `  SCORING RUN — ${team} sprints for the endzone, +${yards} yds${range}.`;
    default:
      return `  MOVE — ${team} +${yards} yds${range}.`;
  }
}

function renderTurnover(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const cause = n(meta.cause, 'unknown');
  return `  TURNOVER — ${cause}.`;
}

function renderKO(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const armor = typeof meta.armor === 'number' ? ` (armor=${meta.armor}` : '';
  const injury =
    typeof meta.injury === 'number' ? `, injury=${meta.injury})` : armor ? ')' : '';
  return `  KO — ${n(meta.playerId)} is knocked unconscious${meta.causedBy ? ` by ${n(meta.causedBy)}` : ''}${armor}${injury}.`;
}

function renderCasualty(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const armor = typeof meta.armor === 'number' ? ` (armor=${meta.armor}` : '';
  const injury =
    typeof meta.injury === 'number' ? `, injury=${meta.injury})` : armor ? ')' : '';
  return `  CASUALTY — ${n(meta.playerId)} is taken off${meta.causedBy ? ` by ${n(meta.causedBy)}` : ''}${armor}${injury}.`;
}

function renderNuffle(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const id = n(meta.id);
  const description = n(meta.description, 'a Nuffle event occurs');
  return `  ✨ NUFFLE [${id}] — ${description}`;
}

function renderHalftime(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const score = (meta.score as { home: number; away: number } | undefined) ?? {
    home: 0,
    away: 0,
  };
  return `\n--- HALFTIME (score ${score.home}-${score.away}) ---\n`;
}

function renderEnd(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const score = (meta.score as { home: number; away: number } | undefined) ?? {
    home: 0,
    away: 0,
  };
  return `\n--- END OF MATCH (score ${score.home}-${score.away}) ---\n`;
}

function formatPos(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'x' in value &&
    'y' in value
  ) {
    const v = value as { x: unknown; y: unknown };
    return `(${n(v.x)},${n(v.y)})`;
  }
  return '?';
}

function renderEvent(ev: MatchEvent, ctx: TurnStartContext): string {
  switch (ev.type) {
    case 'KICKOFF':
      return renderKickoff(ev);
    case 'TURN_START':
      return renderTurnStart(ev, ctx);
    case 'BLOCK':
      return renderBlock(ev);
    case 'DODGE':
      return renderDodge(ev);
    case 'PASS':
      return renderPass(ev);
    case 'MOVE':
      return renderMove(ev);
    case 'TD':
      return renderTd(ev);
    case 'TURNOVER':
      return renderTurnover(ev);
    case 'KO':
      return renderKO(ev);
    case 'CASUALTY':
      return renderCasualty(ev);
    case 'NUFFLE':
      return renderNuffle(ev);
    case 'HALFTIME':
      return renderHalftime(ev);
    case 'END':
      return renderEnd(ev);
    default:
      return `  ${ev.type}`;
  }
}

/** Apply optional `[T+MM:SS]` prefix. Skips on pure separator lines
 *  (HALFTIME / END which start with a blank line). */
function withTimestamp(
  line: string,
  ev: MatchEvent,
  showTimestamp: boolean,
): string {
  if (!showTimestamp) return line;
  if (line.startsWith('\n')) return line;
  const ts = formatTimestamp(ev.displayAtMs);
  // Indented event lines : `  BLOCK — ...` becomes `  [T+00:30] BLOCK — ...`.
  if (line.startsWith('  ')) {
    return `  ${ts} ${line.slice(2)}`;
  }
  // Non-indented (KICKOFF, TURN_START) : `[T+00:30] KICKOFF — ...`.
  return `${ts} ${line}`;
}

export function narrateMatch(result: SimResult, options: NarrateOptions = {}): string {
  const showTimestamps = options.hideTimestamps !== true;
  const lines: string[] = [];

  // Header — extract team names from the KICKOFF event meta when possible.
  // Prefer the display name (`homeName` / `awayName`) and fall back to
  // the slug ids when the meta is missing.
  const kickoff = result.events.find((e) => e.type === 'KICKOFF');
  const meta = kickoff ? getMeta(kickoff) : {};
  const homeName = String(meta.homeName ?? meta.home ?? 'home');
  const awayName = String(meta.awayName ?? meta.away ?? 'away');
  const title = options.title ?? `${homeName} vs ${awayName}`;
  lines.push(`=== ${title} ===`);
  lines.push(`engine ${result.engineVer}`);
  lines.push('');

  // Body : one line per event, grouped by turn (the TURN_START line is a
  // mini header ; subsequent events are indented inside it).
  const ctx: TurnStartContext = {};
  for (const ev of result.events) {
    const raw = renderEvent(ev, ctx);
    lines.push(withTimestamp(raw, ev, showTimestamps));
    if (ev.type === 'TURN_START') {
      const m = getMeta(ev);
      if (typeof m.ballYardline === 'number') {
        ctx.prevYardline = m.ballYardline;
      }
      if (typeof m.drivingTeam === 'string') {
        ctx.prevDrivingTeam = m.drivingTeam;
      }
    }
  }

  if (!options.hideFooter) {
    const s = result.summary;
    lines.push('');
    lines.push(`FINAL: ${s.score.home} - ${s.score.away} (${s.outcome})`);
    lines.push(
      `Touchdowns: ${s.touchdownCount} | Casualties: ${result.casualties.length} | Turnovers: ${s.turnoverCount} | Nuffle: ${s.nuffleCount}`
    );
    if (s.underdogBoostCount > 0) {
      lines.push(`Underdog boosts triggered: ${s.underdogBoostCount}`);
    }
  }

  return lines.join('\n');
}
