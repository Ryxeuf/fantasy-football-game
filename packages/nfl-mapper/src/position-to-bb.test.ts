import { describe, it, expect } from 'vitest';
import {
  getBbPosition,
  getBbPositionRole,
  getBbPositionsForRace,
  NFL_POSITIONS,
  type BbPosition,
  type NflPosition,
} from './position-to-bb.js';
import { BB_RACES } from './types.js';

describe('getBbPosition - coverage exhaustive', () => {
  it('mappe chaque NflPosition vers une BbPosition valide pour chaque race', () => {
    for (const race of BB_RACES) {
      for (const pos of NFL_POSITIONS) {
        const bbPos = getBbPosition(pos, race);
        expect(bbPos).toBeTruthy();
      }
    }
  });

  it('normalise la casse et les espaces (input brut nflverse)', () => {
    expect(getBbPosition(' qb ', 'Skaven')).toBe('Thrower');
    expect(getBbPosition('Qb', 'Skaven')).toBe('Thrower');
    expect(getBbPosition('QB', 'Skaven')).toBe('Thrower');
  });

  it('retourne le default de la race pour un poste inconnu', () => {
    expect(getBbPosition('XXX', 'Skaven')).toBe('Lineman');
    expect(getBbPosition('XXX', 'Dwarf')).toBe('Blocker');
    expect(getBbPosition('XXX', 'Necromantic')).toBe('Zombie');
    expect(getBbPosition('XXX', 'Khorne')).toBe('Bloodseeker');
  });

  it('retourne le default pour une string vide (edge case nflverse)', () => {
    expect(getBbPosition('', 'Human')).toBe('Lineman');
  });
});

describe('getBbPosition - Skaven (speed/trickery)', () => {
  it('QB -> Thrower (Mahomes sidearm wizard)', () => {
    expect(getBbPosition('QB', 'Skaven')).toBe('Thrower');
  });

  it('WR et RB -> GutterRunner (speed core)', () => {
    expect(getBbPosition('WR', 'Skaven')).toBe('GutterRunner');
    expect(getBbPosition('RB', 'Skaven')).toBe('GutterRunner');
  });

  it('TE -> StormVermin (speed-blocker)', () => {
    expect(getBbPosition('TE', 'Skaven')).toBe('StormVermin');
  });

  it('DT -> RatOgre (Big Guy)', () => {
    expect(getBbPosition('DT', 'Skaven')).toBe('RatOgre');
    expect(getBbPosition('NT', 'Skaven')).toBe('RatOgre');
  });

  it('LB / DE / EDGE -> StormVermin', () => {
    expect(getBbPosition('LB', 'Skaven')).toBe('StormVermin');
    expect(getBbPosition('DE', 'Skaven')).toBe('StormVermin');
    expect(getBbPosition('EDGE', 'Skaven')).toBe('StormVermin');
  });

  it('CB / S -> GutterRunner (speed corner/safety)', () => {
    expect(getBbPosition('CB', 'Skaven')).toBe('GutterRunner');
    expect(getBbPosition('S', 'Skaven')).toBe('GutterRunner');
    expect(getBbPosition('SAF', 'Skaven')).toBe('GutterRunner');
  });
});

describe('getBbPosition - Wood Elf (finesse/agility)', () => {
  it('QB -> Thrower', () => {
    expect(getBbPosition('QB', 'WoodElf')).toBe('Thrower');
  });

  it('WR/TE -> Catcher (elite finesse)', () => {
    expect(getBbPosition('WR', 'WoodElf')).toBe('Catcher');
    expect(getBbPosition('TE', 'WoodElf')).toBe('Catcher');
  });

  it('DT -> Treeman (Big Guy unique)', () => {
    expect(getBbPosition('DT', 'WoodElf')).toBe('Treeman');
  });

  it('DE / LB -> Wardancer', () => {
    expect(getBbPosition('DE', 'WoodElf')).toBe('Wardancer');
    expect(getBbPosition('LB', 'WoodElf')).toBe('Wardancer');
  });
});

describe('getBbPosition - Orc (power/run-heavy)', () => {
  it('QB -> Thrower (pocket passer)', () => {
    expect(getBbPosition('QB', 'Orc')).toBe('Thrower');
  });

  it('RB power -> BlackOrc (Henry power)', () => {
    expect(getBbPosition('RB', 'Orc')).toBe('BlackOrc');
  });

  it('TE blocking -> BlackOrc', () => {
    expect(getBbPosition('TE', 'Orc')).toBe('BlackOrc');
  });

  it('DT -> Troll (Big Guy)', () => {
    expect(getBbPosition('DT', 'Orc')).toBe('Troll');
  });

  it('DE / LB -> Blitzer (TJ Watt, Parsons)', () => {
    expect(getBbPosition('DE', 'Orc')).toBe('Blitzer');
    expect(getBbPosition('LB', 'Orc')).toBe('Blitzer');
  });

  it('K / P -> Goblin (specialist)', () => {
    expect(getBbPosition('K', 'Orc')).toBe('Goblin');
    expect(getBbPosition('P', 'Orc')).toBe('Goblin');
  });
});

describe('getBbPosition - Human (balanced)', () => {
  it('QB -> Thrower (Prescott classic)', () => {
    expect(getBbPosition('QB', 'Human')).toBe('Thrower');
  });

  it('DT -> Ogre', () => {
    expect(getBbPosition('DT', 'Human')).toBe('Ogre');
  });

  it('RB versatile -> Blitzer', () => {
    expect(getBbPosition('RB', 'Human')).toBe('Blitzer');
  });
});

describe('getBbPosition - Norse (cold weather / Block)', () => {
  it('QB Allen -> Thrower', () => {
    expect(getBbPosition('QB', 'Norse')).toBe('Thrower');
  });

  it('DT -> Yhetee', () => {
    expect(getBbPosition('DT', 'Norse')).toBe('Yhetee');
  });

  it('DE / LB -> Berserker (Hutchinson)', () => {
    expect(getBbPosition('DE', 'Norse')).toBe('Berserker');
    expect(getBbPosition('LB', 'Norse')).toBe('Berserker');
  });

  it('RB power -> Ulfwerener', () => {
    expect(getBbPosition('RB', 'Norse')).toBe('Ulfwerener');
  });
});

describe('getBbPosition - Dwarf (slow/tough)', () => {
  it('QB -> Runner (pas de Thrower Dwarf)', () => {
    expect(getBbPosition('QB', 'Dwarf')).toBe('Runner');
  });

  it('OL -> Blocker', () => {
    expect(getBbPosition('OL', 'Dwarf')).toBe('Blocker');
    expect(getBbPosition('OT', 'Dwarf')).toBe('Blocker');
    expect(getBbPosition('G', 'Dwarf')).toBe('Blocker');
  });

  it('DT (Lawrence, Garrett) -> Deathroller', () => {
    expect(getBbPosition('DT', 'Dwarf')).toBe('Deathroller');
  });

  it('DE -> Blitzer', () => {
    expect(getBbPosition('DE', 'Dwarf')).toBe('Blitzer');
  });

  it('OLB -> Trollslayer (frenzy edge)', () => {
    expect(getBbPosition('OLB', 'Dwarf')).toBe('Trollslayer');
  });
});

describe('getBbPosition - Khorne (aggro chaos)', () => {
  it('QB -> Bloodseeker (avec Pass skill custom)', () => {
    expect(getBbPosition('QB', 'Khorne')).toBe('Bloodseeker');
  });

  it('DT -> Bloodthirster (Big Guy)', () => {
    expect(getBbPosition('DT', 'Khorne')).toBe('Bloodthirster');
  });

  it('WR / LB / CB -> Khorngor', () => {
    expect(getBbPosition('WR', 'Khorne')).toBe('Khorngor');
    expect(getBbPosition('LB', 'Khorne')).toBe('Khorngor');
    expect(getBbPosition('CB', 'Khorne')).toBe('Khorngor');
  });

  it('DE / RB / TE -> Bloodspawn', () => {
    expect(getBbPosition('DE', 'Khorne')).toBe('Bloodspawn');
    expect(getBbPosition('RB', 'Khorne')).toBe('Bloodspawn');
    expect(getBbPosition('TE', 'Khorne')).toBe('Bloodspawn');
  });
});

describe('getBbPosition - Necromantic (rebuild/dark)', () => {
  it('QB -> Ghoul (avec Pass skill)', () => {
    expect(getBbPosition('QB', 'Necromantic')).toBe('Ghoul');
  });

  it('OL -> Zombie (base lineman undead)', () => {
    expect(getBbPosition('OL', 'Necromantic')).toBe('Zombie');
    expect(getBbPosition('OT', 'Necromantic')).toBe('Zombie');
  });

  it('DT (Simmons) -> FleshGolem', () => {
    expect(getBbPosition('DT', 'Necromantic')).toBe('FleshGolem');
  });

  it('DE (Cam Jordan veteran) -> Werewolf', () => {
    expect(getBbPosition('DE', 'Necromantic')).toBe('Werewolf');
  });

  it('LB -> Wight', () => {
    expect(getBbPosition('LB', 'Necromantic')).toBe('Wight');
  });
});

describe('getBbPositionRole', () => {
  it('classe les postes generiques correctement', () => {
    expect(getBbPositionRole('Lineman')).toBe('lineman');
    expect(getBbPositionRole('Thrower')).toBe('specialist');
    expect(getBbPositionRole('Catcher')).toBe('specialist');
    expect(getBbPositionRole('Blitzer')).toBe('specialist');
  });

  it('classe tous les Big Guys', () => {
    const bigGuys: BbPosition[] = [
      'RatOgre', 'Treeman', 'Troll', 'Ogre',
      'Yhetee', 'Deathroller', 'Bloodthirster',
    ];
    for (const bg of bigGuys) {
      expect(getBbPositionRole(bg)).toBe('bigGuy');
    }
  });

  it('Bloodseeker, Zombie, Goblin, Blocker sont des linemen', () => {
    expect(getBbPositionRole('Bloodseeker')).toBe('lineman');
    expect(getBbPositionRole('Zombie')).toBe('lineman');
    expect(getBbPositionRole('Goblin')).toBe('lineman');
    expect(getBbPositionRole('Blocker')).toBe('lineman');
  });
});

describe('getBbPositionsForRace', () => {
  it('Skaven contient Lineman, Thrower, GutterRunner, StormVermin, RatOgre', () => {
    const positions = new Set(getBbPositionsForRace('Skaven'));
    expect(positions).toContain('Lineman');
    expect(positions).toContain('Thrower');
    expect(positions).toContain('GutterRunner');
    expect(positions).toContain('StormVermin');
    expect(positions).toContain('RatOgre');
  });

  it('Dwarf contient Blocker, Runner, Blitzer, Trollslayer, Deathroller', () => {
    const positions = new Set(getBbPositionsForRace('Dwarf'));
    expect(positions).toContain('Blocker');
    expect(positions).toContain('Runner');
    expect(positions).toContain('Blitzer');
    expect(positions).toContain('Trollslayer');
    expect(positions).toContain('Deathroller');
  });

  it('Necromantic contient les 5 undead types', () => {
    const positions = new Set(getBbPositionsForRace('Necromantic'));
    expect(positions).toContain('Zombie');
    expect(positions).toContain('Ghoul');
    expect(positions).toContain('Wight');
    expect(positions).toContain('FleshGolem');
    expect(positions).toContain('Werewolf');
  });

  it("ne contient pas les postes d'autres races", () => {
    const skaven = new Set(getBbPositionsForRace('Skaven'));
    expect(skaven).not.toContain('Wardancer');
    expect(skaven).not.toContain('Bloodthirster');

    const dwarf = new Set(getBbPositionsForRace('Dwarf'));
    expect(dwarf).not.toContain('Thrower');
    expect(dwarf).not.toContain('Catcher');
  });
});

describe('cas particuliers du mapping', () => {
  it('LAR (Wood Elf) WR Nacua -> Catcher', () => {
    expect(getBbPosition('WR', 'WoodElf')).toBe('Catcher');
  });

  it('BAL (Orc) QB Lamar -> Thrower (avec skill mobile en V2)', () => {
    expect(getBbPosition('QB', 'Orc')).toBe('Thrower');
  });

  it('IND (Dwarf) RB Jonathan Taylor -> Blocker (power lineman)', () => {
    expect(getBbPosition('RB', 'Dwarf')).toBe('Blocker');
  });

  it('CHI (Norse) WR DJ Moore -> Catcher', () => {
    expect(getBbPosition('WR', 'Norse')).toBe('Catcher');
  });
});

describe('integration getBbPosition + getBbPositionRole', () => {
  it('TE Necromantic = Wight = specialist', () => {
    const pos: NflPosition = 'TE';
    const bb = getBbPosition(pos, 'Necromantic');
    expect(bb).toBe('Wight');
    expect(getBbPositionRole(bb)).toBe('specialist');
  });

  it('DT Skaven = RatOgre = bigGuy', () => {
    const bb = getBbPosition('DT', 'Skaven');
    expect(getBbPositionRole(bb)).toBe('bigGuy');
  });

  it('K Orc = Goblin = lineman', () => {
    const bb = getBbPosition('K', 'Orc');
    expect(getBbPositionRole(bb)).toBe('lineman');
  });
});
