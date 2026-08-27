"use client";

import { playerStatusTags, type PlayerStatusSource } from "./player-status-tags";

interface PlayerStatusTagsProps {
  player: PlayerStatusSource;
  /** Suffixe des `data-testid` : `player-status-<key>-<playerId>`. */
  playerId: string;
  className?: string;
}

/**
 * Étiquettes « Mort / Absent / N BP / Séquelles » d'un joueur du roster.
 * Rend `null` pour un joueur sain (aucun bruit visuel sur le cas courant).
 */
export default function PlayerStatusTags({
  player,
  playerId,
  className,
}: PlayerStatusTagsProps) {
  const tags = playerStatusTags(player);
  if (tags.length === 0) return null;
  return (
    <span
      data-testid={`player-status-tags-${playerId}`}
      className={`inline-flex flex-wrap items-center gap-1${className ? ` ${className}` : ""}`}
    >
      {tags.map((tag) => (
        <span
          key={tag.key}
          data-testid={`player-status-${tag.key}-${playerId}`}
          title={tag.title}
          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tag.className}`}
        >
          {tag.label}
        </span>
      ))}
    </span>
  );
}
