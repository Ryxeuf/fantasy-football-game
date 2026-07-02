import { describe, it, expect } from 'vitest';
import {
  parseNumberMap,
  resolveCupBudget,
  resolveCupStartingPsp,
  advancementsPspCost,
  teamAdvancementsPspCost,
} from './cup-rules';

const skaven = { slug: 'skaven', tier: 'II', budget: 1000 };

describe('parseNumberMap', () => {
  it('renvoie {} pour null / undefined / string vide', () => {
    expect(parseNumberMap(null)).toEqual({});
    expect(parseNumberMap(undefined)).toEqual({});
    expect(parseNumberMap('')).toEqual({});
    expect(parseNumberMap('   ')).toEqual({});
  });

  it('accepte un objet natif (Postgres JSONB)', () => {
    expect(parseNumberMap({ I: 1150, II: 1100 })).toEqual({ I: 1150, II: 1100 });
  });

  it('accepte une string JSON sérialisée (miroir SQLite)', () => {
    expect(parseNumberMap('{"I":1150,"II":1100}')).toEqual({ I: 1150, II: 1100 });
  });

  it('ignore les valeurs non numériques / négatives / NaN', () => {
    expect(
      parseNumberMap({ I: 1000, II: 'x', III: -5, IV: NaN, V: 0 }),
    ).toEqual({ I: 1000, V: 0 });
  });

  it('tolère un JSON invalide ou un array', () => {
    expect(parseNumberMap('{bad json')).toEqual({});
    expect(parseNumberMap([1, 2, 3])).toEqual({});
  });
});

describe('resolveCupBudget — précédence override > tier > défaut', () => {
  it('sans config → budget par défaut du roster', () => {
    expect(resolveCupBudget({}, skaven)).toBe(1000);
  });

  it('budget du tier si défini', () => {
    expect(
      resolveCupBudget({ tierBudgets: { II: 1100 } }, skaven),
    ).toBe(1100);
  });

  it('override roster prime sur le tier', () => {
    expect(
      resolveCupBudget(
        { tierBudgets: { II: 1100 }, rosterBudgetOverrides: { skaven: 1250 } },
        skaven,
      ),
    ).toBe(1250);
  });

  it('tier non listé → budget par défaut', () => {
    expect(
      resolveCupBudget({ tierBudgets: { I: 1200 } }, skaven),
    ).toBe(1000);
  });

  it('fonctionne avec les maps sérialisées (SQLite)', () => {
    expect(
      resolveCupBudget({ tierBudgets: '{"II":1100}' }, skaven),
    ).toBe(1100);
  });
});

describe('resolveCupStartingPsp', () => {
  it('0 par défaut', () => {
    expect(resolveCupStartingPsp({}, skaven)).toBe(0);
    expect(resolveCupStartingPsp({ tierStartingPsp: { I: 6 } }, skaven)).toBe(0);
  });

  it('PSP du tier si défini (objet ou string)', () => {
    expect(
      resolveCupStartingPsp({ tierStartingPsp: { II: 6 } }, skaven),
    ).toBe(6);
    expect(
      resolveCupStartingPsp({ tierStartingPsp: '{"II":10}' }, skaven),
    ).toBe(10);
  });

  it('override roster PSP prime sur le tier', () => {
    expect(
      resolveCupStartingPsp(
        { tierStartingPsp: { II: 6 }, rosterStartingPspOverrides: { skaven: 12 } },
        skaven,
      ),
    ).toBe(12);
  });

  it('roster non surchargé → PSP du tier', () => {
    expect(
      resolveCupStartingPsp(
        { tierStartingPsp: { II: 6 }, rosterStartingPspOverrides: { orc: 12 } },
        skaven,
      ),
    ).toBe(6);
  });
});

describe('advancementsPspCost / teamAdvancementsPspCost', () => {
  it('additionne les barèmes par palier (primary 6, puis 8)', () => {
    expect(
      advancementsPspCost([{ type: 'primary' }, { type: 'primary' }]),
    ).toBe(14);
  });

  it('mixe les types (random-primary 3 + characteristic 14 au 2e palier)', () => {
    expect(
      advancementsPspCost([{ type: 'random-primary' }, { type: 'characteristic' }]),
    ).toBe(3 + 16);
  });

  it('ignore les entrées mal formées', () => {
    expect(advancementsPspCost([{ type: 'bogus' }, {}])).toBe(0);
  });

  it("somme sur toute l'équipe, tolérant au JSON invalide/null", () => {
    const players = [
      { advancements: JSON.stringify([{ type: 'primary' }]) }, // 6
      { advancements: JSON.stringify([{ type: 'random-primary' }]) }, // 3
      { advancements: null },
      { advancements: 'not-json' },
    ];
    expect(teamAdvancementsPspCost(players)).toBe(9);
  });
});
