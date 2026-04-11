/**
 * H.6 — team color resolution for board rendering.
 *
 * Pure, side-effect free so it can be unit-tested without loading the full
 * Pixi stack. `PixiBoard` imports this and applies the resolved color as a
 * Graphics fill. A later sub-task will add sprite sheet loading and swap
 * the circle Graphics for Pixi Sprites tinted with the same color.
 */
import { getTeamColors, type TeamColors } from "@bb/game-engine";
import type { GameState, Player } from "@bb/game-engine";

/** Legacy red/blue palette preserved for backwards compatibility. */
export const LEGACY_TEAM_A_COLOR = 0xcc2222;
export const LEGACY_TEAM_B_COLOR = 0x2255cc;
export const STUNNED_COLOR = 0x808080;

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
