import { describe, it, expect } from 'vitest';
import {
  generatePseudonym,
  generateShortPseudonym,
  getDescriptor,
  type PseudonymOptions,
} from './pseudonymize.js';

describe('generatePseudonym - format de base', () => {
  it('format "Le X de Ville, #N"', () => {
    const result = generatePseudonym({
      cityTag: 'Kansas City',
      bbPosition: 'Thrower',
      jerseyNumber: 15,
    });
    expect(result).toBe('Le Sidearm Wizard de Kansas City, #15');
  });

  it('Mahomes pseudo (KC Skaven QB)', () => {
    expect(
      generatePseudonym({ cityTag: 'Kansas City', bbPosition: 'Thrower', jerseyNumber: 15 })
    ).toBe('Le Sidearm Wizard de Kansas City, #15');
  });

  it('Bosa-style (SF Orc DE)', () => {
    expect(
      generatePseudonym({ cityTag: 'San Francisco', bbPosition: 'Blitzer', jerseyNumber: 97 })
    ).toBe('Le Edge Hunter de San Francisco, #97');
  });

  it('Jefferson-style (MIN Norse WR)', () => {
    expect(
      generatePseudonym({ cityTag: 'Minnesota', bbPosition: 'Catcher', jerseyNumber: 18 })
    ).toBe('Le Glove Hero de Minnesota, #18');
  });
});

describe('generatePseudonym - determinisme (replay-friendly)', () => {
  it('meme input -> meme output', () => {
    const opts: PseudonymOptions = {
      cityTag: 'Buffalo',
      bbPosition: 'Thrower',
      jerseyNumber: 17,
    };
    expect(generatePseudonym(opts)).toBe(generatePseudonym(opts));
  });

  it('100 appels successifs retournent la meme chaine', () => {
    const opts: PseudonymOptions = {
      cityTag: 'Philadelphia',
      bbPosition: 'BlackOrc',
      jerseyNumber: 11,
    };
    const first = generatePseudonym(opts);
    for (let i = 0; i < 100; i++) {
      expect(generatePseudonym(opts)).toBe(first);
    }
  });
});

describe('generatePseudonym - archetype overrides', () => {
  it('Thrower gunslinger -> "Gunslinger Wizard"', () => {
    const r = generatePseudonym({
      cityTag: 'Buffalo',
      bbPosition: 'Thrower',
      jerseyNumber: 17,
      archetype: 'gunslinger',
    });
    expect(r).toBe('Le Gunslinger Wizard de Buffalo, #17');
  });

  it('Thrower power -> "Cannon Thrower" (Allen-style)', () => {
    const r = generatePseudonym({
      cityTag: 'Buffalo',
      bbPosition: 'Thrower',
      jerseyNumber: 17,
      archetype: 'power',
    });
    expect(r).toBe('Le Cannon Thrower de Buffalo, #17');
  });

  it('Catcher speed -> "Vertical Burner" (Hill-style)', () => {
    const r = generatePseudonym({
      cityTag: 'Miami',
      bbPosition: 'Catcher',
      jerseyNumber: 10,
      archetype: 'speed',
    });
    expect(r).toBe('Le Vertical Burner de Miami, #10');
  });

  it('Catcher power -> "Mountain Hands" (AJ Brown-style)', () => {
    const r = generatePseudonym({
      cityTag: 'Philadelphia',
      bbPosition: 'Catcher',
      jerseyNumber: 11,
      archetype: 'power',
    });
    expect(r).toBe('Le Mountain Hands de Philadelphia, #11');
  });

  it('Blitzer power -> "Cement Blitzer"', () => {
    expect(
      generatePseudonym({ cityTag: 'Pittsburgh', bbPosition: 'Blitzer', jerseyNumber: 90, archetype: 'power' })
    ).toBe('Le Cement Blitzer de Pittsburgh, #90');
  });

  it('rookie archetype : Thrower-rookie -> "Rookie Thrower"', () => {
    expect(
      generatePseudonym({ cityTag: 'Chicago', bbPosition: 'Thrower', jerseyNumber: 18, archetype: 'rookie' })
    ).toContain('Rookie Thrower');
  });

  it('archetype sans override : retombe sur le descripteur standard', () => {
    // Lineman + speed = pas d'override -> "Trench Warrior"
    expect(
      generatePseudonym({ cityTag: 'Dallas', bbPosition: 'Lineman', jerseyNumber: 70, archetype: 'speed' })
    ).toBe('Le Trench Warrior de Dallas, #70');
  });
});

describe('generatePseudonym - tous les BbPosition ont un descripteur', () => {
  const allPositions = [
    'Lineman', 'Thrower', 'Catcher', 'Blitzer', 'Runner',
    'GutterRunner', 'StormVermin', 'RatOgre',
    'Wardancer', 'Treeman',
    'BlackOrc', 'Goblin', 'Troll',
    'Ogre',
    'Berserker', 'Ulfwerener', 'Yhetee',
    'Blocker', 'Trollslayer', 'Deathroller',
    'Bloodseeker', 'Khorngor', 'Bloodspawn', 'Bloodthirster',
    'Zombie', 'Ghoul', 'Wight', 'FleshGolem', 'Werewolf',
  ] as const;

  it('chaque BbPosition produit un pseudonyme non vide', () => {
    for (const pos of allPositions) {
      const result = generatePseudonym({ cityTag: 'Test', bbPosition: pos, jerseyNumber: 42 });
      expect(result).toMatch(/^Le [A-Z][\w ]+ de Test, #42$/);
    }
  });
});

describe('generatePseudonym - validation', () => {
  it('throw si cityTag vide', () => {
    expect(() =>
      generatePseudonym({ cityTag: '', bbPosition: 'Thrower', jerseyNumber: 15 })
    ).toThrow(/cityTag requis/);
  });

  it('throw si cityTag whitespace only', () => {
    expect(() =>
      generatePseudonym({ cityTag: '   ', bbPosition: 'Thrower', jerseyNumber: 15 })
    ).toThrow(/cityTag requis/);
  });

  it('throw si jerseyNumber negatif', () => {
    expect(() =>
      generatePseudonym({ cityTag: 'KC', bbPosition: 'Thrower', jerseyNumber: -1 })
    ).toThrow(/jerseyNumber/);
  });

  it('throw si jerseyNumber > 99', () => {
    expect(() =>
      generatePseudonym({ cityTag: 'KC', bbPosition: 'Thrower', jerseyNumber: 100 })
    ).toThrow(/jerseyNumber/);
  });

  it('throw si jerseyNumber non entier', () => {
    expect(() =>
      generatePseudonym({ cityTag: 'KC', bbPosition: 'Thrower', jerseyNumber: 15.5 })
    ).toThrow(/jerseyNumber/);
  });

  it('accepte jerseyNumber 0 (cas particulier valide)', () => {
    expect(
      generatePseudonym({ cityTag: 'KC', bbPosition: 'Thrower', jerseyNumber: 0 })
    ).toContain('#0');
  });

  it('accepte jerseyNumber 99', () => {
    expect(
      generatePseudonym({ cityTag: 'CLE', bbPosition: 'Deathroller', jerseyNumber: 99 })
    ).toContain('#99');
  });

  it('trim le cityTag', () => {
    expect(
      generatePseudonym({ cityTag: '  Kansas City  ', bbPosition: 'Thrower', jerseyNumber: 15 })
    ).toBe('Le Sidearm Wizard de Kansas City, #15');
  });
});

describe('generateShortPseudonym', () => {
  it('format compact "Descripteur #N Ville"', () => {
    expect(
      generateShortPseudonym({ cityTag: 'Kansas City', bbPosition: 'Thrower', jerseyNumber: 15 })
    ).toBe('Sidearm Wizard #15 Kansas City');
  });

  it('utilise les overrides archetype', () => {
    expect(
      generateShortPseudonym({ cityTag: 'Miami', bbPosition: 'Catcher', jerseyNumber: 10, archetype: 'speed' })
    ).toBe('Vertical Burner #10 Miami');
  });

  it('valide les inputs comme generatePseudonym', () => {
    expect(() =>
      generateShortPseudonym({ cityTag: '', bbPosition: 'Thrower', jerseyNumber: 15 })
    ).toThrow();
  });
});

describe('getDescriptor', () => {
  it('retourne juste le descripteur sans ville/jersey', () => {
    expect(getDescriptor('Thrower')).toBe('Sidearm Wizard');
    expect(getDescriptor('Deathroller')).toBe('Iron Roller');
    expect(getDescriptor('Werewolf')).toBe('Lunar Predator');
  });

  it('utilise l\'override archetype si fourni', () => {
    expect(getDescriptor('Thrower', 'gunslinger')).toBe('Gunslinger Wizard');
    expect(getDescriptor('Catcher', 'speed')).toBe('Vertical Burner');
  });

  it('retombe sur le standard si archetype sans override', () => {
    expect(getDescriptor('Lineman', 'speed')).toBe('Trench Warrior');
  });

  it('deterministe', () => {
    expect(getDescriptor('Thrower')).toBe(getDescriptor('Thrower'));
  });
});

describe('pas de noms reels exposes (Q8 + 01-legal.md)', () => {
  it('le pseudo ne doit JAMAIS contenir un vrai nom de joueur', () => {
    // Garde-fou : si quelqu\'un essaie de passer un realName, il doit
    // etre rejete par validateInputs ou ne pas affecter l'output.
    const result = generatePseudonym({
      cityTag: 'Kansas City',
      bbPosition: 'Thrower',
      jerseyNumber: 15,
    });
    expect(result).not.toContain('Mahomes');
    expect(result).not.toContain('Patrick');
  });

  it('le pseudo ne doit JAMAIS contenir un nom d\'equipe NFL', () => {
    const result = generatePseudonym({
      cityTag: 'Kansas City',
      bbPosition: 'Thrower',
      jerseyNumber: 15,
    });
    expect(result).not.toContain('Chiefs');
    expect(result).not.toContain('NFL');
  });
});
