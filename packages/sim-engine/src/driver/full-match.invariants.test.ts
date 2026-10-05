/**
 * Lot 1 « match complet » — invariants STRUCTURELS d'un match du full
 * driver, rejoués sur de vrais rosters de 13 joueurs (22 sur le terrain).
 *
 * Ce test ne juge pas la qualité tactique (lot 3) : il garantit qu'un match
 * est un match de Blood Bowl complet. Nombre de graines : 20 par défaut
 * (`FULL_MATCH_SEEDS=100` pour la matrice complète, ~2 min).
 */

import { describe, expect, it } from 'vitest';

import { simulateMatch } from '../simulate-match';
import { PRO_LEAGUE_TEAM_BY_ID } from '../tactics/race-profiles';
import type { SimInput } from '../types';

import { buildEngineRoster } from './engine-roster-fixture';

const SEEDS = Number.parseInt(process.env.FULL_MATCH_SEEDS ?? '20', 10);

const PAIRINGS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['pit-smashers', 'orc', 'kc-soaring-hawks', 'wood_elf'],
  ['sf-gold-rush', 'skaven', 'chi-iron-bears', 'dwarf'],
];

function buildInput(seed: number, pairing: (typeof PAIRINGS)[number]): SimInput {
  const [homeId, homeSlug, awayId, awaySlug] = pairing;
  const home = PRO_LEAGUE_TEAM_BY_ID[homeId];
  const away = PRO_LEAGUE_TEAM_BY_ID[awayId];
  if (!home || !away) throw new Error(`pairing inconnu ${homeId} vs ${awayId}`);
  return {
    seed,
    home: {
      id: home.id,
      name: home.name,
      side: 'home',
      tactics: home.tactics,
      tv: home.tv,
      roster: buildEngineRoster('home', homeSlug),
    },
    away: {
      id: away.id,
      name: away.name,
      side: 'away',
      tactics: away.tactics,
      tv: away.tv,
      roster: buildEngineRoster('away', awaySlug),
    },
  };
}

interface MatchFacts {
  readonly seed: number;
  readonly pairing: string;
  /** Tours d'équipe réellement joués, par mi-temps et par équipe. */
  readonly teamTurns: Record<'1' | '2', Record<'A' | 'B', number>>;
  readonly tdCount: number;
  readonly kickoffCount: number;
  readonly emptyPitchStates: number;
  readonly pendingAtEndTurn: number;
  readonly blocks: number;
  readonly blocksLeftPending: number;
  readonly knockdowns: number;
  readonly standUps: number;
  readonly doubleActivations: number;
  readonly interleavedActivations: number;
  readonly moves: number;
}

function collectFacts(seed: number, pairing: (typeof PAIRINGS)[number]): MatchFacts {
  const result = simulateMatch(buildInput(seed, pairing), { driverKind: 'full' });
  const fr = result.fullReplay;
  if (!fr) throw new Error('fullReplay absent');

  const teamTurns = { '1': { A: 0, B: 0 }, '2': { A: 0, B: 0 } };
  const tdCount = result.events.filter((e) => e.type === 'TD').length;
  const kickoffCount = result.events.filter((e) => e.type === 'KICKOFF').length;

  let emptyPitchStates = 0;
  let pendingAtEndTurn = 0;
  let blocks = 0;
  let blocksLeftPending = 0;
  let knockdowns = 0;
  let standUps = 0;
  let doubleActivations = 0;
  let interleavedActivations = 0;

  let prev = fr.initialState;
  let activatedThisTurn = new Set<string>();
  let openActivation: string | null = null;
  for (let i = 0; i < fr.moves.length; i++) {
    const move = fr.moves[i];
    const state = fr.states[i];

    // Un terrain vide n'est toléré que l'instant de la remise en jeu : le
    // snapshot suivant doit déjà montrer les équipes replacées.
    const onPitch = state.players.filter((p) => p.pos.x >= 0).length;
    if (state.gamePhase === 'playing' && onPitch === 0) {
      const next = fr.states[i + 1];
      const nextOnPitch = next ? next.players.filter((p) => p.pos.x >= 0).length : 22;
      if (nextOnPitch === 0) emptyPitchStates += 1;
    }

    if (move.type === 'END_TURN') {
      const prevPhase = (prev as { preMatch?: { phase?: string } }).preMatch?.phase;
      if (prev.gamePhase === 'playing' && !prev.kickoffBlitzTurn && prevPhase !== 'setup') {
        const half = prev.half === 1 ? '1' : '2';
        teamTurns[half][prev.currentPlayer] += 1;
      }
      if (
        prev.pendingBlock ||
        prev.pendingPushChoice ||
        prev.pendingFollowUpChoice ||
        prev.pendingReroll ||
        prev.pendingApothecary
      ) {
        pendingAtEndTurn += 1;
      }
      activatedThisTurn = new Set();
      openActivation = null;
    } else if ('playerId' in move && typeof move.playerId === 'string') {
      const pid = move.playerId;
      const isChoice =
        move.type === 'BLOCK_CHOOSE' ||
        move.type === 'PUSH_CHOOSE' ||
        move.type === 'FOLLOW_UP_CHOOSE';
      if (!isChoice) {
        if (openActivation && openActivation !== pid) {
          // Un autre joueur agit alors que l'activation précédente est
          // encore ouverte (PM restants, action MOVE/BLITZ) ⇒ entremêlé.
          const prevPlayer = prev.players.find((p) => p.id === openActivation);
          const prevAction = prev.playerActions[openActivation];
          if (
            prevPlayer &&
            prevPlayer.pm > 0 &&
            (prevAction === 'MOVE' || prevAction === 'BLITZ')
          ) {
            interleavedActivations += 1;
          }
        }
        if (!activatedThisTurn.has(pid) && prev.playerActions[pid]) {
          // Déjà activé plus tôt dans le tour (action posée) et réactivé
          doubleActivations += 1;
        }
        activatedThisTurn.add(pid);
        openActivation = pid;
      }
    }

    if (move.type === 'BLOCK' || move.type === 'BLITZ') {
      blocks += 1;
      if (state.pendingBlock) {
        // Doit être résolu par le coup suivant
        const next = fr.moves[i + 1];
        if (!next || next.type !== 'BLOCK_CHOOSE') blocksLeftPending += 1;
      }
    }
    if (move.type === 'STAND_UP') standUps += 1;

    const prevById = new Map(prev.players.map((p) => [p.id, p] as const));
    for (const p of state.players) {
      const q = prevById.get(p.id);
      if (q && !q.stunned && p.stunned && p.pos.x >= 0) knockdowns += 1;
    }
    prev = state;
  }

  return {
    seed,
    pairing: `${pairing[0]} vs ${pairing[2]}`,
    teamTurns,
    tdCount,
    kickoffCount,
    emptyPitchStates,
    pendingAtEndTurn,
    blocks,
    blocksLeftPending,
    knockdowns,
    standUps,
    doubleActivations,
    interleavedActivations,
    moves: fr.moves.length,
  };
}

describe('full driver — invariants d’un match complet (lot 1)', () => {
  const facts: MatchFacts[] = [];
  for (const pairing of PAIRINGS) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      facts.push(collectFacts(seed, pairing));
    }
  }

  it('chaque équipe joue 8 tours par mi-temps (6 à 10 avec « Temps mort »)', () => {
    for (const f of facts) {
      for (const half of ['1', '2'] as const) {
        for (const team of ['A', 'B'] as const) {
          const n = f.teamTurns[half][team];
          expect(n, `${f.pairing} graine ${f.seed} mi-temps ${half} équipe ${team}`).toBeGreaterThanOrEqual(6);
          expect(n, `${f.pairing} graine ${f.seed} mi-temps ${half} équipe ${team}`).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it('chaque touchdown est suivi d’un coup d’envoi et le terrain n’est jamais vide en phase de jeu', () => {
    for (const f of facts) {
      // ouverture + mi-temps + un par TD — sauf un TD au dernier tour du
      // second joueur d'une mi-temps, qui clôt la mi-temps sans remise en
      // jeu (lot 3 : le compteur de rounds avance aussi après un TD).
      expect(f.kickoffCount, `${f.pairing} graine ${f.seed}`).toBeLessThanOrEqual(2 + f.tdCount);
      expect(f.kickoffCount, `${f.pairing} graine ${f.seed}`).toBeGreaterThanOrEqual(2 + f.tdCount - 2);
      expect(f.emptyPitchStates, `${f.pairing} graine ${f.seed}`).toBe(0);
    }
  });

  it('aucun choix en attente ne survit à un END_TURN et tout blocage est résolu', () => {
    for (const f of facts) {
      expect(f.pendingAtEndTurn, `${f.pairing} graine ${f.seed}`).toBe(0);
      expect(f.blocksLeftPending, `${f.pairing} graine ${f.seed}`).toBe(0);
    }
  });

  it('les joueurs à terre se relèvent pendant les drives', () => {
    const totalKnockdowns = facts.reduce((a, f) => a + f.knockdowns, 0);
    const totalStandUps = facts.reduce((a, f) => a + f.standUps, 0);
    expect(totalKnockdowns).toBeGreaterThan(0);
    expect(totalStandUps).toBeGreaterThan(totalKnockdowns * 0.3);
  });

  it('un joueur est activé au plus une fois par tour, en une séquence contiguë', () => {
    for (const f of facts) {
      expect(f.doubleActivations, `${f.pairing} graine ${f.seed}`).toBe(0);
      expect(f.interleavedActivations, `${f.pairing} graine ${f.seed}`).toBe(0);
    }
  });

  it('un match réel compte des touchdowns et reste borné', () => {
    const totalTd = facts.reduce((a, f) => a + f.tdCount, 0);
    expect(totalTd).toBeGreaterThan(0);
    for (const f of facts) {
      expect(f.moves, `${f.pairing} graine ${f.seed}`).toBeLessThan(3000);
    }
  });
});
