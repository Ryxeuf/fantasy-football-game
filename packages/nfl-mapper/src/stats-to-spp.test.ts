import { describe, it, expect } from 'vitest';
import { applyCaptainMultiplier, computeSpp, type NflPlayerStatLine } from './stats-to-spp.js';

const baseQb = (overrides: Partial<NflPlayerStatLine> = {}): NflPlayerStatLine => ({
  bbPosition: 'Thrower',
  ...overrides,
});

const baseRb = (overrides: Partial<NflPlayerStatLine> = {}): NflPlayerStatLine => ({
  bbPosition: 'GutterRunner',
  rushYards: 1,
  ...overrides,
});

const baseWr = (overrides: Partial<NflPlayerStatLine> = {}): NflPlayerStatLine => ({
  bbPosition: 'Catcher',
  ...overrides,
});

const baseDe = (overrides: Partial<NflPlayerStatLine> = {}): NflPlayerStatLine => ({
  bbPosition: 'Blitzer',
  ...overrides,
});

const baseDt = (overrides: Partial<NflPlayerStatLine> = {}): NflPlayerStatLine => ({
  bbPosition: 'RatOgre',
  ...overrides,
});

const baseCb = (overrides: Partial<NflPlayerStatLine> = {}): NflPlayerStatLine => ({
  bbPosition: 'GutterRunner',
  ...overrides,
});

describe('computeSpp - Thrower (QB)', () => {
  it('Mahomes-style elite game (3 TD, 350 yd, 1 INT) = 12 SPP (doc example)', () => {
    const r = computeSpp(baseQb({ passYards: 350, passTd: 3, passInt: 1 }));
    // 3 TD * 3 + floor(350/75)=4 CP * 1 + (-1) malus = 9 + 4 - 1 = 12
    expect(r.totalSpp).toBe(12);
    expect(r.mvpEligible).toBe(true);
  });

  it('cape les passing yards a 4 CP max', () => {
    const r = computeSpp(baseQb({ passYards: 500, passTd: 0, passInt: 0 }));
    // 500/75 = 6.67 -> cap a 4 = 4 SPP
    expect(r.totalSpp).toBe(4);
  });

  it('handle negative INT correctement', () => {
    const r = computeSpp(baseQb({ passYards: 75, passTd: 0, passInt: 3 }));
    // floor(75/75)=1 CP - 3 INT malus = 1 - 3 = -2
    expect(r.totalSpp).toBe(-2);
    expect(r.mvpEligible).toBe(false);
  });

  it('compte les rushing TD du QB (Lamar / Allen)', () => {
    const r = computeSpp(baseQb({ passYards: 150, passTd: 2, rushTd: 1 }));
    // 2 pass TD * 3 + 1 rush TD * 3 + 2 CP = 6 + 3 + 2 = 11
    expect(r.totalSpp).toBe(11);
  });

  it('bonus CP si rushing yards QB >= 50 (Allen W1)', () => {
    const r = computeSpp(baseQb({ passYards: 394, passTd: 2, rushTd: 2, rushYards: 30 }));
    // 2 pass TD * 3 + 2 rush TD * 3 + floor(394/75)=4 CP = 6 + 6 + 4 = 16 (rush yards < 50, pas de bonus)
    expect(r.totalSpp).toBe(16);
  });

  it('zero stats = 0 SPP', () => {
    const r = computeSpp(baseQb({}));
    expect(r.totalSpp).toBe(0);
    expect(r.events).toHaveLength(0);
    expect(r.mvpEligible).toBe(false);
  });
});

describe('computeSpp - Runner / RB', () => {
  it('Henry 24/175, 2 TD, 1 fumble = 7 SPP (doc example)', () => {
    const r = computeSpp(baseRb({ rushYards: 175, rushTd: 2, fumbleLost: 1, bbPosition: 'BlackOrc' }));
    // 2 TD * 3 + 1 CP (>=75) + 1 CP (>=100) - 1 malus = 6 + 1 + 1 - 1 = 7
    expect(r.totalSpp).toBe(7);
  });

  it('cape les receptions a 3 CP pour RB', () => {
    const r = computeSpp(baseRb({ receptions: 10, rushYards: 1 }));
    // 3 CP * 1 = 3 (cap)
    expect(r.totalSpp).toBe(3);
  });

  it('bonus CP recv >=100 pour pass-catching RB', () => {
    const r = computeSpp(baseRb({ rushYards: 50, recYards: 120, receptions: 8 }));
    // 0 CP rush (<75), 3 CP recCapped + 1 CP bonus (>=100) = 3 + 1 = 4
    expect(r.totalSpp).toBe(4);
  });

  it('Jonathan Taylor W10 2025 (244 yd, 3 TD)', () => {
    const r = computeSpp(baseRb({ rushYards: 244, rushTd: 3, receptions: 3, recYards: 42 }));
    // 3 TD * 3 + 1 CP (>=75) + 1 CP (>=100) + 3 CP receptions = 9 + 1 + 1 + 3 = 14
    expect(r.totalSpp).toBe(14);
  });
});

describe('computeSpp - Catcher (WR / TE)', () => {
  it('Jefferson 8/142, 1 TD = 9 SPP (doc example)', () => {
    const r = computeSpp(baseWr({ receptions: 8, recYards: 142, recTd: 1 }));
    // 5 CP receptions (cap) + 1 TD * 3 + 1 CP bonus (>=100) = 5 + 3 + 1 = 9
    expect(r.totalSpp).toBe(9);
  });

  it('cape les receptions a 5 CP pour WR/TE', () => {
    const r = computeSpp(baseWr({ receptions: 15, recYards: 50 }));
    // 5 CP cap
    expect(r.totalSpp).toBe(5);
  });

  it('bonus +1 CP a 150 yds (gros match WR)', () => {
    const r = computeSpp(baseWr({ receptions: 10, recYards: 175, recTd: 2 }));
    // 5 CP cap + 2 TD * 3 + 1 CP (>=100) + 1 CP (>=150) = 5 + 6 + 1 + 1 = 13
    expect(r.totalSpp).toBe(13);
  });

  it('malus drops', () => {
    const r = computeSpp(baseWr({ receptions: 5, recYards: 80, drops: 2 }));
    // 5 CP - 2 drops = 5 - 2 = 3
    expect(r.totalSpp).toBe(3);
  });
});

describe('computeSpp - Big Guy (DT/NT)', () => {
  it('Donald-style 2 sacks + 1 FF = 6 SPP (doc example)', () => {
    const r = computeSpp(baseDt({ sacks: 2, forcedFumble: 1 }));
    // 2 CAS sacks * 2 + 1 DP FF * 2 = 4 + 2 = 6
    expect(r.totalSpp).toBe(6);
  });

  it('3 QB hits = 1 CAS (bonus)', () => {
    const r = computeSpp(baseDt({ qbHits: 6 }));
    // 6/3 = 2 CAS * 2 = 4
    expect(r.totalSpp).toBe(4);
  });

  it('fumble recovery rapporte 2 SPP', () => {
    const r = computeSpp(baseDt({ fumbleRecovery: 1 }));
    expect(r.totalSpp).toBe(2);
  });

  it('TD defensif rapporte 3 SPP', () => {
    const r = computeSpp(baseDt({ defTd: 1 }));
    expect(r.totalSpp).toBe(3);
  });

  it('zero stats = 0 SPP', () => {
    const r = computeSpp(baseDt({}));
    expect(r.totalSpp).toBe(0);
  });
});

describe('computeSpp - Blitzer defensif (DE/EDGE/LB)', () => {
  it('TJ Watt 8 tackles, 2 sacks, 1 FF = 6 SPP (doc example)', () => {
    const r = computeSpp(baseDe({ tackles: 8, sacks: 2, forcedFumble: 1 }));
    // 0 CAS tackles (<10) + 2 CAS sacks * 2 + 1 DP FF * 2 = 4 + 2 = 6
    expect(r.totalSpp).toBe(6);
  });

  it('10+ tackles bonus CAS', () => {
    const r = computeSpp(baseDe({ tackles: 11, sacks: 0 }));
    // 1 CAS pour >=10 tackles * 2 = 2
    expect(r.totalSpp).toBe(2);
  });

  it('TFL >= 2 bonus CP', () => {
    const r = computeSpp(baseDe({ tfl: 3 }));
    expect(r.totalSpp).toBe(1);
  });

  it('combo elite Will McDonald W10 2025 (4 sacks, 5 hits, 4 solo)', () => {
    const r = computeSpp(baseDe({ tackles: 4, sacks: 4 }));
    // 0 CAS tackles + 4 CAS sacks * 2 = 8
    expect(r.totalSpp).toBe(8);
  });

  it('INT rapporte DP', () => {
    const r = computeSpp(baseDe({ defInt: 1 }));
    expect(r.totalSpp).toBe(2);
  });
});

describe('computeSpp - Defensive Back (CB / S)', () => {
  it('Sauce-style 1 INT, 3 PBU = 5 SPP (doc example)', () => {
    const r = computeSpp(baseCb({ defInt: 1, passDefended: 3 }));
    // hasOffensiveStats = false -> scoreDefensiveBack
    // 1 INT * 2 + 3 PD * 1 = 2 + 3 = 5
    expect(r.totalSpp).toBe(5);
  });

  it('pick-six rapporte 5 SPP (TD + DP cumule)', () => {
    const r = computeSpp(baseCb({ defTd: 1 }));
    // 1 TD * 3 + 1 DP bonus * 2 = 3 + 2 = 5
    expect(r.totalSpp).toBe(5);
  });

  it('forced fumble par DB', () => {
    const r = computeSpp(baseCb({ forcedFumble: 1 }));
    expect(r.totalSpp).toBe(2);
  });
});

describe('computeSpp - Lineman OL (approche QB-derived)', () => {
  it('participation-based si aucun team context', () => {
    const r = computeSpp({ bbPosition: 'Lineman' });
    // 1 SPP participation (titulaire)
    expect(r.totalSpp).toBe(1);
    expect(r.events[0]?.reason).toContain('participation');
  });

  it('bonus si team rating >100', () => {
    const r = computeSpp({ bbPosition: 'Lineman', teamPassRating: 105, teamRushYards: 50, teamSacksAllowed: 3 });
    // 1 CP (rating > 100) = 1
    expect(r.totalSpp).toBe(1);
  });

  it('combo run-game elite (rating 110, rush 200, sacks 1)', () => {
    const r = computeSpp({ bbPosition: 'Lineman', teamPassRating: 110, teamRushYards: 200, teamSacksAllowed: 1 });
    // 1 CP rating + 1 CP rush + 1 CP sacks < 2 = 3
    expect(r.totalSpp).toBe(3);
  });

  it('malus si team sacks allowed >4', () => {
    const r = computeSpp({ bbPosition: 'Lineman', teamPassRating: 80, teamRushYards: 100, teamSacksAllowed: 5 });
    // -1 malus
    expect(r.totalSpp).toBe(-1);
  });

  it('Blocker Dwarf bénéficie de la même logique OL', () => {
    const r = computeSpp({ bbPosition: 'Blocker', teamPassRating: 105, teamRushYards: 200, teamSacksAllowed: 0 });
    expect(r.totalSpp).toBe(3);
  });

  it('Zombie Necromantic OL', () => {
    const r = computeSpp({ bbPosition: 'Zombie' });
    expect(r.totalSpp).toBe(1);
  });
});

describe('computeSpp - polyvalence Runner/Werewolf/Blitzer', () => {
  it('Runner Norse avec stats receveur -> mode offensif', () => {
    const r = computeSpp({ bbPosition: 'Runner', recYards: 80, receptions: 6, recTd: 1 });
    // scoreRunner branch : 1 TD * 3 + 3 CP cap = 6
    expect(r.totalSpp).toBe(6);
  });

  it('Runner Dwarf sans stats offensives -> mode défensif (CB derived)', () => {
    const r = computeSpp({ bbPosition: 'Runner', defInt: 1, passDefended: 2 });
    // scoreDefensiveBack : 1 INT * 2 + 2 PD = 4
    expect(r.totalSpp).toBe(4);
  });

  it('Blitzer Orc en mode offensif (RB power AJ Brown)', () => {
    const r = computeSpp({ bbPosition: 'Blitzer', rushYards: 90, rushTd: 1 });
    // scoreRunner : 1 TD * 3 + 1 CP (>=75) = 4
    expect(r.totalSpp).toBe(4);
  });
});

describe('computeSpp - mvpEligible', () => {
  it('eligible si totalSpp > 0', () => {
    const r = computeSpp(baseQb({ passYards: 75, passTd: 1 }));
    expect(r.mvpEligible).toBe(true);
  });

  it('NON eligible si totalSpp <= 0', () => {
    const r = computeSpp(baseQb({ passInt: 2 }));
    expect(r.totalSpp).toBeLessThanOrEqual(0);
    expect(r.mvpEligible).toBe(false);
  });
});

describe('determinisme', () => {
  it('meme input -> meme output (replay-friendly)', () => {
    const stat: NflPlayerStatLine = { bbPosition: 'Catcher', receptions: 8, recYards: 142, recTd: 1 };
    const r1 = computeSpp(stat);
    const r2 = computeSpp(stat);
    expect(r1).toEqual(r2);
  });
});

describe('applyCaptainMultiplier (Q3)', () => {
  it('captain x1.5 arrondi', () => {
    expect(applyCaptainMultiplier(10, 'captain')).toBe(15);
    expect(applyCaptainMultiplier(7, 'captain')).toBe(11); // 10.5 -> 11
    expect(applyCaptainMultiplier(5, 'captain')).toBe(8);  // 7.5 -> 8
  });

  it('vice x1.2 arrondi', () => {
    expect(applyCaptainMultiplier(10, 'vice')).toBe(12);
    expect(applyCaptainMultiplier(5, 'vice')).toBe(6);
  });

  it('none = identite', () => {
    expect(applyCaptainMultiplier(10, 'none')).toBe(10);
    expect(applyCaptainMultiplier(-2, 'none')).toBe(-2);
  });

  it('preserve les SPP negatifs (captain malus)', () => {
    expect(applyCaptainMultiplier(-4, 'captain')).toBe(-6);
  });
});
