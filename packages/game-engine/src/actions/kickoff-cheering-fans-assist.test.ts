/**
 * Saison 2025 — coup d'envoi « Fans en folie » (6).
 *
 * Le coach au plus haut total (1D6 + Cheerleaders) obtient un Soutien
 * Offensif supplementaire sur sa PREMIERE Action de Blocage du Tour qui
 * suit. Avant la correction de la table de coup d'envoi, l'evenement
 * accordait une relance d'equipe (regle de l'edition precedente) et le
 * bonus d'assist n'existait pas.
 */

import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { handleBlock } from './block-handler';
import type { GameState, RNG } from '../core/types';

const rng: RNG = () => 0.5;

/** Deux joueurs adjacents, tous les autres retires du terrain. */
function makeDuel(cheeringFansAssist?: { teamA: boolean; teamB: boolean }): GameState {
  const base = setup();
  const attacker = base.players.find(p => p.team === 'A')!;
  const target = base.players.find(p => p.team === 'B')!;
  return {
    ...base,
    gamePhase: 'playing',
    currentPlayer: 'A',
    cheeringFansAssist,
    players: base.players.map(p => {
      if (p.id === attacker.id) return { ...p, pos: { x: 5, y: 5 } };
      if (p.id === target.id) return { ...p, pos: { x: 6, y: 5 } };
      // Les autres sortent du terrain pour neutraliser les assists.
      return { ...p, pos: { x: -1, y: -1 } };
    }),
  } as GameState;
}

describe('Coup d\'envoi « Fans en folie » — Soutien Offensif bonus', () => {
  const attackerId = setup().players.find(p => p.team === 'A')!.id;
  const targetId = setup().players.find(p => p.team === 'B')!.id;
  const blockMove = { type: 'BLOCK' as const, playerId: attackerId, targetId };

  it('ajoute +1 Soutien Offensif : un de de blocage supplementaire', () => {
    // Duel ST 3 (attaquant) contre ST 2 (cible) : 2 des sans bonus,
    // 3 des avec le Soutien Offensif (force doublee).
    const withoutBonus = handleBlock(makeDuel(), blockMove, rng);
    const withBonus = handleBlock(makeDuel({ teamA: true, teamB: false }), blockMove, rng);

    expect(withoutBonus.pendingBlock?.options).toHaveLength(2);
    expect(withBonus.pendingBlock?.options).toHaveLength(3);
  });

  it('consomme le bonus : il ne vaut que pour ce blocage', () => {
    const next = handleBlock(makeDuel({ teamA: true, teamB: false }), blockMove, rng);
    expect(next.cheeringFansAssist?.teamA).toBe(false);
  });

  it('ne consomme pas le bonus de l\'equipe adverse', () => {
    const next = handleBlock(makeDuel({ teamA: false, teamB: true }), blockMove, rng);
    expect(next.cheeringFansAssist?.teamB).toBe(true);
  });

  it('sans bonus, l\'etat reste inchange sur ce champ', () => {
    const next = handleBlock(makeDuel(), blockMove, rng);
    expect(next.cheeringFansAssist).toBeUndefined();
  });
});
