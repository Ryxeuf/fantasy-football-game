import { describe, it, expect } from 'vitest';
import {
  TEAM_SPRITE_MANIFESTS,
  getTeamSpriteManifest,
  hasTeamSprite,
  isTeamSpriteManifest,
  type TeamSpriteManifest,
} from './team-sprites';
import { ROSTER_COLORS, getTeamColors } from './team-colors';

describe('Regle: team-sprites (H.6 sprite sheets - sub-task 4)', () => {
  describe('TeamSpriteManifest shape', () => {
    it('accepts a minimal manifest (atlas + frames) via structural typing', () => {
      const manifest: TeamSpriteManifest = {
        atlasUrl: '/images/team-sprites/skaven.png',
        frames: {
          idle: { x: 0, y: 0, w: 32, h: 32 },
          down: { x: 32, y: 0, w: 32, h: 32 },
        },
      };
      expect(manifest.atlasUrl).toBe('/images/team-sprites/skaven.png');
      expect(manifest.frames.idle.w).toBe(32);
    });

    it('accepts an optional tint override', () => {
      const manifest: TeamSpriteManifest = {
        atlasUrl: '/images/team-sprites/dwarf.png',
        frames: { idle: { x: 0, y: 0, w: 32, h: 32 } },
        tint: 0xabcdef,
      };
      expect(manifest.tint).toBe(0xabcdef);
    });
  });

  describe('TEAM_SPRITE_MANIFESTS registry', () => {
    it('is a plain object (even if empty for now)', () => {
      expect(typeof TEAM_SPRITE_MANIFESTS).toBe('object');
      expect(TEAM_SPRITE_MANIFESTS).not.toBeNull();
    });

    it('every entry must be a structurally valid TeamSpriteManifest', () => {
      for (const [slug, manifest] of Object.entries(TEAM_SPRITE_MANIFESTS)) {
        expect(isTeamSpriteManifest(manifest), `${slug} manifest shape`).toBe(true);
      }
    });

    it('every entry key should correspond to a known roster color slug', () => {
      // Shipping a sprite for a roster that has no canonical colors would be a
      // consistency bug: the fallback tint would point to DEFAULT_TEAM_COLORS.
      for (const slug of Object.keys(TEAM_SPRITE_MANIFESTS)) {
        expect(ROSTER_COLORS[slug], `sprite for unknown roster "${slug}"`).toBeDefined();
      }
    });
  });

  describe('getTeamSpriteManifest()', () => {
    it('returns null when rosterSlug is undefined', () => {
      expect(getTeamSpriteManifest(undefined)).toBeNull();
    });

    it('returns null when rosterSlug is empty string', () => {
      expect(getTeamSpriteManifest('')).toBeNull();
    });

    it('returns null for an unknown roster slug', () => {
      expect(getTeamSpriteManifest('not_a_real_roster_zzz')).toBeNull();
    });

    it('returns the canonical manifest for a known registered slug', () => {
      // Register a temporary sprite for the sake of the test by monkey-patching
      // the read-only map at runtime. We restore it immediately after.
      const testSlug = '__test_sprite__';
      const fakeManifest: TeamSpriteManifest = {
        atlasUrl: '/images/team-sprites/test.png',
        frames: { idle: { x: 0, y: 0, w: 16, h: 16 } },
      };
      (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[testSlug] =
        fakeManifest;
      try {
        expect(getTeamSpriteManifest(testSlug)).toEqual(fakeManifest);
      } finally {
        delete (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[
          testSlug
        ];
      }
    });
  });

  describe('hasTeamSprite()', () => {
    it('returns false when rosterSlug is undefined', () => {
      expect(hasTeamSprite(undefined)).toBe(false);
    });

    it('returns false for an unknown roster slug', () => {
      expect(hasTeamSprite('not_a_real_roster_zzz')).toBe(false);
    });

    it('returns true when a manifest is registered for the slug', () => {
      const testSlug = '__test_sprite_has__';
      (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[testSlug] = {
        atlasUrl: '/a.png',
        frames: { idle: { x: 0, y: 0, w: 1, h: 1 } },
      };
      try {
        expect(hasTeamSprite(testSlug)).toBe(true);
      } finally {
        delete (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[
          testSlug
        ];
      }
    });

    it('by default returns false for every known roster (no sprites shipped yet)', () => {
      // This is a renderer-fallback invariant: until sub-task 5/5 actually
      // ships the PNG atlases, every known roster MUST fall back to the
      // circle Graphics path. Flipping this to `true` prematurely would
      // break the board rendering.
      for (const slug of Object.keys(ROSTER_COLORS)) {
        if (slug.startsWith('__test_')) continue;
        expect(hasTeamSprite(slug), `unexpected sprite for "${slug}"`).toBe(false);
      }
    });
  });

  describe('isTeamSpriteManifest() type guard', () => {
    it('accepts a well-formed manifest', () => {
      expect(
        isTeamSpriteManifest({
          atlasUrl: '/a.png',
          frames: { idle: { x: 0, y: 0, w: 8, h: 8 } },
        }),
      ).toBe(true);
    });

    it('rejects null / undefined / primitives', () => {
      expect(isTeamSpriteManifest(null)).toBe(false);
      expect(isTeamSpriteManifest(undefined)).toBe(false);
      expect(isTeamSpriteManifest('a string')).toBe(false);
      expect(isTeamSpriteManifest(42)).toBe(false);
    });

    it('rejects objects missing atlasUrl', () => {
      expect(
        isTeamSpriteManifest({ frames: { idle: { x: 0, y: 0, w: 1, h: 1 } } }),
      ).toBe(false);
    });

    it('rejects objects missing frames map', () => {
      expect(isTeamSpriteManifest({ atlasUrl: '/a.png' })).toBe(false);
    });

    it('rejects manifests with a malformed frame entry', () => {
      expect(
        isTeamSpriteManifest({
          atlasUrl: '/a.png',
          frames: { idle: { x: 0, y: 0, w: 'not a number', h: 32 } },
        }),
      ).toBe(false);
    });
  });

  describe('integration with team-colors (fallback invariant)', () => {
    it('every roster that has colors can still be rendered (even without a sprite)', () => {
      // End-to-end fallback invariant: for any known roster, even with no
      // sprite registered, the renderer has enough information to fall back
      // to the circle+tint path via getTeamColors.
      for (const slug of Object.keys(ROSTER_COLORS)) {
        const colors = getTeamColors(slug);
        const sprite = getTeamSpriteManifest(slug);
        // Either a sprite exists, or colors are non-null so we can fall back.
        expect(sprite !== null || typeof colors.primary === 'number').toBe(true);
      }
    });
  });
});
