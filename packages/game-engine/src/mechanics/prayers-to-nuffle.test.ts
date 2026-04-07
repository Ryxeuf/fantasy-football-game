import { describe, it, expect } from 'vitest';
import {
  PRAYERS_TABLE,
  applyPrayerEffect,
  type PrayerDefinition,
  type PrayerEffectResult,
} from './prayers-to-nuffle';
import { setup } from '../core/game-state';
import { makeRNG } from '../utils/rng';
import { GameState, TeamId } from '../core/types';

/** Helper: create a game state with players on both teams */
function setupWithPlayers(): GameState {
  const state = setup();
  // Ensure we have active players on both sides
  const withPlayers: GameState = {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      state: 'active' as const,
      stunned: false,
    })),
  };
  return withPlayers;
}

describe('Prayers to Nuffle', () => {
  describe('PRAYERS_TABLE', () => {
    it('has exactly 16 prayers (D16)', () => {
      expect(Object.keys(PRAYERS_TABLE).length).toBe(16);
    });

    it('has prayers for rolls 1 through 16', () => {
      for (let i = 1; i <= 16; i++) {
        expect(PRAYERS_TABLE[i]).toBeDefined();
        expect(PRAYERS_TABLE[i].id).toBeTruthy();
        expect(PRAYERS_TABLE[i].name).toBeTruthy();
        expect(PRAYERS_TABLE[i].nameFr).toBeTruthy();
        expect(PRAYERS_TABLE[i].description).toBeTruthy();
      }
    });

    it('has unique IDs for each prayer', () => {
      const ids = Object.values(PRAYERS_TABLE).map((p) => p.id);
      expect(new Set(ids).size).toBe(16);
    });
  });

  describe('applyPrayerEffect', () => {
    const underdogTeam: TeamId = 'A';
    const opponentTeam: TeamId = 'B';

    it('Prayer 1 — Treacherous Trapdoor: sends random opponent to reserves', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('trapdoor');
      const result = applyPrayerEffect(state, 1, underdogTeam, rng);

      // One opponent should be moved off-pitch (pos x:-1, y:-1)
      const offPitch = result.state.players.filter(
        (p) => p.team === opponentTeam && p.pos.x === -1 && p.pos.y === -1
      );
      expect(offPitch.length).toBeGreaterThanOrEqual(1);
      expect(result.description).toContain('Trapdoor');
    });

    it('Prayer 2 — Friends with the Ref: grants 1 bribe', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('friends-ref');
      const result = applyPrayerEffect(state, 2, underdogTeam, rng);

      expect(result.prayerEffect).toBeDefined();
      expect(result.prayerEffect?.type).toBe('bribe');
      expect(result.prayerEffect?.team).toBe(underdogTeam);
    });

    it('Prayer 3 — Stiletto: grants Stab to a random friendly player', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('stiletto');
      const result = applyPrayerEffect(state, 3, underdogTeam, rng);

      const modifiedPlayer = result.state.players.find(
        (p) => p.team === underdogTeam && p.skills.includes('stab')
      );
      expect(modifiedPlayer).toBeDefined();
    });

    it('Prayer 4 — Iron Man: grants Iron Hard Skin to a random friendly player', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('iron-man');
      const result = applyPrayerEffect(state, 4, underdogTeam, rng);

      const modifiedPlayer = result.state.players.find(
        (p) => p.team === underdogTeam && p.skills.includes('iron-hard-skin')
      );
      expect(modifiedPlayer).toBeDefined();
    });

    it('Prayer 5 — Knuckle Dusters: grants Mighty Blow (+1) to a random friendly player', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('knuckle');
      const result = applyPrayerEffect(state, 5, underdogTeam, rng);

      const modifiedPlayer = result.state.players.find(
        (p) => p.team === underdogTeam && p.skills.includes('mighty-blow')
      );
      expect(modifiedPlayer).toBeDefined();
    });

    it('Prayer 6 — Bad Habits: grants Loner (4+) to a random opponent', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('bad-habits');
      const result = applyPrayerEffect(state, 6, underdogTeam, rng);

      const modifiedPlayer = result.state.players.find(
        (p) => p.team === opponentTeam && p.skills.includes('loner')
      );
      expect(modifiedPlayer).toBeDefined();
    });

    it('Prayer 7 — Greasy Cleats: gives -1 MA to a random opponent', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('greasy');
      const result = applyPrayerEffect(state, 7, underdogTeam, rng);

      // Find an opponent whose MA decreased
      const originalOpponents = state.players.filter((p) => p.team === opponentTeam);
      const newOpponents = result.state.players.filter((p) => p.team === opponentTeam);
      const maReduced = newOpponents.some((np) => {
        const orig = originalOpponents.find((op) => op.id === np.id);
        return orig && np.ma === orig.ma - 1;
      });
      expect(maReduced).toBe(true);
    });

    it('Prayer 8 — Blessed Statue of Nuffle: +1 team re-roll', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('blessed');
      const result = applyPrayerEffect(state, 8, underdogTeam, rng);

      const rerollKey = underdogTeam === 'A' ? 'teamA' : 'teamB';
      expect(result.state.teamRerolls[rerollKey]).toBe(state.teamRerolls[rerollKey] + 1);
    });

    it('Prayer 9 — Moles Under the Pitch: random opponent placed prone (no armor)', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('moles');
      const result = applyPrayerEffect(state, 9, underdogTeam, rng);

      // One opponent should be knocked down (stunned but from prone placement)
      const proneOpponent = result.state.players.find(
        (p) => p.team === opponentTeam && p.stunned === true
      );
      expect(proneOpponent).toBeDefined();
    });

    it('Prayer 10 — Perfect Passing: grants +1 PA to a random friendly player', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('passing');
      const result = applyPrayerEffect(state, 10, underdogTeam, rng);

      const originalFriendlies = state.players.filter((p) => p.team === underdogTeam);
      const newFriendlies = result.state.players.filter((p) => p.team === underdogTeam);
      const paImproved = newFriendlies.some((np) => {
        const orig = originalFriendlies.find((op) => op.id === np.id);
        return orig && np.pa === orig.pa - 1; // Lower PA is better in BB
      });
      expect(paImproved).toBe(true);
    });

    it('Prayer 11 — Fan Interaction: random opponent is stunned', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('fan-interaction');
      const result = applyPrayerEffect(state, 11, underdogTeam, rng);

      const stunnedOpponent = result.state.players.find(
        (p) => p.team === opponentTeam && p.stunned === true
      );
      expect(stunnedOpponent).toBeDefined();
    });

    it('Prayer 12 — Necessary Violence: grants Mighty Blow and Piling On to friendly player', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('violence');
      const result = applyPrayerEffect(state, 12, underdogTeam, rng);

      const modifiedPlayer = result.state.players.find(
        (p) =>
          p.team === underdogTeam &&
          p.skills.includes('mighty-blow') &&
          p.skills.includes('piling-on')
      );
      expect(modifiedPlayer).toBeDefined();
    });

    it('Prayer 13 — Fouling Frenzy: grants 1 bribe', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('fouling');
      const result = applyPrayerEffect(state, 13, underdogTeam, rng);

      expect(result.prayerEffect).toBeDefined();
      expect(result.prayerEffect?.type).toBe('bribe');
      expect(result.prayerEffect?.team).toBe(underdogTeam);
    });

    it('Prayer 14 — Throw a Rock: random opponent takes injury roll', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('throw-rock');
      const result = applyPrayerEffect(state, 14, underdogTeam, rng);

      // At minimum, a player should be affected (stunned, KO, or worse)
      const affectedOpponent = result.state.players.find(
        (p) =>
          p.team === opponentTeam &&
          (p.stunned === true || p.state === 'knocked_out' || p.state === 'casualty')
      );
      expect(affectedOpponent).toBeDefined();
      expect(result.description).toContain('Rock');
    });

    it('Prayer 15 — Under Scrutiny: opponent penalized on fouls (tracked as effect)', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('scrutiny');
      const result = applyPrayerEffect(state, 15, underdogTeam, rng);

      expect(result.prayerEffect).toBeDefined();
      expect(result.prayerEffect?.type).toBe('foul-penalty');
      expect(result.prayerEffect?.team).toBe(opponentTeam);
    });

    it('Prayer 16 — Intensive Training: grants random primary skill to friendly player', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('intensive');
      const result = applyPrayerEffect(state, 16, underdogTeam, rng);

      // A friendly player should have gained a new skill
      const originalFriendlies = state.players.filter((p) => p.team === underdogTeam);
      const newFriendlies = result.state.players.filter((p) => p.team === underdogTeam);
      const skillGained = newFriendlies.some((np) => {
        const orig = originalFriendlies.find((op) => op.id === np.id);
        return orig && np.skills.length > orig.skills.length;
      });
      expect(skillGained).toBe(true);
    });

    it('returns unchanged state for invalid prayer number', () => {
      const state = setupWithPlayers();
      const rng = makeRNG('invalid');
      const result = applyPrayerEffect(state, 99, underdogTeam, rng);
      expect(result.state).toEqual(state);
    });

    it('handles team with no active players gracefully', () => {
      const state = setupWithPlayers();
      // Remove all opponent active players
      const noOpponents: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.team === opponentTeam ? { ...p, state: 'casualty' as const } : p
        ),
      };
      const rng = makeRNG('no-opponents');
      // Prayer 1 (Trapdoor) targets opponents — should handle gracefully
      const result = applyPrayerEffect(noOpponents, 1, underdogTeam, rng);
      expect(result.state).toBeDefined();
    });
  });
});
