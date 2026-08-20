"use client";

/**
 * Avatar d'un joueur d'équipe : la photo uploadée par le coach quand elle
 * existe (`TeamPlayer.imageUrl`), sinon un disque d'initiales dérivées du
 * nom (défaut historique). Affiché en miniature partout où un joueur
 * apparaît (roster, pages de ligue, partage public) ; la pleine résolution
 * ne sert qu'à l'export de la carte joueur.
 */

export function playerInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  const initials = `${first}${last}`.toUpperCase();
  return initials || "?";
}

interface PlayerAvatarProps {
  name: string;
  imageUrl?: string | null;
  /** Taille en pixels (carré). Défaut : 28 (miniature de ligne de roster). */
  size?: number;
  className?: string;
  title?: string;
  testId?: string;
}

export default function PlayerAvatar({
  name,
  imageUrl,
  size = 28,
  className = "",
  title,
  testId,
}: PlayerAvatarProps) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- fichier servi
      // par l'API (cache long immutable) ; next/image n'optimise pas les
      // hôtes distants sans remotePatterns.
      <img
        src={imageUrl}
        alt={name}
        title={title ?? name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        data-testid={testId ?? "player-avatar-img"}
        className={`shrink-0 rounded-full object-cover ring-1 ring-black/10 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      title={title ?? name}
      data-testid={testId ?? "player-avatar-initials"}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-nuffle-anthracite/10 font-semibold text-nuffle-anthracite ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}
    >
      {playerInitials(name)}
    </span>
  );
}
