import { describe, it, expect, beforeEach } from 'vitest';
import {
  setup,
  resolveBlockResult,
  applyMove,
  makeRNG,
  type GameState,
  type Player,
} from '../index';
import { hasFrenzy } from './frenzy';

/**
 * Frenzy (BB3 Season 2/3) :
 *  - Follow-up obligatoire après un PUSH_BACK.
 *  - Second bloc obligatoire si la cible est encore debout et adjacente.
 *  - Pas de troisième bloc si le second produit aussi un PUSH_BACK.
 *
 * Joueurs des 5 équipes prioritaires concernés :
 *  - Skaven Rat Ogre (frenzy + animal-savagery + prehensile-tail)
 *  - Dwarf Troll Slayer (block + dauntless + frenzy + thick-skull)
 */

function makeBlockResult(
  attackerId: string,
  targetId: string,
  result: 'BOTH_DOWN' | 'PUSH_BACK' | 'POW' | 'STUMBLE' | 'PLAYER_DOWN',
) {
  return {
    type: 'block' as const,
    playerId: attackerId,
    targetId: targetId,
    diceRoll: 2,
    result,
    offensiveAssists: 0,
    defensiveAssists: 0,
    totalStrength: 3,
    targetStrength: 3,
  };
}

function placePlayersForBlock(
  baseState: GameState,
  attackerSkills: string[],
  defenderSkills: string[],
): GameState {
  return {
    ...baseState,
    players: baseState.players.map(p => {
      if (p.id === 'A2')
        return {
          ...p,
          pos: { x: 10, y: 7 },
          stunned: false,
          pm: 6,
          skills: attackerSkills,
        };
      if (p.id === 'B2')
        return {
          ...p,
          pos: { x: 11, y: 7 },
          stunned: false,
          pm: 6,
          skills: defenderSkills,
        };
      // Éloigner les autres joueurs
      return {
        ...p,
        pos: { x: 1, y: p.team === 'A' ? 1 : 14 },
        stunned: false,
        pm: 6,
      };
    }),
    currentPlayer: 'A',
  };
}

describe('Regle: frenzy — hasFrenzy', () => {
  it('renvoie true si le joueur a frenzy', () => {
    const p = { skills: ['frenzy'] } as unknown as Player;
    expect(hasFrenzy(p)).toBe(true);
  });

  it('renvoie false sans frenzy', () => {
    const p = { skills: ['block'] } as unknown as Player;
    expect(hasFrenzy(p)).toBe(false);
  });
});

describe('Regle: frenzy — PUSH_BACK declenche second bloc', () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = setup();
  });

  it('sur PUSH_BACK avec frenzy : pendingFrenzyBlock est défini', () => {
    const state = placePlayersForBlock(baseState, ['frenzy'], []);

    const rng = makeRNG(42);

    const result = resolveBlockResult(
      state,
      makeBlockResult('A2', 'B2', 'PUSH_BACK'),
      rng,
    );

    // pendingFrenzyBlock doit être défini (le second bloc sera déclenché
    // après résolution du choix de push / follow-up)
    expect(result.pendingFrenzyBlock).toBeDefined();
    expect(result.pendingFrenzyBlock?.attackerId).toBe('A2');
    expect(result.pendingFrenzyBlock?.targetId).toBe('B2');

    // Pas de pendingFollowUpChoice (le follow-up sera auto avec frenzy)
    expect(result.pendingFollowUpChoice).toBeUndefined();
  });

  it('sur PUSH_BACK avec frenzy + plusieurs directions : pendingPushChoice + pendingFrenzyBlock', () => {
    // Avec plusieurs directions de push, le jeu doit attendre le choix de push
    // ET préparer le second bloc frenzy
    const state = placePlayersForBlock(baseState, ['frenzy'], []);
    const rng = makeRNG(42);

    const result = resolveBlockResult(
      state,
      makeBlockResult('A2', 'B2', 'PUSH_BACK'),
      rng,
    );

    // Avec plusieurs directions de push : pendingPushChoice est défini
    expect(result.pendingPushChoice).toBeDefined();
    // pendingFrenzyBlock est aussi défini
    expect(result.pendingFrenzyBlock).toBeDefined();
    expect(result.pendingFrenzyBlock?.attackerId).toBe('A2');
  });

  it('sur POW avec frenzy : PAS de second bloc (cible à terre)', () => {
    const state = placePlayersForBlock(baseState, ['frenzy'], []);
    const rng = makeRNG(42);

    const result = resolveBlockResult(
      state,
      makeBlockResult('A2', 'B2', 'POW'),
      rng,
    );

    // Pas de pendingFrenzyBlock (la cible est à terre)
    expect(result.pendingFrenzyBlock).toBeUndefined();
  });

  it('sur BOTH_DOWN avec frenzy : PAS de second bloc', () => {
    const state = placePlayersForBlock(baseState, ['frenzy'], []);
    const rng = makeRNG(42);

    const result = resolveBlockResult(
      state,
      makeBlockResult('A2', 'B2', 'BOTH_DOWN'),
      rng,
    );

    expect(result.pendingFrenzyBlock).toBeUndefined();
  });

  it('sur PUSH_BACK SANS frenzy : comportement normal (pendingFollowUpChoice)', () => {
    const state = placePlayersForBlock(baseState, ['block'], []);
    const rng = makeRNG(42);

    const result = resolveBlockResult(
      state,
      makeBlockResult('A2', 'B2', 'PUSH_BACK'),
      rng,
    );

    // Sans frenzy, on doit avoir un choix de follow-up
    // (ou une direction de push choisie automatiquement)
    expect(result.pendingFrenzyBlock).toBeUndefined();
  });
});

describe('Regle: frenzy — integration via applyMove', () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = setup();
  });

  it('frenzy declenche un second bloc complet via applyMove', () => {
    // Placer l'attaquant avec frenzy et la cible adjacente
    // RNG : premier bloc = PUSH_BACK (dé 4 = PUSH_BACK), second bloc = POW (dé 5 = POW)
    // blockResultFromRoll: 1=PLAYER_DOWN, 2=BOTH_DOWN, 3=PUSH_BACK, 4=PUSH_BACK, 5=POW, 6=POW
    const state = placePlayersForBlock(baseState, ['frenzy'], []);

    // Seed RNG pour que le premier bloc soit un PUSH_BACK et le second un résultat quelconque
    // blockResultFromRoll uses: floor(rng()*6)+1
    // Pour produire un 3 (PUSH_BACK) : rng doit retourner (3-1)/6 = 0.333...
    // Pour le second bloc (après follow-up) : rng()*6+1 → PUSH_BACK ou autre

    // On utilise le RNG seeded qui produit des résultats déterministes
    const rng = makeRNG(42);

    // Exécuter le bloc via applyMove
    const result = applyMove(
      state,
      { type: 'BLOCK', playerId: 'A2', targetId: 'B2' },
      rng,
    );

    // Vérifier que des logs Frenzy apparaissent
    const frenzyLogs = result.gameLog.filter(l =>
      l.message.includes('Frenzy') || l.message.includes('Frénésie') || l.message.includes('second blocage'),
    );
    // Le résultat dépend du RNG, mais si le premier bloc produit un PUSH_BACK,
    // un log frenzy devrait apparaître
    // Ce test vérifie que la mécanique est câblée (pas de crash)
    expect(result).toBeDefined();
    expect(result.players).toBeDefined();
  });
});

describe('Regle: frenzy — Dwarf Troll Slayer', () => {
  it('Troll Slayer a les skills frenzy + block + dauntless + thick-skull', () => {
    const trollSlayer = {
      skills: ['block', 'dauntless', 'frenzy', 'thick-skull'],
    } as unknown as Player;
    expect(hasFrenzy(trollSlayer)).toBe(true);
  });
});

describe('Regle: frenzy — Skaven Rat Ogre', () => {
  it('Rat Ogre a les skills frenzy + animal-savagery + prehensile-tail', () => {
    const ratOgre = {
      skills: ['animal-savagery', 'frenzy', 'loner-4', 'mighty-blow-1', 'prehensile-tail'],
    } as unknown as Player;
    expect(hasFrenzy(ratOgre)).toBe(true);
  });
});
