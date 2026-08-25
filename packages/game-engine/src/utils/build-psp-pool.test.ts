import { describe, it, expect } from 'vitest';
import {
  advancementPspCost,
  poolSpentForPlayer,
  poolSpentForTeam,
  poolRemaining,
  parseAdvancements,
} from './build-psp-pool';

describe('advancementPspCost', () => {
  it('utilise le coût persisté quand il existe', () => {
    expect(advancementPspCost({ type: 'primary', pspCost: 3 }, 0)).toBe(3);
    // Un règlement de tournoi peut facturer autre chose que le barème
    // standard : c'est le coût persisté qui fait foi, pas le rang.
    expect(advancementPspCost({ type: 'secondary', pspCost: 18 }, 0)).toBe(18);
  });

  it('retombe sur le barème standard pour les enregistrements historiques', () => {
    expect(advancementPspCost({ type: 'primary' }, 0)).toBe(6);
    expect(advancementPspCost({ type: 'primary' }, 1)).toBe(8);
    expect(advancementPspCost({ type: 'secondary' }, 0)).toBe(10);
    expect(advancementPspCost({ type: 'random-primary' }, 0)).toBe(3);
    expect(advancementPspCost({ type: 'characteristic' }, 0)).toBe(14);
  });

  it('sature au 6e palier et ignore les types inconnus', () => {
    expect(advancementPspCost({ type: 'primary' }, 42)).toBe(30);
    expect(advancementPspCost({ type: 'random-secondary' }, 0)).toBe(0);
  });
});

describe('poolSpentForPlayer', () => {
  it('additionne les avancements financés par le pool', () => {
    expect(
      poolSpentForPlayer([
        { type: 'primary', pspCost: 6, fundedBy: 'pool' },
        { type: 'primary', pspCost: 8, fundedBy: 'pool' },
      ]),
    ).toBe(14);
  });

  it('exclut les avancements payés sur les SPP du joueur', () => {
    expect(
      poolSpentForPlayer([
        { type: 'primary', pspCost: 6, fundedBy: 'pool' },
        { type: 'primary', pspCost: 8, fundedBy: 'player' },
      ]),
    ).toBe(6);
  });

  it('compte un avancement historique (sans source) comme financé par le pool', () => {
    expect(poolSpentForPlayer([{ type: 'primary' }, { type: 'primary' }])).toBe(
      14,
    );
  });
});

describe('poolSpentForTeam / poolRemaining', () => {
  it('somme les joueurs et borne le reste à 0', () => {
    const spent = poolSpentForTeam([
      [{ type: 'primary', pspCost: 6, fundedBy: 'pool' }],
      [{ type: 'secondary', pspCost: 10, fundedBy: 'pool' }],
      [],
    ]);
    expect(spent).toBe(16);
    expect(poolRemaining(20, spent)).toBe(4);
    expect(poolRemaining(10, spent)).toBe(0);
  });
});

describe('parseAdvancements', () => {
  it('accepte la chaîne JSON (sqlite) et le tableau natif (PostgreSQL)', () => {
    const raw = [{ type: 'primary', pspCost: 6 }];
    expect(parseAdvancements(JSON.stringify(raw))).toEqual(raw);
    expect(parseAdvancements(raw)).toEqual(raw);
  });

  it('renvoie [] sur du JSON invalide, null ou une forme inattendue', () => {
    expect(parseAdvancements('pas du json')).toEqual([]);
    expect(parseAdvancements(null)).toEqual([]);
    expect(parseAdvancements(undefined)).toEqual([]);
    expect(parseAdvancements({ type: 'primary' })).toEqual([]);
  });

  it('filtre les entrées sans type', () => {
    expect(parseAdvancements([{ foo: 1 }, { type: 'primary' }])).toEqual([
      { type: 'primary' },
    ]);
  });
});
