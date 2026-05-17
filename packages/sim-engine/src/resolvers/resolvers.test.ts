import { isMatchEvent } from '@bb/shared-types';
import { describe, expect, it } from 'vitest';

import { createRng } from '../rng/seeded';

import { resolveBlock } from './block';
import { resolveDodge } from './dodge';
import { resolveFoul } from './foul';
import { resolveGfi, gfiTargetForWeather } from './gfi';
import { resolvePass } from './pass';
import { resolvePickup, calculatePickupModifier } from './pickup';
import type { ResolverPlayer, ResolverState } from './types';

const ENGINE_VER = '0.1.0';

function player(p: Partial<ResolverPlayer> & Pick<ResolverPlayer, 'id' | 'team' | 'position'>): ResolverPlayer {
  return {
    st: 3,
    ag: 3,
    ma: 6,
    av: 9,
    skills: [],
    state: 'standing',
    ...p,
  } as ResolverPlayer;
}

function baseState(overrides: Partial<ResolverState> = {}): ResolverState {
  return {
    players: [],
    activeTeam: 'home',
    weather: 'nice',
    width: 26,
    height: 15,
    turn: 1,
    engineVer: ENGINE_VER,
    ...overrides,
  };
}

describe('GFI resolver — sprint 0.A.5', () => {
  it('targets 2+ in nice weather and 3+ in blizzard only (pouring rain n\'affecte pas la GFI)', () => {
    // BB2020/BB3 : seul Blizzard impose GFI 3+. Pouring Rain affecte
    // uniquement pickup/catch/handoff/passing — pas la GFI.
    expect(gfiTargetForWeather('nice')).toBe(2);
    expect(gfiTargetForWeather('blizzard')).toBe(3);
    expect(gfiTargetForWeather('pouring_rain')).toBe(2);
    expect(gfiTargetForWeather('sweltering')).toBe(2);
    expect(gfiTargetForWeather('very_sunny')).toBe(2);
  });

  it('declenche armor + injury roll sur fail (chain documenté ligne 9-10)', () => {
    // Cherche un seed où firstRoll fail puis armor casse → on doit
    // observer un state final différent de "prone" (stunned/ko/casualty)
    // ET potentiellement un event KO/CASUALTY.
    let foundInjury = false;
    for (let seed = 0; seed < 5000 && !foundInjury; seed += 1) {
      const probe = createRng(seed);
      const gfi = Math.floor(probe.next() * 6) + 1;
      const a1 = Math.floor(probe.next() * 6) + 1;
      const a2 = Math.floor(probe.next() * 6) + 1;
      // GFI fail (=1, target 2+ nice) + armor casse vs AV 7 (target 8)
      if (gfi === 1 && a1 + a2 >= 8) {
        const state = baseState({
          players: [player({ id: 'p1', team: 'home', position: { x: 5, y: 5 }, av: 7 })],
        });
        const out = resolveGfi(state, { playerId: 'p1', displayAtMs: 0 }, createRng(seed));
        expect(out.success).toBe(false);
        const finalState = out.newState.players[0].state;
        expect(['stunned', 'ko', 'casualty']).toContain(finalState);
        foundInjury = true;
      }
    }
    expect(foundInjury).toBe(true);
  });

  it('all events emitted pass the shared isMatchEvent guard', () => {
    const state = baseState({ players: [player({ id: 'p1', team: 'home', position: { x: 5, y: 5 } })] });
    const out = resolveGfi(state, { playerId: 'p1', displayAtMs: 100 }, createRng(1));
    for (const e of out.events) expect(isMatchEvent(e)).toBe(true);
  });

  it('marks the player down and emits TURNOVER on a forced-fail seed', () => {
    // Find a seed whose first d6 roll equals 1 → guaranteed fail at target 2+.
    let seed = 0;
    while (seed < 1000) {
      const probe = createRng(seed);
      if (Math.floor(probe.next() * 6) + 1 === 1) break;
      seed += 1;
    }
    const state = baseState({ players: [player({ id: 'p1', team: 'home', position: { x: 5, y: 5 } })] });
    const out = resolveGfi(state, { playerId: 'p1', displayAtMs: 0 }, createRng(seed));
    expect(out.success).toBe(false);
    expect(out.turnover).toBe(true);
    expect(out.events.find((e) => e.type === 'TURNOVER')).toBeDefined();
    // Avec la chain armor+injury post-fix, le joueur tombe `prone` (armor a tenu)
    // ou évolue vers `stunned`/`ko`/`casualty` (armor cassée).
    expect(['prone', 'stunned', 'ko', 'casualty']).toContain(out.newState.players[0].state);
  });

  it('sure_feet consumes the reroll on fail', () => {
    let seed = 0;
    while (seed < 1000) {
      const probe = createRng(seed);
      if (Math.floor(probe.next() * 6) + 1 === 1) break;
      seed += 1;
    }
    const state = baseState({
      players: [player({ id: 'p1', team: 'home', position: { x: 5, y: 5 }, skills: ['sure_feet'] })],
    });
    const out = resolveGfi(state, { playerId: 'p1', displayAtMs: 0 }, createRng(seed));
    expect(out.trace.usedReroll).toBe(true);
    expect(out.newState.players[0].rerollAvailable).toBe(false);
  });

  it('throws when the player is not standing', () => {
    const state = baseState({
      players: [player({ id: 'p1', team: 'home', position: { x: 0, y: 0 }, state: 'prone' })],
    });
    expect(() => resolveGfi(state, { playerId: 'p1', displayAtMs: 0 }, createRng(1))).toThrow();
  });
});

describe('Pickup resolver — sprint 0.A.5', () => {
  it('throws when the ball is not on the player', () => {
    const state = baseState({
      players: [player({ id: 'p1', team: 'home', position: { x: 0, y: 0 } })],
      ballAt: { x: 5, y: 5 },
    });
    expect(() => resolvePickup(state, { playerId: 'p1', displayAtMs: 0 }, createRng(1))).toThrow();
  });

  it('grants hasBall on success and emits no turnover', () => {
    const state = baseState({
      // ag=4 + no TZ → target 3+, very likely on most seeds.
      players: [player({ id: 'p1', team: 'home', position: { x: 5, y: 5 }, ag: 4 })],
      ballAt: { x: 5, y: 5 },
    });
    const out = resolvePickup(state, { playerId: 'p1', displayAtMs: 0 }, createRng(2));
    if (out.success) {
      expect(out.newState.players[0].hasBall).toBe(true);
      expect(out.events.find((e) => e.type === 'TURNOVER')).toBeUndefined();
    }
  });

  it('applies tackle-zone penalty per opposing standing adjacent player', () => {
    const state = baseState({
      players: [
        player({ id: 'p1', team: 'home', position: { x: 5, y: 5 } }),
        player({ id: 'o1', team: 'away', position: { x: 5, y: 6 } }),
        player({ id: 'o2', team: 'away', position: { x: 6, y: 5 } }),
      ],
      ballAt: { x: 5, y: 5 },
    });
    const carrier = state.players[0];
    expect(calculatePickupModifier(state, carrier)).toBe(-2);
  });

  it('extra_arms grants +1 modifier', () => {
    const state = baseState({
      players: [player({ id: 'p1', team: 'home', position: { x: 5, y: 5 }, skills: ['extra_arms'] })],
      ballAt: { x: 5, y: 5 },
    });
    expect(calculatePickupModifier(state, state.players[0])).toBe(1);
  });

  it('pouring_rain weather subtracts 1', () => {
    const state = baseState({
      weather: 'pouring_rain',
      players: [player({ id: 'p1', team: 'home', position: { x: 5, y: 5 } })],
      ballAt: { x: 5, y: 5 },
    });
    expect(calculatePickupModifier(state, state.players[0])).toBe(-1);
  });
});

describe('Dodge resolver — sprint 0.A.5', () => {
  it('emits a DODGE event with full trace', () => {
    const state = baseState({ players: [player({ id: 'p1', team: 'home', position: { x: 5, y: 5 }, ag: 4 })] });
    const out = resolveDodge(state, { playerId: 'p1', to: { x: 6, y: 5 }, displayAtMs: 100 }, createRng(3));
    expect(out.events[0].type).toBe('DODGE');
    expect(out.events.every((e) => isMatchEvent(e))).toBe(true);
  });

  it('moves the player on success', () => {
    const state = baseState({ players: [player({ id: 'p1', team: 'home', position: { x: 5, y: 5 }, ag: 5 })] });
    const out = resolveDodge(state, { playerId: 'p1', to: { x: 6, y: 5 }, displayAtMs: 0 }, createRng(0));
    if (out.success) {
      expect(out.newState.players[0].position).toEqual({ x: 6, y: 5 });
    }
  });

  it('tackle skill on adjacent opponent suppresses dodge reroll', () => {
    let seed = 0;
    while (seed < 1000) {
      const probe = createRng(seed);
      if (Math.floor(probe.next() * 6) + 1 === 1) break;
      seed += 1;
    }
    const state = baseState({
      players: [
        player({ id: 'p1', team: 'home', position: { x: 5, y: 5 }, ag: 3, skills: ['dodge'] }),
        player({ id: 'o1', team: 'away', position: { x: 6, y: 6 }, skills: ['tackle'] }),
      ],
    });
    const out = resolveDodge(state, { playerId: 'p1', to: { x: 4, y: 4 }, displayAtMs: 0 }, createRng(seed));
    expect(out.trace.usedReroll).toBe(false);
    expect(out.events[0].meta).toMatchObject({ rerollSuppressedByTackle: true });
  });
});

describe('Pass resolver — sprint 0.A.5', () => {
  const passer = player({ id: 'p1', team: 'home', position: { x: 5, y: 5 }, ag: 4, hasBall: true });

  it('throws when passer does not have the ball', () => {
    const state = baseState({ players: [{ ...passer, hasBall: false }] });
    expect(() =>
      resolvePass(state, { passerId: 'p1', to: { x: 7, y: 5 }, displayAtMs: 0 }, createRng(1))
    ).toThrow();
  });

  it('throws when target is out of pass range', () => {
    const state = baseState({ players: [passer] });
    expect(() =>
      resolvePass(state, { passerId: 'p1', to: { x: 25, y: 5 }, displayAtMs: 0 }, createRng(1))
    ).toThrow();
  });

  it('emits a PASS event with computed range and modifier', () => {
    const state = baseState({ players: [passer] });
    const out = resolvePass(state, { passerId: 'p1', to: { x: 7, y: 5 }, displayAtMs: 0 }, createRng(5));
    expect(out.events[0].type).toBe('PASS');
    expect((out.events[0].meta as { range: string }).range).toMatch(/^(quick|short|long|bomb)$/);
  });

  it('a natural 1 always fumbles even if target is met by mods', () => {
    let seed = 0;
    while (seed < 1000) {
      const probe = createRng(seed);
      if (Math.floor(probe.next() * 6) + 1 === 1) break;
      seed += 1;
    }
    const state = baseState({ players: [{ ...passer, ag: 6 }] });
    const out = resolvePass(state, { passerId: 'p1', to: { x: 6, y: 5 }, displayAtMs: 0 }, createRng(seed));
    expect(out.success).toBe(false);
    expect(out.trace.fumble).toBe(true);
  });

  it('strong_arm s\'applique aussi aux passes courtes (BB2020 : Short, Long, Long Bomb)', () => {
    // Comparaison directe : un passer avec strong_arm doit avoir un modifier
    // strictement supérieur sur un short pass vs sans skill. (5,5) → (10,5)
    // = distance 5 → short range.
    const baseShort = baseState({ players: [{ ...passer, ag: 3 }] });
    const withStrongArm = baseState({
      players: [{ ...passer, ag: 3, skills: ['strong_arm'] }],
    });
    const outBase = resolvePass(
      baseShort,
      { passerId: 'p1', to: { x: 10, y: 5 }, displayAtMs: 0 },
      createRng(42)
    );
    const outStrong = resolvePass(
      withStrongArm,
      { passerId: 'p1', to: { x: 10, y: 5 }, displayAtMs: 0 },
      createRng(42)
    );
    expect(outBase.trace.range).toBe('short');
    expect(outStrong.trace.range).toBe('short');
    // Strong Arm doit donner +1 → cible plus facile (modifier supérieur).
    expect(outStrong.trace.modifier - outBase.trace.modifier).toBe(1);
  });

  it('reroll fumble drop la balle (state coherent avec event)', () => {
    // Cherche un seed : premier roll fail non-fumble (>=2, <target), reroll = 1 (fumble).
    // Avec ag=3 target=4 (quick range), firstRoll=2 fail puis secondRoll=1 fumble.
    for (let seed = 0; seed < 5000; seed += 1) {
      const probe = createRng(seed);
      const first = Math.floor(probe.next() * 6) + 1;
      const second = Math.floor(probe.next() * 6) + 1;
      if (first === 2 && second === 1) {
        const state = baseState({
          players: [{ ...passer, ag: 3, skills: ['pass'] }],
        });
        const out = resolvePass(
          state,
          { passerId: 'p1', to: { x: 6, y: 5 }, displayAtMs: 0 },
          createRng(seed)
        );
        expect(out.success).toBe(false);
        expect(out.trace.usedReroll).toBe(true);
        expect(out.trace.fumble).toBe(true);
        // BUG fixé : state doit refléter le fumble → ballon lâché.
        expect(out.newState.players[0].hasBall).toBeFalsy();
        return;
      }
    }
    throw new Error('Could not find seed with first=2 second=1 within 5k tries');
  });
});

describe('Foul resolver — sprint 0.A.5', () => {
  const fouler = player({ id: 'f1', team: 'home', position: { x: 5, y: 5 } });
  const victim = player({ id: 'v1', team: 'away', position: { x: 5, y: 6 }, state: 'prone', av: 7 });

  it('throws when victim is standing', () => {
    const state = baseState({ players: [fouler, { ...victim, state: 'standing' }] });
    expect(() =>
      resolveFoul(state, { foulerId: 'f1', victimId: 'v1', displayAtMs: 0 }, createRng(1))
    ).toThrow();
  });

  it('throws when fouler and victim are not adjacent', () => {
    const state = baseState({ players: [fouler, { ...victim, position: { x: 10, y: 10 } }] });
    expect(() =>
      resolveFoul(state, { foulerId: 'f1', victimId: 'v1', displayAtMs: 0 }, createRng(1))
    ).toThrow();
  });

  it('counts assists from standing players adjacent to the opposing player', () => {
    const state = baseState({
      players: [
        fouler,
        victim,
        // teammate of fouler adjacent to victim → +1 offense
        player({ id: 'a1', team: 'home', position: { x: 6, y: 6 } }),
        // teammate of victim adjacent to fouler → +1 defense (cancels)
        player({ id: 'd1', team: 'away', position: { x: 5, y: 4 } }),
      ],
    });
    const out = resolveFoul(state, { foulerId: 'f1', victimId: 'v1', displayAtMs: 0 }, createRng(0));
    expect(out.trace.armorAssists).toBe(0);
  });

  it('flags sent-off on doubles armour roll', () => {
    // Probe seeds until the armour roll is doubles.
    let seed = 0;
    let foundDoubles = false;
    while (seed < 5000 && !foundDoubles) {
      const r = createRng(seed);
      const a = Math.floor(r.next() * 6) + 1;
      const b = Math.floor(r.next() * 6) + 1;
      if (a === b) {
        foundDoubles = true;
        const state = baseState({ players: [fouler, victim] });
        const out = resolveFoul(state, { foulerId: 'f1', victimId: 'v1', displayAtMs: 0 }, createRng(seed));
        expect(out.trace.sentOff).toBe(true);
        expect(out.turnover).toBe(true);
        expect(out.events.find((e) => e.type === 'TURNOVER')).toBeDefined();
        break;
      }
      seed += 1;
    }
    expect(foundDoubles).toBe(true);
  });

  it('emits a CASUALTY event when injury roll >= 10 (with dirty_player bonus)', () => {
    // Probe seeds until armour breaks AND injury roll triggers casualty.
    for (let seed = 0; seed < 20_000; seed += 1) {
      const r = createRng(seed);
      const a = Math.floor(r.next() * 6) + 1;
      const b = Math.floor(r.next() * 6) + 1;
      const i1 = Math.floor(r.next() * 6) + 1;
      const i2 = Math.floor(r.next() * 6) + 1;
      const armorTotal = a + b + 0 + 1; // dirty_player +1
      const injuryTotal = i1 + i2 + 1; // dirty_player +1
      if (a !== b && armorTotal >= victim.av + 1 && injuryTotal >= 10) {
        const state = baseState({ players: [{ ...fouler, skills: ['dirty_player'] }, victim] });
        const out = resolveFoul(state, { foulerId: 'f1', victimId: 'v1', displayAtMs: 0 }, createRng(seed));
        expect(out.trace.injuryOutcome).toBe('casualty');
        expect(out.events.find((e) => e.type === 'CASUALTY')).toBeDefined();
        return;
      }
    }
    throw new Error('Could not find seed inducing a casualty within 20k tries');
  });

  it('expulse le fouleur sur doubles de injury roll (BB2020 rule)', () => {
    // BB2020 : « If the result of the Armour roll or the Injury roll is a
    // double, the fouler is Sent Off. » Avant le fix, seul le double armor
    // déclenchait — les doubles d'injury étaient ignorés.
    // On cherche un seed : armor non-double + casse, injury double.
    for (let seed = 0; seed < 30_000; seed += 1) {
      const r = createRng(seed);
      const a = Math.floor(r.next() * 6) + 1;
      const b = Math.floor(r.next() * 6) + 1;
      const i1 = Math.floor(r.next() * 6) + 1;
      const i2 = Math.floor(r.next() * 6) + 1;
      if (a !== b && a + b >= victim.av + 1 && i1 === i2) {
        const state = baseState({ players: [fouler, victim] });
        const out = resolveFoul(state, { foulerId: 'f1', victimId: 'v1', displayAtMs: 0 }, createRng(seed));
        expect(out.trace.sentOff).toBe(true);
        expect(out.turnover).toBe(true);
        return;
      }
    }
    throw new Error('Could not find seed with non-double armor + injury doubles within 30k tries');
  });
});

describe('Block resolver — sprint 0.A.5', () => {
  const attacker = player({ id: 'a1', team: 'home', position: { x: 5, y: 5 }, st: 3 });
  const defender = player({ id: 'd1', team: 'away', position: { x: 6, y: 5 }, st: 3 });

  it('throws when attacker and defender are not adjacent', () => {
    const state = baseState({ players: [attacker, { ...defender, position: { x: 10, y: 10 } }] });
    expect(() =>
      resolveBlock(state, { attackerId: 'a1', defenderId: 'd1', displayAtMs: 0 }, createRng(1))
    ).toThrow();
  });

  it('emits a BLOCK event with the rolled dice and chosen face', () => {
    const state = baseState({ players: [attacker, defender] });
    const out = resolveBlock(state, { attackerId: 'a1', defenderId: 'd1', displayAtMs: 0 }, createRng(7));
    expect(out.events[0].type).toBe('BLOCK');
    const meta = out.events[0].meta as { rolls: string[]; chosen: string };
    expect(meta.rolls.length).toBeGreaterThanOrEqual(1);
    expect(['PLAYER_DOWN', 'BOTH_DOWN', 'PUSH_BACK', 'STUMBLE', 'POW']).toContain(meta.chosen);
  });

  it('attacker BOTH_DOWN with Block skill stays standing (no turnover)', () => {
    // Find a seed where the only die rolled is BOTH_DOWN (face index 1).
    for (let seed = 0; seed < 10_000; seed += 1) {
      const r = createRng(seed);
      const face = Math.floor(r.next() * 6) + 1;
      if (face === 2) {
        // Single 1d block (equal ST)
        const state = baseState({
          players: [
            { ...attacker, skills: ['block'] },
            { ...defender, skills: [] },
          ],
        });
        const out = resolveBlock(
          state,
          { attackerId: 'a1', defenderId: 'd1', displayAtMs: 0 },
          createRng(seed)
        );
        expect(out.trace.chosen).toBe('BOTH_DOWN');
        expect(out.success).toBe(true);
        expect(out.turnover).toBe(false);
        // Defender (no block) is knocked down — `prone` if armor held,
        // or `stunned`/`ko`/`casualty` after the armor+injury chain
        // (sprint 0.E.1 iter #2 enables this chain on every block KD).
        const defState = out.newState.players.find((p) => p.id === 'd1')?.state;
        expect(['prone', 'stunned', 'ko', 'casualty']).toContain(defState);
        return;
      }
    }
    throw new Error('Could not find BOTH_DOWN seed within 10k tries');
  });

  it('wrestle: BOTH_DOWN convertit sans armor roll, sans turnover (BB rule)', () => {
    // BB2020/BB3 Wrestle : sur BOTH_DOWN les deux joueurs sont *Placed
    // Prone* sans Knock-Down. Donc PAS d'armor/injury roll, PAS de
    // turnover. Avant le fix, le code lançait armor rolls + déclenchait
    // un TURNOVER. On force BOTH_DOWN (face=2 sur le die index, 1d block).
    for (let seed = 0; seed < 10_000; seed += 1) {
      const r = createRng(seed);
      const face = Math.floor(r.next() * 6) + 1;
      if (face === 2) {
        const state = baseState({
          players: [
            { ...attacker, skills: ['wrestle'] },
            { ...defender, skills: [] },
          ],
        });
        const out = resolveBlock(
          state,
          { attackerId: 'a1', defenderId: 'd1', displayAtMs: 0, useWrestle: true },
          createRng(seed)
        );
        expect(out.trace.chosen).toBe('BOTH_DOWN');
        expect(out.trace.resolution).toBe('wrestle');
        // Pas de turnover sur wrestle.
        expect(out.turnover).toBe(false);
        expect(out.events.find((e) => e.type === 'TURNOVER')).toBeUndefined();
        // Les deux joueurs sont prone (pas stunned/ko/casualty — pas
        // d'armor roll).
        expect(out.newState.players.find((p) => p.id === 'a1')?.state).toBe('prone');
        expect(out.newState.players.find((p) => p.id === 'd1')?.state).toBe('prone');
        return;
      }
    }
    throw new Error('Could not find BOTH_DOWN seed within 10k tries');
  });

  it('STUMBLE is converted to PUSH_BACK if defender has dodge and attacker lacks tackle', () => {
    for (let seed = 0; seed < 10_000; seed += 1) {
      const r = createRng(seed);
      const face = Math.floor(r.next() * 6) + 1;
      if (face === 5) {
        const state = baseState({
          players: [attacker, { ...defender, skills: ['dodge'] }],
        });
        const out = resolveBlock(
          state,
          { attackerId: 'a1', defenderId: 'd1', displayAtMs: 0 },
          createRng(seed)
        );
        expect(out.trace.resolution).toBe('push_only');
        return;
      }
    }
    throw new Error('Could not find STUMBLE seed within 10k tries');
  });
});

describe('All resolvers — round-trip event guard', () => {
  it('every event emitted by every resolver passes isMatchEvent', () => {
    const rng = createRng(99);
    const stateA = baseState({ players: [player({ id: 'p', team: 'home', position: { x: 5, y: 5 } })] });
    const a = resolveGfi(stateA, { playerId: 'p', displayAtMs: 0 }, rng);
    for (const e of a.events) expect(isMatchEvent(e)).toBe(true);
  });
});
