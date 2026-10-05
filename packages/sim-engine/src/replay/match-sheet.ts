/**
 * Lot 2 « journal rejouable » — FEUILLE DE MATCH papier (procès-verbal).
 *
 * Rend un journal rejouable en texte lisible sur un plateau physique : une
 * ligne par ACTIVATION (joueur, chemin case par case, action finale, dés),
 * groupée par mi-temps, tour et équipe, avec turnovers, touchdowns et
 * remises en jeu. Pur : prend le journal et les états re-dérivés
 * (`replayJournal`), n'accède ni à la base ni au réseau.
 *
 * Les coordonnées suivent le plateau 26×15 du moteur (x = 0..25 dans le
 * sens de la longueur, y = 0..14).
 */

import type { GameState, Move, Player } from '@bb/game-engine';

import type { DiceRecord, ReplayJournal } from './journal';

export interface MatchSheetOptions {
  readonly homeName?: string;
  readonly awayName?: string;
  /** Lignes d'en-tête supplémentaires (compétition, date…). */
  readonly header?: readonly string[];
}

const CHOICE_MOVES = new Set<Move['type']>([
  'BLOCK_CHOOSE',
  'PUSH_CHOOSE',
  'FOLLOW_UP_CHOOSE',
  'REROLL_CHOOSE',
  'APOTHECARY_CHOOSE',
  'DUMP_OFF_CHOOSE',
  'ON_THE_BALL_DECLINE',
  'ON_THE_BALL_MOVE',
]);

function pos(p: { x: number; y: number }): string {
  return `(${p.x},${p.y})`;
}

function label(player: Player | undefined, id: string): string {
  if (!player) return id;
  return `#${player.number} ${player.name}`;
}

function teamLabel(team: 'A' | 'B', options: MatchSheetOptions, state: GameState): string {
  if (team === 'A') return options.homeName ?? state.teamNames.teamA;
  return options.awayName ?? state.teamNames.teamB;
}

function diceText(dice: readonly DiceRecord[]): string {
  if (dice.length === 0) return '';
  return ` [${dice.map((d) => d.message).join(' ; ')}]`;
}

interface Activation {
  playerId: string;
  actor: Player | undefined;
  parts: string[];
  dice: DiceRecord[];
}

function describeMove(move: Move, prev: GameState): string | null {
  switch (move.type) {
    case 'STAND_UP':
      return 'se relève';
    case 'MOVE':
      return `→ ${pos(move.to)}`;
    case 'LEAP':
      return `saute → ${pos(move.to)}`;
    case 'BLOCK': {
      const t = prev.players.find((p) => p.id === move.targetId);
      return `bloque ${label(t, move.targetId)}`;
    }
    case 'BLITZ': {
      const t = prev.players.find((p) => p.id === move.targetId);
      return `blitz → ${pos(move.to)} sur ${label(t, move.targetId)}`;
    }
    case 'PASS': {
      const t = prev.players.find((p) => p.id === move.targetId);
      return `passe vers ${label(t, move.targetId)}`;
    }
    case 'HANDOFF': {
      const t = prev.players.find((p) => p.id === move.targetId);
      return `remet à ${label(t, move.targetId)}`;
    }
    case 'FOUL': {
      const t = prev.players.find((p) => p.id === move.targetId);
      return `agresse ${label(t, move.targetId)}`;
    }
    case 'BLOCK_CHOOSE':
      return `dé retenu : ${move.result}`;
    case 'PUSH_CHOOSE':
      return `poussée (${move.direction.x > 0 ? '+' : ''}${move.direction.x},${move.direction.y > 0 ? '+' : ''}${move.direction.y})`;
    case 'FOLLOW_UP_CHOOSE':
      return move.followUp ? 'suit' : 'ne suit pas';
    case 'REROLL_CHOOSE':
      return move.useReroll ? 'relance d’équipe' : 'pas de relance';
    case 'APOTHECARY_CHOOSE':
      return move.useApothecary ? 'apothicaire' : 'pas d’apothicaire';
    case 'DUMP_OFF_CHOOSE':
      return move.receiverId ? 'remise en touche' : 'pas de remise';
    case 'END_PLAYER_TURN':
      return null;
    default:
      return move.type.toLowerCase().replace(/_/g, ' ');
  }
}

/**
 * Rend la feuille de match. `states` doit être `replayJournal(journal).states`
 * (ou `fullReplay.states` du même match).
 */
export function renderMatchSheet(
  journal: ReplayJournal,
  states: readonly GameState[],
  options: MatchSheetOptions = {},
): string {
  const lines: string[] = [];
  const initial = journal.initialState;
  lines.push(
    `FEUILLE DE MATCH — ${teamLabel('A', options, initial)} (domicile) vs ${teamLabel('B', options, initial)} (extérieur)`,
  );
  lines.push(`Graine ${journal.seed} · ${journal.steps.length} coups · plateau 26×15, x vers l’en-but adverse de l’équipe à domicile`);
  for (const h of options.header ?? []) lines.push(h);
  lines.push('');
  lines.push(
    `Coup d’envoi : ${teamLabel(initial.kickingTeam ?? 'B', options, initial)} engage, ${teamLabel(initial.currentPlayer, options, initial)} reçoit`,
  );
  lines.push(
    `Mise en place : ${initial.players
      .filter((p) => p.pos.x >= 0)
      .map((p) => `${p.team}${label(p, p.id)} ${pos(p.pos)}`)
      .join(' · ')}`,
  );

  let prev: GameState = initial;
  let turnKey = '';
  let current: Activation | null = null;

  const flush = (): void => {
    if (!current) return;
    const parts = current.parts.length > 0 ? current.parts.join(' · ') : 'reste en place';
    lines.push(`  ${label(current.actor, current.playerId)} : ${parts}${diceText(current.dice)}`);
    current = null;
  };

  journal.steps.forEach((step, i) => {
    const next = states[i];
    if (!next) return;
    const key = `${prev.half}:${prev.turn}:${prev.currentPlayer}`;
    if (!step.drive && step.move.type !== 'END_TURN' && key !== turnKey) {
      flush();
      turnKey = key;
      lines.push('');
      lines.push(`Mi-temps ${prev.half} — Tour ${prev.turn} — ${teamLabel(prev.currentPlayer, options, prev)}`);
    }

    if (step.drive) {
      flush();
      lines.push(
        `Remise en jeu : ${teamLabel(next.kickingTeam ?? 'B', options, next)} engage, ${teamLabel(next.currentPlayer, options, next)} reçoit${diceText(step.dice)}`,
      );
      turnKey = '';
    } else if (step.move.type === 'END_TURN') {
      flush();
      if (prev.isTurnover) lines.push('  TURNOVER');
      if (step.dice.length > 0) lines.push(`  fin de tour${diceText(step.dice)}`);
      if (next.gamePhase === 'halftime' || (next.half !== prev.half && prev.half === 1)) {
        lines.push('');
        lines.push(`MI-TEMPS — ${prev.score.teamA} - ${prev.score.teamB}`);
      }
    } else {
      const playerId = 'playerId' in step.move ? step.move.playerId : undefined;
      const isChoice = CHOICE_MOVES.has(step.move.type);
      if (playerId && !isChoice && (!current || current.playerId !== playerId)) {
        flush();
        current = {
          playerId,
          actor: prev.players.find((p) => p.id === playerId),
          parts: [],
          dice: [],
        };
      }
      const text = describeMove(step.move, prev);
      if (current) {
        if (text) current.parts.push(text);
        current.dice.push(...step.dice);
      } else if (text) {
        lines.push(`  ${text}${diceText(step.dice)}`);
      }
    }

    const scoreBefore = prev.score.teamA + prev.score.teamB;
    const scoreAfter = next.score.teamA + next.score.teamB;
    if (scoreAfter > scoreBefore) {
      flush();
      const scorer = next.score.teamA > prev.score.teamA ? 'A' : 'B';
      lines.push(
        `  TOUCHDOWN ${teamLabel(scorer, options, next)} — ${next.score.teamA} - ${next.score.teamB}`,
      );
    }
    prev = next;
  });
  flush();

  const final = states[states.length - 1] ?? initial;
  lines.push('');
  lines.push(
    `SCORE FINAL : ${teamLabel('A', options, final)} ${final.score.teamA} - ${final.score.teamB} ${teamLabel('B', options, final)}`,
  );
  return lines.join('\n');
}
