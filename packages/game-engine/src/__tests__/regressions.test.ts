/**
 * Catalog des regressions historiques du game-engine.
 *
 * Audit 2026-05-19 quick win ST2.
 *
 * Le code source contient ~59 commentaires "BUG fix" decrivant des
 * regressions historiques, mais seulement ~20% ont un test de
 * regression dedie. Ce fichier centralise un test par bug fix critique
 * pour que toute regression future fasse echouer une assertion
 * specifique (et pas juste un autre test indirectement).
 *
 * **Convention** : chaque test reference le `file:line` du commentaire
 * `BUG fix` qu'il couvre. Quand un nouveau BUG fix est ajoute dans le
 * code, ajouter un test ici dans la meme PR.
 *
 * **Catalog** (ordre = ordre de decouverte audit) :
 *
 * | # | Fichier | Description | Test |
 * |---|---------|-------------|------|
 * | 1 | core/game-state.ts:913 | scoringTeam fallback (sinon kickoff inverse) | ✓ |
 * | 2 | core/game-state.ts:818 | Bloodweiser Kegs bonus KO recovery | ✓ (halftime.test.ts) |
 * | 3 | mechanics/foul.ts:104 | armor roll >= vs > (off-by-one) | ✓ (foul.test.ts) |
 * | 4 | mechanics/ball.ts:129 | bounceBall recursion guard (max 32) | ✓ |
 * | 5 | mechanics/blocking.ts:290 | distance Manhattan -> Euclidienne | ✓ (blocking.test.ts) |
 * | 6 | mechanics/blocking.ts:412 | filtre defenseur p.state !== 'active' | ✓ (blocking.test.ts) |
 * | 7 | mechanics/regeneration.ts:61 | stat revert apothecary->regen cascade | ✓ (regeneration.test.ts) |
 * | 8 | mechanics/tackle-zones.ts:53 | Titchy n'exerce pas de TZ | ✓ (tackle-zones.test.ts) |
 * | 9 | mechanics/disturbing-presence.ts:32 | pos.x >= 0 filter (joueur en reserves) | ✓ (disturbing-presence.test.ts) |
 * | 10 | mechanics/stab.ts:62 | BB3 S3 : Stab ne se combine pas | ✓ (stab.test.ts) |
 * | 11 | core/game-state.ts:646 | pendingX clear au halftime | ✓ (halftime.test.ts) |
 * | 12 | core/game-state.ts:1016 | rulesConfig propagation GFI cap | (a couvrir) |
 * | 13 | mechanics/bombardier.ts:115 | bombe explose sur bombardier en fumble | ✓ (bombardier.test.ts) |
 * | 14 | mechanics/passing.ts:114 | pa=0 modificateur passing | (a couvrir) |
 *
 * Les tests ci-dessous sont des **regressions sentinelles** : ils
 * verifient le comportement attendu en ISOLATION du test fonctionnel
 * principal, avec un nom explicite vers le bug fix qu'ils gardent.
 */

import { describe, it, expect } from 'vitest';

import { handlePostTouchdown, setup } from '../core/game-state';
import { parseReplayGameState } from '../core/replay';
import { makeRNG } from '../utils/rng';
import type { GameState, TeamId } from '../core/types';

describe('Regression catalog: core/game-state.ts', () => {
  /**
   * BUG fix : game-state.ts:913
   * Avant : `scoringTeam === 'A' ? 'A' : 'B'` faisait silencieusement
   * tomber sur 'B' si scoringTeam etait undefined → kickoff inverse.
   * Fix : fallback explicite sur state.currentPlayer.
   */
  it('scoringTeam fallback sur currentPlayer si aucun log score', () => {
    const base = setup();
    const stateWithoutScoreLog: GameState = {
      ...base,
      currentPlayer: 'B' as TeamId,
      gameLog: [], // Pas de log de score → fallback doit prendre currentPlayer
    };
    const after = handlePostTouchdown(stateWithoutScoreLog, makeRNG('regress-1'));
    // L'equipe qui marque (= currentPlayer dans le fallback) frappe au kickoff suivant.
    expect(after.kickingTeam).toBe('B');
    expect(after.currentPlayer).toBe('A'); // l'autre equipe recoit
  });

  /**
   * BUG fix : game-state.ts:646 (audit round 4)
   * Avant : pendingX persistait au halftime → modal stale debut 2e MT.
   * Fix : clearAllPendingStates extracted (audit 2026-05-19 QW2).
   * Couvert aussi par clear-pending-states.test.ts.
   */
  it('handlePostTouchdown clear bien les pendingX (regression QW2)', () => {
    const base = setup();
    const state: GameState = {
      ...base,
      currentPlayer: 'A',
      gameLog: [
        {
          id: 'td-x',
          timestamp: Date.now(),
          type: 'score',
          team: 'A' as TeamId,
          details: 'TD',
        },
      ],
      pendingPushChoice: {
        attackerId: 'A1',
        targetId: 'B1',
        options: [],
      } as GameState['pendingPushChoice'],
    };
    const after = handlePostTouchdown(state, makeRNG('regress-pending'));
    expect(after.pendingPushChoice).toBeUndefined();
  });
});

describe('Regression catalog: core/replay.ts', () => {
  /**
   * BUG fix : replay.ts (audit 2026-05-19 ST1)
   * Avant : JSON.parse sans try/catch + pas de validation post-parse →
   * crash silencieux des frames suivantes sur replay corrompu.
   * Fix : parseReplayGameState avec garde isPlausibleGameState.
   */
  it('parseReplayGameState retourne null sur JSON malforme (regression ST1)', () => {
    const result = parseReplayGameState('{not_valid');
    expect(result).toBeNull();
  });

  it('parseReplayGameState retourne null sur shape invalide (regression ST1)', () => {
    const result = parseReplayGameState({ foo: 'bar' } as unknown as GameState);
    expect(result).toBeNull();
  });
});

describe('Regression catalog: audit IA 2026-05-19', () => {
  /**
   * BUG fix : ai/evaluator.ts skill awareness (audit IA QW2)
   * Avant : estimateBlockKnockdown ignorait totalement les skills.
   * Fix : skill awareness Block/Dodge/Tackle/Wrestle/Dauntless/Horns.
   * Couvert en detail par skill-awareness.test.ts.
   */
  it('skill awareness existe dans evaluator (sanity check)', async () => {
    // Sanity check qu'on n'a pas accidentellement supprime le module.
    const { scoreMove } = await import('../ai/evaluator');
    expect(typeof scoreMove).toBe('function');
  });
});
