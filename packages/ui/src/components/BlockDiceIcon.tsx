import React from "react";
import {
  BLOCK_DIE_FACE_INFO,
  blockResultDescriptionFr,
  type BlockResult,
} from "@bb/game-engine";

export type { BlockResult };

interface BlockDiceIconProps {
  result: BlockResult;
  size?: number;
  className?: string;
}

/**
 * Icône d'une face du Dé de Blocage.
 *
 * Les noms de fichiers sont historiques (`pow.png` = Défenseur Plaqué,
 * `player_down.png` = Attaquant Plaqué) ; le libellé affiché vient, lui,
 * de `BLOCK_DIE_FACE_INFO` — les noms officiels du livre.
 */
const IMAGE_BY_RESULT: Record<BlockResult, string> = {
  PLAYER_DOWN: "/images/blocking_dice/player_down.png",
  BOTH_DOWN: "/images/blocking_dice/both_down.png",
  PUSH_BACK: "/images/blocking_dice/push_back.png",
  STUMBLE: "/images/blocking_dice/stumble.png",
  POW: "/images/blocking_dice/pow.png",
};

export default function BlockDiceIcon({
  result,
  size = 24,
  className = "",
}: BlockDiceIconProps) {
  const src = IMAGE_BY_RESULT[result] ?? IMAGE_BY_RESULT.PLAYER_DOWN;
  const description = BLOCK_DIE_FACE_INFO[result]
    ? blockResultDescriptionFr(result)
    : "Résultat de blocage";

  return (
    <img
      src={src}
      alt={description}
      title={description}
      style={{ width: size, height: size, objectFit: "contain" }}
      className={`inline-block ${className}`}
    />
  );
}
