import { describe, it, expect } from 'vitest';
import { setup, applyMove, canPlayerContinueMoving } from '../index';
import { GameState, RNG, Move } from '../core/types';
import { canFoul, calculateFoulAssists } from './foul';

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

function createFoulTestState(): GameState {
  const state = setup();
  state.players = [
    {
      id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Fouler', number: 1,
      position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
      pm: 6, hasBall: false, state: 'active',
    },
    {
      id: 'A2', team: 'A', pos: { x: 10, y: 6 }, name: 'Helper', number: 2,
      position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
      pm: 6, hasBall: false, state: 'active',
    },
    {
      id: 'B1', team: 'B', pos: { x: 11, y: 7 }, name: 'Victim', number: 1,
      position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
      pm: 0, hasBall: false, state: 'active', stunned: true,
    },
  ];
  state.ball = { x: 5, y: 5 };
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 0, teamB: 0 };
  return state;
}

describe('Foul Validation', () => {
  it('peut faire une faute sur un joueur au sol adjacent', () => {
    const state = createFoulTestState();
    const attacker = state.players[0];
    const target = state.players[2];
    expect(canFoul(state, attacker, target)).toBe(true);
  });

  it('refuse la faute sur un joueur debout', () => {
    const state = createFoulTestState();
    state.players[2].stunned = false;
    const attacker = state.players[0];
    const target = state.players[2];
    expect(canFoul(state, attacker, target)).toBe(false);
  });

  it('refuse la faute sur un joueur non-adjacent', () => {
    const state = createFoulTestState();
    state.players[2].pos = { x: 15, y: 7 };
    const attacker = state.players[0];
    const target = state.players[2];
    expect(canFoul(state, attacker, target)).toBe(false);
  });

  it('refuse la faute sur un coéquipier', () => {
    const state = createFoulTestState();
    state.players[2].team = 'A';
    const attacker = state.players[0];
    const target = state.players[2];
    expect(canFoul(state, attacker, target)).toBe(false);
  });
});

describe('Foul Assists', () => {
  it('calcule les assists de foul correctement', () => {
    const state = createFoulTestState();
    // A2 est à (10,6), adjacent à B1 à (11,7) = +1 assist
    // Pas de défenseurs adverses adjacents
    const assists = calculateFoulAssists(state, state.players[0], state.players[2]);
    expect(assists).toBe(1); // A2 aide
  });
});

describe('Foul Action', () => {
  it('effectue une faute avec armure percée', () => {
    const state = createFoulTestState();
    // RNG: die1=6 (0.83), die2=6 (0.83) => armor roll = 12+1 = 13 >= 8 (broken)
    // Doublet 6-6 => expulsion !
    // Puis injury roll: 2D6
    const rng = makeTestRNG([0.83, 0.83, 0.5, 0.5, 0.5]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    // L'action devrait avoir été enregistrée
    expect(result.playerActions['A1']).toBe('FOUL');

    // A1 devrait être expulsé (doublet 6-6)
    const fouler = result.players.find(p => p.id === 'A1')!;
    expect(fouler.state).toBe('sent_off');
  });

  it('limite les fouls à 1 par tour', () => {
    const state = createFoulTestState();
    // Ajouter un deuxième attaquant
    state.players.push({
      id: 'A3', team: 'A', pos: { x: 11, y: 6 }, name: 'Fouler2', number: 3,
      position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
      pm: 6, hasBall: false, state: 'active',
    });

    // Premier foul
    const rng = makeTestRNG([0.16, 0.5, 0.5, 0.5]); // die1=1, die2=3 (pas doublet)
    const move1: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result1 = applyMove(state, move1, rng);

    // Deuxième foul devrait être refusé
    const move2: Move = { type: 'FOUL', playerId: 'A3', targetId: 'B1' };
    const result2 = applyMove(result1, move2, rng);

    // L'état ne devrait pas changer
    expect(result2.playerActions['A3']).toBeUndefined();
  });

  it('pas d\'expulsion sans doublet', () => {
    const state = createFoulTestState();
    // RNG: die1=2 (0.16), die2=5 (0.66) => armor roll = 7+1 = 8 >= 8 (broken, juste)
    // Pas de doublet => pas d'expulsion
    const rng = makeTestRNG([0.16, 0.66, 0.5, 0.5, 0.5]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const fouler = result.players.find(p => p.id === 'A1')!;
    expect(fouler.state).not.toBe('sent_off');
  });
});

describe('Regle: Sneaky Git', () => {
  it('ne declenche pas d\'expulsion sur un doublet naturel au jet d\'armure', () => {
    const state = createFoulTestState();
    state.players[0].skills = ['sneaky-git'];
    // RNG: die1=6, die2=6 => doublet, armor = 12+1 = 13 (broken)
    const rng = makeTestRNG([0.83, 0.83, 0.5, 0.5, 0.5]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const fouler = result.players.find(p => p.id === 'A1')!;
    // Doublet 6-6 : normalement expulse, mais sneaky-git annule l'expulsion
    expect(fouler.state).not.toBe('sent_off');
  });

  it('reste expulse sans sneaky-git sur un doublet naturel', () => {
    const state = createFoulTestState();
    // pas de skill sneaky-git
    const rng = makeTestRNG([0.83, 0.83, 0.5, 0.5, 0.5]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const fouler = result.players.find(p => p.id === 'A1')!;
    expect(fouler.state).toBe('sent_off');
  });

  it('applique le jet de blessure normalement malgre sneaky-git', () => {
    const state = createFoulTestState();
    state.players[0].skills = ['sneaky-git'];
    // die1=6 die2=6 armor brisee, puis injury die1=6, die2=6 => 12 casualty
    const rng = makeTestRNG([0.83, 0.83, 0.83, 0.83, 0.5]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const victim = result.players.find(p => p.id === 'B1')!;
    // La cible a subi le jet de blessure (pas active apres armor brisee + injury 12)
    expect(victim.state).not.toBe('active');
    const fouler = result.players.find(p => p.id === 'A1')!;
    expect(fouler.state).not.toBe('sent_off');
  });

  it('autorise la poursuite de l\'activation apres une faute', () => {
    const state = createFoulTestState();
    state.players[0].skills = ['sneaky-git'];
    // PM = 6, die1=1 die2=3 (pas de doublet, pas d'expulsion meme sans sneaky-git)
    const rng = makeTestRNG([0.16, 0.4, 0.5, 0.5, 0.5]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    // Avec sneaky-git, le joueur peut continuer a bouger apres la faute
    expect(canPlayerContinueMoving(result, 'A1')).toBe(true);
  });

  it('stoppe l\'activation apres une faute sans sneaky-git', () => {
    const state = createFoulTestState();
    const rng = makeTestRNG([0.16, 0.4, 0.5, 0.5, 0.5]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    expect(canPlayerContinueMoving(result, 'A1')).toBe(false);
  });
});
