import { describe, it, expect, beforeEach } from 'vitest';
import {
  setup,
  calculateOffensiveAssists,
  calculateDefensiveAssists,
  type GameState,
  type Player,
} from '../index';
import {
  hasDefensive,
  isGuardCancelledByDefensive,
} from './defensive';

/**
 * Defensive (BB3 Season 2/3 — General / Agility category) :
 *  - Pendant le tour d'equipe de l'adversaire UNIQUEMENT, tous les joueurs
 *    adverses Marques (adjacents) par ce joueur ne peuvent pas utiliser le
 *    skill Guard pour fournir des assists.
 *  - Ne s'applique pas pendant le propre tour du joueur Defensive.
 *  - Le joueur Defensive doit etre debout (pas stunned) pour appliquer l'effet.
 *  - L'effet annule le Guard du joueur marque : si ce dernier est marque par
 *    d'autres adversaires, il ne peut plus fournir d'assist offensif.
 *
 * Utilisateurs principaux (5 equipes prioritaires) : Dwarf Blocker, Dwarf
 * Blocker Lineman (Nains), Jaguar Warrior Blocker (Hommes-Lezards).
 */

describe('Regle: Defensive', () => {
  let state: GameState;

  beforeEach(() => {
    state = setup();
  });

  describe('hasDefensive helper', () => {
    it('retourne false sans le skill', () => {
      const p = { skills: [] } as unknown as Player;
      expect(hasDefensive(p)).toBe(false);
    });

    it('retourne true avec le skill defensive', () => {
      const p = { skills: ['defensive'] } as unknown as Player;
      expect(hasDefensive(p)).toBe(true);
    });

    it('retourne true avec variante underscore', () => {
      const p = { skills: ['defensive'] } as unknown as Player;
      expect(hasDefensive(p)).toBe(true);
    });
  });

  describe('isGuardCancelledByDefensive', () => {
    it('retourne false si aucun adversaire Defensive adjacent', () => {
      const newState: GameState = {
        ...state,
        currentPlayer: 'A',
        players: state.players.map(p => {
          if (p.id === 'A1')
            return { ...p, pos: { x: 10, y: 7 }, skills: ['guard'] };
          if (p.id === 'B1')
            return { ...p, pos: { x: 20, y: 14 }, skills: ['defensive'] };
          return { ...p, pos: { x: 0, y: 0 } };
        }),
      };
      const guard = newState.players.find(p => p.id === 'A1')!;
      expect(isGuardCancelledByDefensive(newState, guard)).toBe(false);
    });

    it('retourne true quand un adversaire Defensive adjacent pendant le tour du joueur Guard', () => {
      const newState: GameState = {
        ...state,
        currentPlayer: 'A',
        players: state.players.map(p => {
          if (p.id === 'A1')
            return { ...p, pos: { x: 10, y: 7 }, skills: ['guard'], stunned: false };
          if (p.id === 'B1')
            return { ...p, pos: { x: 11, y: 7 }, skills: ['defensive'], stunned: false };
          return { ...p, pos: { x: 0, y: 0 } };
        }),
      };
      const guard = newState.players.find(p => p.id === 'A1')!;
      expect(isGuardCancelledByDefensive(newState, guard)).toBe(true);
    });

    it("retourne false si c'est le tour de l'equipe du joueur Defensive (pas le tour adverse)", () => {
      const newState: GameState = {
        ...state,
        currentPlayer: 'B', // tour de l'equipe Defensive
        players: state.players.map(p => {
          if (p.id === 'A1')
            return { ...p, pos: { x: 10, y: 7 }, skills: ['guard'], stunned: false };
          if (p.id === 'B1')
            return { ...p, pos: { x: 11, y: 7 }, skills: ['defensive'], stunned: false };
          return { ...p, pos: { x: 0, y: 0 } };
        }),
      };
      const guard = newState.players.find(p => p.id === 'A1')!;
      expect(isGuardCancelledByDefensive(newState, guard)).toBe(false);
    });

    it('retourne false si le joueur Defensive est stunned', () => {
      const newState: GameState = {
        ...state,
        currentPlayer: 'A',
        players: state.players.map(p => {
          if (p.id === 'A1')
            return { ...p, pos: { x: 10, y: 7 }, skills: ['guard'], stunned: false };
          if (p.id === 'B1')
            return { ...p, pos: { x: 11, y: 7 }, skills: ['defensive'], stunned: true };
          return { ...p, pos: { x: 0, y: 0 } };
        }),
      };
      const guard = newState.players.find(p => p.id === 'A1')!;
      expect(isGuardCancelledByDefensive(newState, guard)).toBe(false);
    });

    it("retourne false si le joueur adjacent n'a pas Defensive", () => {
      const newState: GameState = {
        ...state,
        currentPlayer: 'A',
        players: state.players.map(p => {
          if (p.id === 'A1')
            return { ...p, pos: { x: 10, y: 7 }, skills: ['guard'], stunned: false };
          if (p.id === 'B1')
            return { ...p, pos: { x: 11, y: 7 }, skills: ['block'], stunned: false };
          return { ...p, pos: { x: 0, y: 0 } };
        }),
      };
      const guard = newState.players.find(p => p.id === 'A1')!;
      expect(isGuardCancelledByDefensive(newState, guard)).toBe(false);
    });

    it("retourne true meme si plusieurs adversaires Defensive sont adjacents", () => {
      const newState: GameState = {
        ...state,
        currentPlayer: 'A',
        players: state.players.map(p => {
          if (p.id === 'A1')
            return { ...p, pos: { x: 10, y: 7 }, skills: ['guard'], stunned: false };
          if (p.id === 'B1')
            return { ...p, pos: { x: 11, y: 7 }, skills: ['defensive'], stunned: false };
          if (p.id === 'B2')
            return { ...p, pos: { x: 9, y: 7 }, skills: ['defensive'], stunned: false };
          return { ...p, pos: { x: 0, y: 0 } };
        }),
      };
      const guard = newState.players.find(p => p.id === 'A1')!;
      expect(isGuardCancelledByDefensive(newState, guard)).toBe(true);
    });
  });

  describe('Integration avec calculateOffensiveAssists', () => {
    it('un Guard marque par 2 adversaires dont 1 avec Defensive ne fournit PAS d\'assist', () => {
      // Scenario :
      //  - A1 attaque B1 (cible)
      //  - A2 est l'assistant potentiel : a Guard, adjacent a B1, marque par B2 (autre adversaire que B1)
      //  - B2 a Defensive et est adjacent a A2 -> annule Guard de A2
      //  - Resultat : A2 ne fournit plus d'assist (marque par B2 sans Guard)
      const newState: GameState = {
        ...state,
        currentPlayer: 'A',
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7, skills: [] };
          if (p.id === 'A2')
            return { ...p, pos: { x: 11, y: 8 }, stunned: false, pm: 6, skills: ['guard'] };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 6, skills: [] };
          if (p.id === 'B2')
            return { ...p, pos: { x: 12, y: 8 }, stunned: false, pm: 6, skills: ['defensive'] };
          return { ...p, pos: { x: 0, y: 0 } };
        }),
      };

      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      const assists = calculateOffensiveAssists(newState, attacker, target);
      expect(assists).toBe(0);
    });

    it('un Guard marque par 2 adversaires SANS Defensive fournit 1 assist (regle standard)', () => {
      const newState: GameState = {
        ...state,
        currentPlayer: 'A',
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7, skills: [] };
          if (p.id === 'A2')
            return { ...p, pos: { x: 11, y: 8 }, stunned: false, pm: 6, skills: ['guard'] };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 6, skills: [] };
          if (p.id === 'B2')
            return { ...p, pos: { x: 12, y: 8 }, stunned: false, pm: 6, skills: [] };
          return { ...p, pos: { x: 0, y: 0 } };
        }),
      };

      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      const assists = calculateOffensiveAssists(newState, attacker, target);
      expect(assists).toBe(1);
    });

    it("Defensive ne s'applique pas pendant le tour de l'equipe Defensive", () => {
      // Memes positions que le scenario "Guard annule" mais c'est le tour de B
      const newState: GameState = {
        ...state,
        currentPlayer: 'B',
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7, skills: [] };
          if (p.id === 'A2')
            return { ...p, pos: { x: 11, y: 8 }, stunned: false, pm: 6, skills: ['guard'] };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 6, skills: [] };
          if (p.id === 'B2')
            return { ...p, pos: { x: 12, y: 8 }, stunned: false, pm: 6, skills: ['defensive'] };
          return { ...p, pos: { x: 0, y: 0 } };
        }),
      };
      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      // Guard est encore actif -> A2 fournit 1 assist malgre B2
      const assists = calculateOffensiveAssists(newState, attacker, target);
      expect(assists).toBe(1);
    });

    it("Defensive n'affecte PAS les assists defensifs (regle BB2020 — tour adverse uniquement)", () => {
      // Scenario symetrique pour les defensive assists :
      //  - B1 est la cible, B2 est l'assistant defensif avec Guard marque par A2+attaquant
      //  - A2 a Defensive mais c'est le tour de l'equipe A (l'attaquant)
      //  - Regle : Defensive ne s'applique qu'au tour adverse. Ici B est l'equipe
      //    adverse au joueur Defensive A2 -> Defensive s'applique bien.
      //  - Cependant, la regle BB2020 annule le Guard uniquement pour les
      //    assists offensifs (le tour adverse = tour de l'attaquant).
      //  - Defensive n'affecte pas les defensive assists : Guard de B2 reste actif.
      const newState: GameState = {
        ...state,
        currentPlayer: 'A',
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7, skills: [] };
          if (p.id === 'A2')
            return { ...p, pos: { x: 9, y: 8 }, stunned: false, pm: 6, skills: ['defensive'] };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 6, skills: [] };
          if (p.id === 'B2')
            return { ...p, pos: { x: 10, y: 8 }, stunned: false, pm: 6, skills: ['guard'] };
          return { ...p, pos: { x: 0, y: 0 } };
        }),
      };
      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      // B2 Guard marque par A1 et A2 : Guard lui permet de fournir assist defensif
      const defAssists = calculateDefensiveAssists(newState, attacker, target);
      expect(defAssists).toBe(1);
    });

    it('assist sans Guard ni Defensive marque par autre adversaire = 0', () => {
      // Sanity check : pas de Guard, assistant marque par autre que la cible
      const newState: GameState = {
        ...state,
        currentPlayer: 'A',
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7, skills: [] };
          if (p.id === 'A2')
            return { ...p, pos: { x: 11, y: 8 }, stunned: false, pm: 6, skills: [] };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 6, skills: [] };
          if (p.id === 'B2')
            return { ...p, pos: { x: 12, y: 8 }, stunned: false, pm: 6, skills: [] };
          return { ...p, pos: { x: 0, y: 0 } };
        }),
      };
      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      const assists = calculateOffensiveAssists(newState, attacker, target);
      expect(assists).toBe(0);
    });
  });
});
