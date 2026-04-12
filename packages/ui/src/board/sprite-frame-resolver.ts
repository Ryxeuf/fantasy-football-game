/**
 * H.6 sub-task 5/5 — resolve the sprite frame name for a player.
 *
 * Pure function that picks the best matching frame from a sprite manifest
 * based on the player's current state. Frames beyond `idle` are optional;
 * the function always falls back to `idle` when a specialised frame is
 * missing from the manifest.
 *
 * Frame priority (first match wins):
 *   1. `carrying` — player has the ball
 *   2. `down`     — player is knocked out / casualty / sent off
 *   3. `idle`     — default standing pose (mandatory in every manifest)
 */
import type { Player, TeamSpriteManifest } from "@bb/game-engine";

/** Player states that map to the `down` sprite frame. */
const DOWN_STATES: ReadonlySet<string> = new Set([
  "knocked_out",
  "casualty",
  "sent_off",
]);

/**
 * Select the best sprite frame name for the given player.
 *
 * @param player   - the player's current in-game state
 * @param manifest - the sprite manifest for the player's roster
 * @returns a key guaranteed to exist in `manifest.frames`
 */
export function resolvePlayerSpriteFrame(
  player: Pick<Player, "hasBall" | "state" | "stunned">,
  manifest: TeamSpriteManifest,
): string {
  if (player.hasBall && manifest.frames.carrying) {
    return "carrying";
  }

  if (player.state && DOWN_STATES.has(player.state) && manifest.frames.down) {
    return "down";
  }

  return "idle";
}
