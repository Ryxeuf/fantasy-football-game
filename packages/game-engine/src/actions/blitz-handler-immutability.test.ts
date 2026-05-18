/**
 * BUG fix : `handleBlitz` mutait directement `state.players[i].pos`,
 * `.pm`, `.stunned`, `.hasBall` via index. Comme `handlePlayerSwitch`
 * retourne `{...state, selectedPlayerId}`, `newState.players` est
 * la MÊME référence que `state.players` — chaque mutation polluait le
 * snapshot du caller (utilisé pour replay, history, undo).
 *
 * Ce test snapshote le state avant l'appel et vérifie que les
 * propriétés clé restent inchangées dans le snapshot original après
 * l'execution de handleBlitz, quel que soit le path traversé.
 */
import { describe, it, expect } from 'vitest';
import type { GameState, Player, RNG } from '../core/types';
import { handleBlitz } from './blitz-handler';

const rng: RNG = () => 0.5;

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'P',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    width: 26,
    height: 15,
    players: [],
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    apothecaryAvailable: { teamA: 1, teamB: 1 },
    dugouts: {
      teamA: { reserves: [], ko: [], casualties: [] },
      teamB: { reserves: [], ko: [], casualties: [] },
    },
    gamePhase: 'playing',
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: 'A', teamB: 'B' },
    teamRosters: { teamA: 'skaven', teamB: 'human' },
    pm: 0,
    gameLog: [],
    playerActions: {},
    teamBlitzCount: { A: 0, B: 0 },
    teamFoulCount: { A: 0, B: 0 },
    matchStats: {},
    ...overrides,
  } as unknown as GameState;
}

describe('handleBlitz — immutabilité du state d\'entree', () => {
  it("ne mute pas state.players[i].pos lors d'un blitz reussi sans dodge", () => {
    const attacker = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, pm: 6 });
    const target = makePlayer({ id: 'B1', team: 'B', pos: { x: 7, y: 5 }, pm: 6 });
    const state = makeState({ players: [attacker, target] });
    const beforePos = { ...attacker.pos };
    const beforePm = attacker.pm;

    const next = handleBlitz(
      state,
      { type: 'BLITZ', playerId: 'A1', to: { x: 6, y: 5 }, targetId: 'B1' },
      rng,
    );

    // Le state d'entree ne doit JAMAIS etre mute (immutabilite stricte).
    expect(state.players[0].pos).toEqual(beforePos);
    expect(state.players[0].pm).toBe(beforePm);
    // Le state retourne doit refleter le mouvement (si le blitz a ete legal).
    // Si le blitz est illegal, next === state apres handlePlayerSwitch — on
    // verifie juste qu'on n'a pas casse le snapshot.
    expect(next).toBeDefined();
  });

  it("ne mute pas state.players quand le blitz est legal et le mouvement applique", () => {
    // Configuration ou le blitz est legal : attacker adjacent a target apres
    // mouvement, attaquant peut se deplacer.
    const attacker = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, pm: 6 });
    const target = makePlayer({ id: 'B1', team: 'B', pos: { x: 7, y: 5 }, pm: 6 });
    const state = makeState({
      players: [attacker, target],
      currentPlayer: 'A',
      teamBlitzCount: { A: 0, B: 0 },
    });
    // Capture profonde des champs muables.
    const snapshotPlayer = JSON.parse(JSON.stringify(state.players[0]));

    handleBlitz(
      state,
      { type: 'BLITZ', playerId: 'A1', to: { x: 6, y: 5 }, targetId: 'B1' },
      rng,
    );

    // Apres l'appel : le state d'entree doit etre intact.
    expect(JSON.parse(JSON.stringify(state.players[0]))).toEqual(snapshotPlayer);
  });
});
