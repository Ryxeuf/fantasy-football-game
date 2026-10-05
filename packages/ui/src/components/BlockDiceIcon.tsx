import React from "react";
import {
  BLOCK_DIE_FACE_INFO,
  blockResultDescriptionFr,
  type BlockResult,
} from "@bb/game-engine";
import { SkinnedBlockFace } from "../dice/DieFaces";
import { OUTCOME_BY_BLOCK_RESULT } from "../dice/skins";

export type { BlockResult };

interface BlockDiceIconProps {
  result: BlockResult;
  size?: number;
  className?: string;
}

/**
 * Icône d'une face du Dé de Blocage (match en ligne, journal, popups).
 *
 * Dessinée dans le SKIN de dés courant (`DiceSkinProvider`, posé par le site
 * depuis le thème du coach ; dé original or & charbon sinon). Le libellé
 * vient de `BLOCK_DIE_FACE_INFO` — les noms officiels du livre.
 */
export default function BlockDiceIcon({
  result,
  size = 24,
  className = "",
}: BlockDiceIconProps) {
  const known = Boolean(BLOCK_DIE_FACE_INFO[result]);
  const description = known
    ? blockResultDescriptionFr(result)
    : "Résultat de blocage";
  const outcome = known
    ? OUTCOME_BY_BLOCK_RESULT[result]
    : OUTCOME_BY_BLOCK_RESULT.PLAYER_DOWN;

  return (
    <SkinnedBlockFace
      outcome={outcome}
      label={description}
      px={size}
      style={{ objectFit: "contain" }}
      className={`inline-block ${className}`}
    />
  );
}
