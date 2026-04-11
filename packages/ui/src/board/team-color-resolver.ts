/**
 * H.6 — team color resolution for board rendering.
 *
 * Pure, side-effect free so it can be unit-tested without loading the full
 * Pixi stack. `PixiBoard` imports this and applies the resolved color as a
 * Graphics fill. A later sub-task will add sprite sheet loading and swap
 * the circle Graphics for Pixi Sprites tinted with the same color.
 */
import {
  getTeamColors,
  getTeamSpriteManifest,
  hasTeamSprite,
  type TeamColors,
  type TeamSpriteManifest,
} from "@bb/game-engine";
import type { GameState, Player } from "@bb/game-engine";

/** Legacy red/blue palette preserved for backwards compatibility. */
export const LEGACY_TEAM_A_COLOR = 0xcc2222;
export const LEGACY_TEAM_B_COLOR = 0x2255cc;
export const STUNNED_COLOR = 0x808080;

/**
 * Legacy outline palette (sub-task 3/5). Before H.6 sub-task 3 the circle
 * outline was a hardcoded white `0xffffff` shared by both teams. We now use
 * a richer per-team default that still matches the pre-H.6 "red vs blue"
 * reading of the board when no roster slug is available.
 */
export const LEGACY_TEAM_A_OUTLINE = 0xffe08a; // warm cream (reads against red)
export const LEGACY_TEAM_B_OUTLINE = 0xe0f2fe; // cold ice (reads against blue)
/** Stunned circle stroke — matches the pre-H.6 hardcoded value in PixiBoard. */
export const STUNNED_OUTLINE_COLOR = 0xcccccc;

export interface TeamRostersMap {
  teamA?: string;
  teamB?: string;
}

export interface TeamColorOverridesMap {
  teamA?: TeamColors;
  teamB?: TeamColors;
}

/**
 * Resolve the primary fill color for a player on the board.
 *
 * Resolution order:
 *   1. stunned players are grey (regardless of team)
 *   2. explicit `teamColorOverrides[team]` if provided
 *   3. `getTeamColors(teamRosters[team]).primary` if a roster slug is provided
 *   4. legacy red/blue fallback
 */
/**
 * Derive the effective `teamRosters` map to feed the color resolver, combining:
 *   1. explicit `propOverride` (caller-provided, highest priority per side)
 *   2. `state.teamRosters` (set by `setupPreMatchWithTeams`)
 *
 * Callers get a single merged map they can pass to `PixiBoard` / `resolveTeamFillColor`
 * without duplicating merge logic at every usage site.
 *
 * @returns the merged map, or `undefined` when neither source has any slug
 *          (so consumers can trigger the legacy red/blue fallback path).
 */
export function resolveTeamRostersFromState(
  state: Pick<GameState, "teamRosters"> | null | undefined,
  propOverride?: TeamRostersMap,
): TeamRostersMap | undefined {
  const stateRosters = state?.teamRosters;
  const teamA = propOverride?.teamA ?? stateRosters?.teamA;
  const teamB = propOverride?.teamB ?? stateRosters?.teamB;
  if (!teamA && !teamB) return undefined;
  return { teamA, teamB };
}

export function resolveTeamFillColor(
  player: Pick<Player, "team" | "stunned">,
  teamRosters?: TeamRostersMap,
  teamColorOverrides?: TeamColorOverridesMap,
): number {
  if (player.stunned) return STUNNED_COLOR;

  const override =
    player.team === "A" ? teamColorOverrides?.teamA : teamColorOverrides?.teamB;
  if (override) return override.primary;

  const rosterSlug =
    player.team === "A" ? teamRosters?.teamA : teamRosters?.teamB;
  if (rosterSlug) return getTeamColors(rosterSlug).primary;

  return player.team === "A" ? LEGACY_TEAM_A_COLOR : LEGACY_TEAM_B_COLOR;
}

/**
 * Resolve the outline / accent color for a player circle on the board
 * (sub-task 3/5 of H.6 — uses the per-roster `secondary` color so teams are
 * visually distinguished by more than just their jersey tint, as a pragmatic
 * stepping stone before shipping actual sprite sheets).
 *
 * Resolution order mirrors `resolveTeamFillColor`:
 *   1. stunned players always use `STUNNED_OUTLINE_COLOR` (preserves the
 *      gameplay signal of a dimmed/greyed silhouette)
 *   2. explicit `teamColorOverrides[team].secondary` if provided
 *   3. `getTeamColors(teamRosters[team]).secondary` when a roster slug exists
 *   4. legacy per-team fallback (cream for A, ice for B)
 */
export function resolveTeamOutlineColor(
  player: Pick<Player, "team" | "stunned">,
  teamRosters?: TeamRostersMap,
  teamColorOverrides?: TeamColorOverridesMap,
): number {
  if (player.stunned) return STUNNED_OUTLINE_COLOR;

  const override =
    player.team === "A" ? teamColorOverrides?.teamA : teamColorOverrides?.teamB;
  if (override) return override.secondary;

  const rosterSlug =
    player.team === "A" ? teamRosters?.teamA : teamRosters?.teamB;
  if (rosterSlug) return getTeamColors(rosterSlug).secondary;

  return player.team === "A" ? LEGACY_TEAM_A_OUTLINE : LEGACY_TEAM_B_OUTLINE;
}

/**
 * H.6 sub-task 4/5 — resolve the sprite manifest for a player's team, if any.
 *
 * Returns `null` when no sprite is registered for the team's roster slug
 * (the common case today — sub-task 5/5 will populate the registry). The
 * renderer uses this to decide between the circle Graphics fallback path
 * and the future Pixi.Sprite + tint path.
 *
 * Resolution order:
 *   1. stunned players always return `null` (keep the greyed-out circle
 *      fallback regardless of whether a sprite is shipped)
 *   2. `teamRosters[team]` → `getTeamSpriteManifest(slug)`
 *   3. `null` when no roster slug is available (legacy red/blue fallback)
 */
export function resolveTeamSpriteManifest(
  player: Pick<Player, "team" | "stunned">,
  teamRosters?: TeamRostersMap,
): TeamSpriteManifest | null {
  if (player.stunned) return null;

  const rosterSlug =
    player.team === "A" ? teamRosters?.teamA : teamRosters?.teamB;
  return getTeamSpriteManifest(rosterSlug);
}

/**
 * H.6 sub-task 4/5 — does the player's team have a sprite manifest ready to
 * render? Convenience boolean wrapper around {@link resolveTeamSpriteManifest}.
 *
 * This is the single source of truth for the renderer's "sprite vs circle"
 * decision: as long as it returns `false`, the PixiBoard must keep drawing
 * circles with the per-roster fill + outline colors.
 */
export function shouldUseTeamSprite(
  player: Pick<Player, "team" | "stunned">,
  teamRosters?: TeamRostersMap,
): boolean {
  if (player.stunned) return false;
  const rosterSlug =
    player.team === "A" ? teamRosters?.teamA : teamRosters?.teamB;
  return hasTeamSprite(rosterSlug);
}
