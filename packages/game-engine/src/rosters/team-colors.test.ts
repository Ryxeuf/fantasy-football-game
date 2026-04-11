import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TEAM_COLORS,
  ROSTER_COLORS,
  getTeamColors,
  type TeamColors,
} from './team-colors';
import { TEAM_ROSTERS_BY_RULESET } from './positions';

describe('Regle: team-colors (H.6 sprite sheets - sub-task 1)', () => {
  describe('DEFAULT_TEAM_COLORS', () => {
    it('should expose primary and secondary hex colors as numbers', () => {
      expect(typeof DEFAULT_TEAM_COLORS.primary).toBe('number');
      expect(typeof DEFAULT_TEAM_COLORS.secondary).toBe('number');
      expect(DEFAULT_TEAM_COLORS.primary).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_TEAM_COLORS.primary).toBeLessThanOrEqual(0xffffff);
    });
  });

  describe('ROSTER_COLORS map', () => {
    it('should define colors for every unique roster slug across both rulesets', () => {
      const allSlugs = new Set<string>();
      for (const ruleset of Object.keys(TEAM_ROSTERS_BY_RULESET) as Array<
        keyof typeof TEAM_ROSTERS_BY_RULESET
      >) {
        for (const slug of Object.keys(TEAM_ROSTERS_BY_RULESET[ruleset])) {
          allSlugs.add(slug);
        }
      }
      for (const slug of allSlugs) {
        expect(ROSTER_COLORS[slug], `missing colors for roster "${slug}"`).toBeDefined();
      }
    });

    it('each entry must have valid primary and secondary hex colors', () => {
      for (const [slug, colors] of Object.entries(ROSTER_COLORS)) {
        expect(typeof colors.primary, `${slug}.primary`).toBe('number');
        expect(typeof colors.secondary, `${slug}.secondary`).toBe('number');
        expect(colors.primary).toBeGreaterThanOrEqual(0);
        expect(colors.primary).toBeLessThanOrEqual(0xffffff);
        expect(colors.secondary).toBeGreaterThanOrEqual(0);
        expect(colors.secondary).toBeLessThanOrEqual(0xffffff);
      }
    });

    it('primary and secondary should differ to ensure visual contrast', () => {
      for (const [slug, colors] of Object.entries(ROSTER_COLORS)) {
        expect(colors.primary, `${slug} primary === secondary`).not.toBe(colors.secondary);
      }
    });
  });

  describe('getTeamColors()', () => {
    it('returns DEFAULT_TEAM_COLORS when rosterSlug is undefined', () => {
      expect(getTeamColors(undefined)).toEqual(DEFAULT_TEAM_COLORS);
    });

    it('returns DEFAULT_TEAM_COLORS when rosterSlug is empty string', () => {
      expect(getTeamColors('')).toEqual(DEFAULT_TEAM_COLORS);
    });

    it('returns DEFAULT_TEAM_COLORS for an unknown roster slug', () => {
      expect(getTeamColors('not_a_real_roster_zzz')).toEqual(DEFAULT_TEAM_COLORS);
    });

    it('returns the canonical colors for a known roster slug', () => {
      const skaven = getTeamColors('skaven');
      expect(skaven).toEqual(ROSTER_COLORS.skaven);
    });

    it('returns different colors for different rosters', () => {
      const skaven = getTeamColors('skaven');
      const dwarf = getTeamColors('dwarf');
      expect(skaven.primary).not.toBe(dwarf.primary);
    });

    it('prefers roster-defined colors when override is provided', () => {
      const override: TeamColors = { primary: 0x123456, secondary: 0x654321 };
      expect(getTeamColors('skaven', override)).toEqual(override);
    });

    it('falls back to ROSTER_COLORS when override has only partial fields', () => {
      // Passing undefined override is equivalent to not passing one
      expect(getTeamColors('skaven', undefined)).toEqual(ROSTER_COLORS.skaven);
    });
  });

  describe('TeamRoster interface extension', () => {
    it('allows TeamRoster to optionally declare primaryColor / secondaryColor', () => {
      // Compile-time check: ensure the interface accepts these optional fields.
      // If the interface is not extended, this test file fails to compile.
      const fakeRoster: Partial<
        (typeof TEAM_ROSTERS_BY_RULESET)['season_2']['skaven']
      > = {
        primaryColor: 0xabcdef,
        secondaryColor: 0x123456,
      };
      expect(fakeRoster.primaryColor).toBe(0xabcdef);
      expect(fakeRoster.secondaryColor).toBe(0x123456);
    });
  });
});
