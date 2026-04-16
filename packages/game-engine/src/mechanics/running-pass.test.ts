import { describe, it, expect } from 'vitest';
import {
  hasRunningPass,
  hasRunningPassHandoffVariant,
  canApplyRunningPass,
  canApplyRunningPassToHandoff,
  hasUsedRunningPassThisTurn,
  markRunningPassUsed,
} from './running-pass';
import { setup, applyMove, canPlayerContinueMoving, getLegalMoves } from '../index';
import type { GameState, Player, Move, RNG } from '../core/types';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test Player',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 3,
    av: 9,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

function makeState(players: Player[]): GameState {
  const state = setup();
  state.players = players;
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamFoulCount = {};
  return state;
}

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

describe("Regle: Running Pass - detection du skill", () => {
  it("hasRunningPass retourne true pour la variante S2 'running-pass'", () => {
    const player = makePlayer({ skills: ['running-pass'] });
    expect(hasRunningPass(player)).toBe(true);
  });

  it("hasRunningPass retourne true pour la variante underscore 'running_pass'", () => {
    const player = makePlayer({ skills: ['running_pass'] });
    expect(hasRunningPass(player)).toBe(true);
  });

  it("hasRunningPass retourne true pour la variante S3 'running-pass-2025'", () => {
    const player = makePlayer({ skills: ['running-pass-2025'] });
    expect(hasRunningPass(player)).toBe(true);
  });

  it("hasRunningPass retourne false sans le skill", () => {
    const player = makePlayer({ skills: [] });
    expect(hasRunningPass(player)).toBe(false);
  });

  it("hasRunningPassHandoffVariant retourne true seulement pour la variante S3", () => {
    expect(hasRunningPassHandoffVariant(makePlayer({ skills: ['running-pass-2025'] }))).toBe(true);
    expect(hasRunningPassHandoffVariant(makePlayer({ skills: ['running-pass'] }))).toBe(false);
    expect(hasRunningPassHandoffVariant(makePlayer({ skills: [] }))).toBe(false);
  });
});

describe("Regle: Running Pass - canApplyRunningPass", () => {
  it("retourne true pour une Quick Pass sans turnover, skill present, MA restant", () => {
    const player = makePlayer({ skills: ['running-pass'], pm: 4 });
    const state = makeState([player]);
    expect(canApplyRunningPass(state, player, 'quick', false)).toBe(true);
  });

  it("retourne false sans le skill", () => {
    const player = makePlayer({ skills: [], pm: 4 });
    const state = makeState([player]);
    expect(canApplyRunningPass(state, player, 'quick', false)).toBe(false);
  });

  it("retourne false pour une Short Pass (Running Pass S2 = Quick Pass uniquement)", () => {
    const player = makePlayer({ skills: ['running-pass'], pm: 4 });
    const state = makeState([player]);
    expect(canApplyRunningPass(state, player, 'short', false)).toBe(false);
  });

  it("retourne false pour une Long Pass", () => {
    const player = makePlayer({ skills: ['running-pass'], pm: 4 });
    const state = makeState([player]);
    expect(canApplyRunningPass(state, player, 'long', false)).toBe(false);
  });

  it("retourne false pour une Long Bomb", () => {
    const player = makePlayer({ skills: ['running-pass'], pm: 4 });
    const state = makeState([player]);
    expect(canApplyRunningPass(state, player, 'bomb', false)).toBe(false);
  });

  it("retourne false si la passe a cause un turnover (interception, drop, fumble)", () => {
    const player = makePlayer({ skills: ['running-pass'], pm: 4 });
    const state = makeState([player]);
    expect(canApplyRunningPass(state, player, 'quick', true)).toBe(false);
  });

  it("retourne false si le joueur n'a plus de PM", () => {
    const player = makePlayer({ skills: ['running-pass'], pm: 0 });
    const state = makeState([player]);
    expect(canApplyRunningPass(state, player, 'quick', false)).toBe(false);
  });

  it("retourne false si Running Pass a deja ete utilise ce tour", () => {
    const player = makePlayer({ skills: ['running-pass'], pm: 4 });
    const state = markRunningPassUsed(makeState([player]), player.id);
    expect(canApplyRunningPass(state, player, 'quick', false)).toBe(false);
  });
});

describe("Regle: Running Pass - canApplyRunningPassToHandoff", () => {
  it("retourne true pour la variante S3 sans turnover", () => {
    const player = makePlayer({ skills: ['running-pass-2025'], pm: 4 });
    const state = makeState([player]);
    expect(canApplyRunningPassToHandoff(state, player, false)).toBe(true);
  });

  it("retourne false pour la variante S2 (handoff non couvert par 'running-pass')", () => {
    const player = makePlayer({ skills: ['running-pass'], pm: 4 });
    const state = makeState([player]);
    expect(canApplyRunningPassToHandoff(state, player, false)).toBe(false);
  });

  it("retourne false sans aucun skill", () => {
    const player = makePlayer({ skills: [], pm: 4 });
    const state = makeState([player]);
    expect(canApplyRunningPassToHandoff(state, player, false)).toBe(false);
  });

  it("retourne false en cas de turnover", () => {
    const player = makePlayer({ skills: ['running-pass-2025'], pm: 4 });
    const state = makeState([player]);
    expect(canApplyRunningPassToHandoff(state, player, true)).toBe(false);
  });
});

describe("Regle: Running Pass - tracking once-per-turn (immutabilite)", () => {
  it("hasUsedRunningPassThisTurn retourne false par defaut", () => {
    const player = makePlayer({ skills: ['running-pass'] });
    const state = makeState([player]);
    expect(hasUsedRunningPassThisTurn(state, player.id)).toBe(false);
  });

  it("hasUsedRunningPassThisTurn retourne true apres markRunningPassUsed", () => {
    const player = makePlayer({ skills: ['running-pass'] });
    const state = markRunningPassUsed(makeState([player]), player.id);
    expect(hasUsedRunningPassThisTurn(state, player.id)).toBe(true);
  });

  it("markRunningPassUsed ne mute pas l'etat source", () => {
    const player = makePlayer({ skills: ['running-pass'] });
    const state = makeState([player]);
    markRunningPassUsed(state, player.id);
    expect(state.usedRunningPassThisTurn).toBeUndefined();
  });

  it("markRunningPassUsed est idempotent", () => {
    const player = makePlayer({ skills: ['running-pass'] });
    const state = makeState([player]);
    const once = markRunningPassUsed(state, player.id);
    const twice = markRunningPassUsed(once, player.id);
    expect(twice.usedRunningPassThisTurn).toEqual([player.id]);
  });

  it("markRunningPassUsed accumule plusieurs joueurs", () => {
    const p1 = makePlayer({ id: 'p1', skills: ['running-pass'] });
    const p2 = makePlayer({ id: 'p2', skills: ['running-pass'] });
    const state = makeState([p1, p2]);
    const after1 = markRunningPassUsed(state, p1.id);
    const after2 = markRunningPassUsed(after1, p2.id);
    expect(after2.usedRunningPassThisTurn).toEqual([p1.id, p2.id]);
  });
});

describe("Regle: Running Pass - integration handlePass (Imperial Thrower)", () => {
  function createRunningPassScenario(): GameState {
    const state = setup();
    state.players = [
      // Imperial Thrower au centre, avec running-pass et la balle
      {
        id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Thrower', number: 1,
        position: 'Imperial Thrower', ma: 6, st: 3, ag: 3, pa: 3, av: 9,
        skills: ['pass', 'running-pass'], pm: 6, hasBall: true, state: 'active',
      },
      // Receveur a 2 cases (Quick Pass)
      {
        id: 'A2', team: 'A', pos: { x: 12, y: 7 }, name: 'Receiver', number: 2,
        position: 'Catcher', ma: 7, st: 3, ag: 3, pa: 4, av: 8,
        skills: [], pm: 7, hasBall: false, state: 'active',
      },
      // Adversaire eloigne pour ne pas interferer
      {
        id: 'B1', team: 'B', pos: { x: 22, y: 7 }, name: 'Defender', number: 1,
        position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9,
        skills: [], pm: 6, hasBall: false, state: 'active',
      },
    ];
    state.ball = undefined;
    state.currentPlayer = 'A';
    state.playerActions = {};
    state.teamFoulCount = {};
    state.teamRerolls = { teamA: 0, teamB: 0 };
    return state;
  }

  it("apres une Quick Pass reussie, le passeur peut continuer a bouger (canPlayerContinueMoving=true)", () => {
    const state = createRunningPassScenario();
    // RNG: pass success (5), catch success (5)
    const rng = makeTestRNG([0.8, 0.8]);
    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    // Pas de turnover
    expect(result.isTurnover).toBe(false);
    // Le receveur a la balle
    expect(result.players.find(p => p.id === 'A2')!.hasBall).toBe(true);
    // Le passeur n'a plus la balle
    expect(result.players.find(p => p.id === 'A1')!.hasBall).toBeFalsy();

    // Running Pass marque comme utilise
    expect(hasUsedRunningPassThisTurn(result, 'A1')).toBe(true);
    // Le passeur peut continuer a bouger
    expect(canPlayerContinueMoving(result, 'A1')).toBe(true);
  });

  it("apres une Quick Pass reussie, getLegalMoves contient des MOVE pour le passeur", () => {
    const state = createRunningPassScenario();
    const rng = makeTestRNG([0.8, 0.8]);
    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    const moves: Move[] = getLegalMoves(result, 'A');
    const passerMoves = moves.filter(m => m.type === 'MOVE' && (m as { playerId: string }).playerId === 'A1');
    expect(passerMoves.length).toBeGreaterThan(0);
  });

  it("sans Running Pass, le passeur ne peut pas continuer a bouger apres la passe", () => {
    const state = createRunningPassScenario();
    const passer = state.players[0];
    // Retirer le skill
    state.players = state.players.map(p =>
      p.id === passer.id ? { ...p, skills: ['pass'] } : p,
    );
    const rng = makeTestRNG([0.8, 0.8]);
    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    expect(result.isTurnover).toBe(false);
    expect(canPlayerContinueMoving(result, 'A1')).toBe(false);
    expect(hasUsedRunningPassThisTurn(result, 'A1')).toBe(false);
  });

  it("sur une Short Pass (hors quick), Running Pass ne s'active pas", () => {
    const state = createRunningPassScenario();
    // Deplacer le receveur a 5 cases (Short Pass)
    state.players = state.players.map(p =>
      p.id === 'A2' ? { ...p, pos: { x: 15, y: 7 } } : p,
    );
    const rng = makeTestRNG([0.95, 0.95]);
    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    expect(result.isTurnover).toBe(false);
    expect(hasUsedRunningPassThisTurn(result, 'A1')).toBe(false);
    expect(canPlayerContinueMoving(result, 'A1')).toBe(false);
  });

  it("en cas de turnover (passe ratee), Running Pass ne s'active pas", () => {
    const state = createRunningPassScenario();
    // RNG: pass roll = 1 (echec garanti pour PA 3+) -> turnover
    const rng = makeTestRNG([0.0]);
    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    expect(result.isTurnover).toBe(true);
    expect(hasUsedRunningPassThisTurn(result, 'A1')).toBe(false);
    // En turnover, getLegalMoves ne renvoie de toute facon plus rien
    expect(canPlayerContinueMoving(result, 'A1')).toBe(false);
  });

  it("le passeur peut consommer ses PM restants apres une Running Pass", () => {
    const state = createRunningPassScenario();
    // Forcer pm = 1 sur le passeur
    state.players = state.players.map(p =>
      p.id === 'A1' ? { ...p, pm: 1 } : p,
    );
    const rng = makeTestRNG([0.8, 0.8]);
    const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const afterPass = applyMove(state, passMove, rng);

    expect(hasUsedRunningPassThisTurn(afterPass, 'A1')).toBe(true);
    // Le passeur a encore le droit de bouger
    expect(canPlayerContinueMoving(afterPass, 'A1')).toBe(true);

    // Maintenant le passeur depense son dernier point de mouvement
    const moveTo: Move = { type: 'MOVE', playerId: 'A1', to: { x: 11, y: 7 } };
    const afterMove = applyMove(afterPass, moveTo, rng);
    const passerAfter = afterMove.players.find(p => p.id === 'A1')!;
    expect(passerAfter.pm).toBe(0);
    expect(passerAfter.pos).toEqual({ x: 11, y: 7 });
  });

  it("Running Pass est reinitialise au changement de tour (END_TURN)", () => {
    const state = createRunningPassScenario();
    const rng = makeTestRNG([0.8, 0.8]);
    const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const afterPass = applyMove(state, passMove, rng);
    expect(hasUsedRunningPassThisTurn(afterPass, 'A1')).toBe(true);

    const endTurn: Move = { type: 'END_TURN' };
    const afterEnd = applyMove(afterPass, endTurn, rng);
    expect(afterEnd.usedRunningPassThisTurn).toEqual([]);
    expect(hasUsedRunningPassThisTurn(afterEnd, 'A1')).toBe(false);
  });

  it("la variante S3 (running-pass-2025) declenche aussi sur un Hand-Off", () => {
    const state = createRunningPassScenario();
    // Donner au passeur la variante S3 et placer le receveur adjacent
    state.players = state.players.map(p => {
      if (p.id === 'A1') return { ...p, skills: ['pass', 'running-pass-2025'] };
      if (p.id === 'A2') return { ...p, pos: { x: 11, y: 7 } };
      return p;
    });
    const rng = makeTestRNG([0.95, 0.95]);
    const handoff: Move = { type: 'HANDOFF', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, handoff, rng);

    expect(result.isTurnover).toBe(false);
    expect(result.players.find(p => p.id === 'A2')!.hasBall).toBe(true);
    expect(hasUsedRunningPassThisTurn(result, 'A1')).toBe(true);
    expect(canPlayerContinueMoving(result, 'A1')).toBe(true);
  });

  it("la variante S2 (running-pass) ne declenche PAS sur un Hand-Off", () => {
    const state = createRunningPassScenario();
    state.players = state.players.map(p => {
      if (p.id === 'A2') return { ...p, pos: { x: 11, y: 7 } };
      return p;
    });
    const rng = makeTestRNG([0.95, 0.95]);
    const handoff: Move = { type: 'HANDOFF', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, handoff, rng);

    expect(result.isTurnover).toBe(false);
    expect(hasUsedRunningPassThisTurn(result, 'A1')).toBe(false);
    expect(canPlayerContinueMoving(result, 'A1')).toBe(false);
  });
});
