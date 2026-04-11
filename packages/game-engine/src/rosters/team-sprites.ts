/**
 * Team sprite manifest registry — H.6 sprite sheets sub-task 4/5.
 *
 * Goal of this sub-task:
 *   Provide the *architecture* for per-roster sprite sheets without yet
 *   shipping any PNG assets. The renderer can then query this registry to
 *   decide whether to draw a tinted Pixi.Sprite (sub-task 5/5, once atlases
 *   are shipped) or fall back to the current circle Graphics path (today).
 *
 * Design choices:
 *   - pure, side-effect free so it is trivially unit-testable and usable from
 *     both the server (asset preflight) and the browser (renderer).
 *   - `TEAM_SPRITE_MANIFESTS` starts empty on purpose: every known roster must
 *     visibly fall back to the circle path until actual atlases ship. The
 *     unit test suite enforces this invariant.
 *   - structural `isTeamSpriteManifest` type guard so callers can safely
 *     validate manifests loaded from JSON / Prisma / user overrides.
 *
 * Follow-up (sub-task 5/5):
 *   - ship PNG atlases under `apps/web/public/images/team-sprites/<slug>.png`
 *   - populate `TEAM_SPRITE_MANIFESTS` with the matching frame rectangles
 *   - teach `PixiBoard` to load atlases via `@pixi/assets` and draw
 *     `Pixi.Sprite` instances tinted via `getTeamColors(slug).primary`
 */

/**
 * Rectangular slice inside a sprite atlas, expressed in the atlas's own
 * pixel coordinate system. Width and height must be strictly positive.
 */
export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Canonical per-roster sprite manifest describing where to fetch the atlas
 * and how to slice it into named frames (idle, down, stunned, carrying, …).
 */
export interface TeamSpriteManifest {
  /** Public URL of the atlas image (relative to the web root). */
  atlasUrl: string;
  /**
   * Map of frame name → rectangle. At minimum, renderers expect an `idle`
   * frame; additional frames (down, stunned, carrying) are optional and
   * will be added as the renderer learns to draw new player states.
   */
  frames: Record<string, SpriteFrame>;
  /**
   * Optional explicit tint applied to the sprite. When omitted, the
   * renderer should use `getTeamColors(rosterSlug).primary` as tint.
   */
  tint?: number;
}

/**
 * Roster slug → sprite manifest. Intentionally empty today: sub-task 5/5
 * will populate this map once PNG atlases are shipped.
 *
 * Exported as a mutable record to allow the renderer (or tests) to register
 * manifests dynamically, e.g. for storybook fixtures or A/B experiments.
 */
export const TEAM_SPRITE_MANIFESTS: Record<string, TeamSpriteManifest> = {};

/**
 * Structural type guard for {@link TeamSpriteManifest}. Accepts any value
 * and returns `true` only if it has the expected `atlasUrl`, `frames` map,
 * and numeric rectangles on every declared frame.
 *
 * Use this at system boundaries (JSON imports, server responses, user
 * overrides) before trusting a manifest.
 */
export function isTeamSpriteManifest(value: unknown): value is TeamSpriteManifest {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.atlasUrl !== 'string' || candidate.atlasUrl.length === 0) {
    return false;
  }
  const frames = candidate.frames;
  if (frames === null || typeof frames !== 'object') return false;
  for (const frame of Object.values(frames as Record<string, unknown>)) {
    if (frame === null || typeof frame !== 'object') return false;
    const rect = frame as Record<string, unknown>;
    if (
      typeof rect.x !== 'number' ||
      typeof rect.y !== 'number' ||
      typeof rect.w !== 'number' ||
      typeof rect.h !== 'number'
    ) {
      return false;
    }
  }
  if (candidate.tint !== undefined && typeof candidate.tint !== 'number') {
    return false;
  }
  return true;
}

/**
 * Resolve the sprite manifest for a given roster slug.
 *
 * Returns `null` (not `undefined`) for any unknown or missing slug so callers
 * can easily distinguish "no sprite available, fall back" from "value not
 * provided". This is important for the renderer fallback invariant: any
 * roster without a manifest MUST fall back to the circle Graphics path.
 */
export function getTeamSpriteManifest(
  rosterSlug: string | undefined,
): TeamSpriteManifest | null {
  if (!rosterSlug) return null;
  return TEAM_SPRITE_MANIFESTS[rosterSlug] ?? null;
}

/**
 * Convenience predicate — returns `true` iff a manifest is registered for
 * the given roster slug. Equivalent to `getTeamSpriteManifest(slug) !== null`
 * but clearer at call sites that only need to pick between two render paths.
 */
export function hasTeamSprite(rosterSlug: string | undefined): boolean {
  return getTeamSpriteManifest(rosterSlug) !== null;
}
