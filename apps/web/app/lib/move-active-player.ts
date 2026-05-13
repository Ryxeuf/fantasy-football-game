/**
 * Lot 3.E.1 — Extraction du playerId actif d'un `Move`.
 *
 * Quand on visionne le replay full-driver pas-à-pas, on veut surligner
 * sur le terrain le joueur dont vient de jouer le move courant. La
 * plupart des moves portent un `playerId` direct (`MOVE`, `BLOCK`,
 * `PASS`, ...), mais quelques uns n'en ont pas (`END_TURN`,
 * `REROLL_CHOOSE`, `KICKOFF_*`) ou utilisent un autre nom de champ
 * (`DUMP_OFF_CHOOSE.passerId`).
 *
 * Ce helper est pur — testable sans Pixi ni game-engine — et retourne
 * `null` quand aucun joueur n'est associé au move.
 */

import type { Move } from "@bb/game-engine";

export function getMoveActivePlayerId(
  move: Move | null | undefined,
): string | null {
  if (!move) return null;
  switch (move.type) {
    case "MOVE":
    case "LEAP":
    case "END_PLAYER_TURN":
    case "DODGE":
    case "BLOCK":
    case "MULTI_BLOCK":
    case "BLOCK_CHOOSE":
    case "BLITZ":
    case "PUSH_CHOOSE":
    case "FOLLOW_UP_CHOOSE":
    case "PASS":
    case "HANDOFF":
    case "THROW_TEAM_MATE":
    case "FOUL":
    case "HYPNOTIC_GAZE":
    case "PROJECTILE_VOMIT":
    case "STAB":
    case "CHAINSAW":
    case "BALL_AND_CHAIN":
    case "BOMB_THROW":
    case "ON_THE_BALL_MOVE":
      return move.playerId;
    case "DUMP_OFF_CHOOSE":
      return move.passerId;
    case "KICKOFF_HIGH_KICK":
      return move.playerId ?? null;
    default:
      return null;
  }
}
