/**
 * Replay narrator — sprint Pro League 0.E.2.
 *
 * Convertit la timeline d'un `SimResult` en texte narratif lisible
 * pour le panel humain BB experts (lot 0.E.3) : grille de notation
 * "lisibilite tactique, coherence drives, identite raciale, moments
 * memorables". Le narrateur n'invente rien — il reformate les events
 * 0.A.3 dans une langue accessible aux coachs FUMBBL/NAF.
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

function renderKickoff(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const home = n(meta.home);
  const away = n(meta.away);
  const weather = n(meta.weather, 'nice');
  const receiver = n(meta.receivingTeam, 'home');
  return `KICKOFF — ${home} hosts ${away} (weather: ${weather}, ${receiver} receives).`;
}

function renderTurnStart(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const score = (meta.score as { home: number; away: number } | undefined) ?? {
    home: 0,
    away: 0,
  };
  return `Half ${n(meta.half)} • Turn ${n(meta.turn)} — ${n(meta.drivingTeam)} in possession at yardline ${n(meta.ballYardline)} (score ${score.home}-${score.away})`;
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
  return `  BLOCK — ${n(meta.attackerId)} blocks ${n(meta.defenderId)}: dice [${dice}], chose ${chosen}, ${resolution}.`;
}

function renderDodge(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const success = meta.success === true;
  const target = n(meta.target);
  const roll = n(meta.roll);
  const reroll = meta.usedReroll === true ? ' (rerolled)' : '';
  return `  DODGE — ${n(meta.playerId)} dodges to ${formatPos(meta.to)}${reroll}: needs ${target}+, rolled ${roll} → ${success ? 'success' : 'fail'}.`;
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

function renderTurnover(ev: MatchEvent): string {
  const meta = getMeta(ev);
  const cause = n(meta.cause, 'unknown');
  return `  TURNOVER — ${cause}.`;
}

function renderKO(ev: MatchEvent): string {
  const meta = getMeta(ev);
  return `  KO — ${n(meta.playerId)} is knocked unconscious${meta.causedBy ? ` by ${n(meta.causedBy)}` : ''}.`;
}

function renderCasualty(ev: MatchEvent): string {
  const meta = getMeta(ev);
  return `  CASUALTY — ${n(meta.playerId)} is taken off${meta.causedBy ? ` by ${n(meta.causedBy)}` : ''}.`;
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

function renderEvent(ev: MatchEvent): string {
  switch (ev.type) {
    case 'KICKOFF':
      return renderKickoff(ev);
    case 'TURN_START':
      return renderTurnStart(ev);
    case 'BLOCK':
      return renderBlock(ev);
    case 'DODGE':
      return renderDodge(ev);
    case 'PASS':
      return renderPass(ev);
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

export function narrateMatch(result: SimResult, options: NarrateOptions = {}): string {
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
  for (const ev of result.events) {
    lines.push(renderEvent(ev));
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
