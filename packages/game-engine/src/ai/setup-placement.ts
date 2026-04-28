/**
 * AI setup placement — Blood Bowl legal auto-placement for an AI team.
 *
 * Places 11 players for `teamId` during the `setup` phase, respecting:
 *  - 3 players on the Line of Scrimmage (x = 12 for A, 13 for B)
 *  - max 2 players per wide zone (y in 0..2 and 12..14)
 *  - max 11 players on the pitch
 *  - no overlaps
 *
 * Pure function: returns a new `ExtendedGameState` via `placePlayerInSetup`.
 */
import type { Position, TeamId } from '../core/types';
import {
  placePlayerInSetup,
  type ExtendedGameState,
} from '../core/game-state';

const LEFT_WIDE_ZONE_ROWS: readonly number[] = [1, 0, 2];
const RIGHT_WIDE_ZONE_ROWS: readonly number[] = [13, 12, 14];
const LOS_CENTER_ROWS: readonly number[] = [7, 6, 8, 5, 9, 4, 10, 3, 11];
const MIDFIELD_ROWS: readonly number[] = [7, 6, 8, 5, 9, 4, 10, 3, 11];

/**
 * Build an ordered list of 11 legal positions for `teamId`.
 * The order matters: LOS positions come first so that the engine's
 * "at least 3 players on LOS" constraint is always satisfied as players
 * are placed.
 */
export function buildAISetupPositions(teamId: TeamId): Position[] {
  const losX = teamId === 'A' ? 12 : 13;
  const backX = teamId === 'A' ? 8 : 17;
  const midX = teamId === 'A' ? 10 : 15;

  const positions: Position[] = [];

  for (let i = 0; i < 3 && i < LOS_CENTER_ROWS.length; i += 1) {
    positions.push({ x: losX, y: LOS_CENTER_ROWS[i] });
  }

  for (let i = 0; i < 2 && i < LEFT_WIDE_ZONE_ROWS.length; i += 1) {
    positions.push({ x: backX, y: LEFT_WIDE_ZONE_ROWS[i] });
  }

  for (let i = 0; i < 2 && i < RIGHT_WIDE_ZONE_ROWS.length; i += 1) {
    positions.push({ x: backX, y: RIGHT_WIDE_ZONE_ROWS[i] });
  }

  let rowIdx = 0;
  while (positions.length < 11) {
    const y = MIDFIELD_ROWS[rowIdx % MIDFIELD_ROWS.length];
    const candidate: Position = { x: midX, y };
    if (!positions.some((p) => p.x === candidate.x && p.y === candidate.y)) {
      positions.push(candidate);
    } else {
      const fallback: Position = {
        x: midX,
        y: MIDFIELD_ROWS[(rowIdx + 1) % MIDFIELD_ROWS.length],
      };
      if (!positions.some((p) => p.x === fallback.x && p.y === fallback.y)) {
        positions.push(fallback);
      } else {
        const backup: Position = { x: backX, y };
        if (!positions.some((p) => p.x === backup.x && p.y === backup.y)) {
          positions.push(backup);
        } else {
          positions.push({
            x: midX,
            y: MIDFIELD_ROWS[(rowIdx + 2) % MIDFIELD_ROWS.length],
          });
        }
      }
    }
    rowIdx += 1;
    if (rowIdx > 40) break;
  }

  return positions.slice(0, 11);
}

/**
 * Place up to 11 players of `teamId` in legal setup positions.
 * Only touches players that are still in reserves (`pos.x < 0`), so this is
 * idempotent and safe to call even if the coach has already placed some
 * players.
 */
export function autoSetupAITeam(
  state: ExtendedGameState,
  teamId: TeamId,
): ExtendedGameState {
  if (state.preMatch?.phase !== 'setup') {
    return state;
  }
  if (state.preMatch.currentCoach !== teamId) {
    return state;
  }

  const positions = buildAISetupPositions(teamId);

  // Only `active` players are eligible to take the field at the start of a
  // drive. Knocked-out, casualty, dead and sent-off players keep their
  // logical state but their pos.x has been reset to -1 elsewhere — without
  // this filter the AI would happily place a KO'd or expelled secret
  // weapon back on the pitch for the next drive.
  const teamPlayersInReserves = state.players
    .filter((p) => p.team === teamId && p.pos.x < 0 && (!p.state || p.state === 'active'))
    .slice(0, 11);

  let current = state;
  let cursor = 0;

  for (const player of teamPlayersInReserves) {
    if (cursor >= positions.length) break;
    while (cursor < positions.length) {
      const pos = positions[cursor];
      cursor += 1;
      const occupied = current.players.some(
        (p) => p.id !== player.id && p.pos.x === pos.x && p.pos.y === pos.y,
      );
      if (occupied) {
        continue;
      }
      const result = placePlayerInSetup(current, player.id, pos);
      if (result.success) {
        current = result.state;
        break;
      }
    }
  }

  return current;
}
