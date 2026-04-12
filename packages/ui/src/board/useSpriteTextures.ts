/**
 * H.6 sub-task 5/5 — sprite texture loader hook.
 *
 * Provides two pieces:
 *
 * 1. `buildSpriteLoadPlan()` — pure function that determines which atlas
 *    textures need loading based on the current team rosters. Tested
 *    independently of Pixi.js.
 *
 * 2. `useSpriteTextures()` — React hook that executes the load plan using
 *    `@pixi/core` Texture primitives. Returns a map of roster slug → frame
 *    textures that `PixiBoard` can feed to `<Sprite>` components.
 *
 * The hook is designed so that adding a new roster's sprites is zero-code-
 * change in the renderer: just populate `TEAM_SPRITE_MANIFESTS` with the
 * manifest entry and drop the PNG atlas under
 * `apps/web/public/images/team-sprites/<slug>.png`.
 */
import * as React from "react";
import { Texture, Rectangle, BaseTexture } from "@pixi/core";
import {
  getTeamSpriteManifest,
  type TeamSpriteManifest,
} from "@bb/game-engine";
import type { TeamRostersMap } from "./team-color-resolver";

/* ── Pure load plan (testable without Pixi context) ──────────────── */

export interface SpriteLoadEntry {
  slug: string;
  manifest: TeamSpriteManifest;
}

/**
 * Determine which sprite atlases need loading for the current match.
 *
 * Deduplicates when both teams share the same roster. Returns an empty
 * array when no sprites are registered — the caller (PixiBoard) should
 * keep rendering circles in that case.
 */
export function buildSpriteLoadPlan(
  teamRosters?: TeamRostersMap,
): SpriteLoadEntry[] {
  if (!teamRosters) return [];

  const seen = new Set<string>();
  const plan: SpriteLoadEntry[] = [];

  for (const slug of [teamRosters.teamA, teamRosters.teamB]) {
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const manifest = getTeamSpriteManifest(slug);
    if (manifest) {
      plan.push({ slug, manifest });
    }
  }

  return plan;
}

/* ── Texture cache types ─────────────────────────────────────────── */

/** Map of frame name → Pixi Texture for a single roster. */
export type FrameTextures = Record<string, Texture>;

/** Map of roster slug → frame textures. */
export type SpriteTextureMap = Record<string, FrameTextures>;

/* ── React hook ──────────────────────────────────────────────────── */

/**
 * Load and cache sprite atlas textures for the current match teams.
 *
 * When manifests change (different rosters), previous textures are destroyed
 * and new ones are loaded. While loading, the map for that roster will be
 * absent — callers should fall back to the circle rendering path.
 *
 * @returns a map of roster slug → { frameName → Texture }, or `{}` when
 *          no sprites are registered or still loading.
 */
export function useSpriteTextures(
  teamRosters?: TeamRostersMap,
): SpriteTextureMap {
  const [textures, setTextures] = React.useState<SpriteTextureMap>({});

  // Serialise the slugs to detect when rosters change.
  const slugKey = [teamRosters?.teamA, teamRosters?.teamB]
    .filter(Boolean)
    .sort()
    .join(",");

  React.useEffect(() => {
    const plan = buildSpriteLoadPlan(teamRosters);
    if (plan.length === 0) {
      setTextures({});
      return;
    }

    let cancelled = false;
    const loadedBaseTextures: BaseTexture[] = [];

    async function loadAll() {
      const result: SpriteTextureMap = {};

      for (const { slug, manifest } of plan) {
        try {
          const baseTexture = BaseTexture.from(manifest.atlasUrl);
          loadedBaseTextures.push(baseTexture);

          // Wait for the base texture to be ready.
          await new Promise<void>((resolve, reject) => {
            if (baseTexture.valid) {
              resolve();
              return;
            }
            baseTexture.once("loaded", () => resolve());
            baseTexture.once("error", () =>
              reject(new Error(`Failed to load atlas: ${manifest.atlasUrl}`)),
            );
          });

          if (cancelled) return;

          // Slice the atlas into individual frame textures.
          const frames: FrameTextures = {};
          for (const [name, rect] of Object.entries(manifest.frames)) {
            frames[name] = new Texture(
              baseTexture,
              new Rectangle(rect.x, rect.y, rect.w, rect.h),
            );
          }
          result[slug] = frames;
        } catch {
          // Failed to load this atlas — skip it. The renderer will fall
          // back to the circle path for this roster.
        }
      }

      if (!cancelled) {
        setTextures(result);
      }
    }

    loadAll();

    return () => {
      cancelled = true;
      // Destroy textures on cleanup to avoid GPU memory leaks.
      for (const bt of loadedBaseTextures) {
        bt.destroy();
      }
    };
  }, [slugKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return textures;
}
