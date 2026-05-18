/**
 * AI setup placement — Blood Bowl legal auto-placement for an AI team.
 *
 * Blood Bowl 2025 (Season 3) setup rules on a 26x15 pitch:
 *  - 3 players minimum on the Line of Scrimmage (x = 12 for A, 13 for B),
 *    counted only on the central rows y in 4..10 (wide-zone players do NOT
 *    count for the LOS minimum).
 *  - max 2 players per wide zone. Wide zones are 4 rows wide:
 *    LEFT  = y in 0..3, RIGHT = y in 11..14.
 *  - max 11 players on the pitch.
 *  - no overlaps with teammates or opponents.
 *
 * Pure function: returns a new `ExtendedGameState` via `placePlayerInSetup`.
 */
import type { Position, TeamId } from '../core/types';
import {
  placePlayerInSetup,
  type ExtendedGameState,
} from '../core/game-state';

// 4-row wide zones (BB 2025): y in 0..3 (LEFT) and 11..14 (RIGHT).
// Order them so the AI prefers the rows closest to the center column.
const LEFT_WIDE_ZONE_ROWS: readonly number[] = [2, 1, 3, 0];
const RIGHT_WIDE_ZONE_ROWS: readonly number[] = [12, 13, 11, 14];
// Central 7 rows (y in 4..10). LOS slots and the mid-field reinforcements
// must stay inside this band, otherwise they would land in a wide zone and
// not count toward the 3-player LOS minimum.
const LOS_CENTER_ROWS: readonly number[] = [7, 6, 8, 5, 9, 4, 10];
const MIDFIELD_ROWS: readonly number[] = [7, 6, 8, 5, 9, 4, 10];

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
