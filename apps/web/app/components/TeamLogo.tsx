/**
 * TeamLogo (O.8b — cosmetiques visuels).
 *
 * Composant React qui affiche le logo d'une equipe :
 *  - `logoUrl` renseigne (logo uploade par le coach) => l'image est
 *    affichee, recadree en carre ;
 *  - sinon, repli sur le logo programmatique inline genere par
 *    `renderTeamLogoSvg` (game-engine) — pas de fetch, pas d'asset a
 *    embarquer, le SVG est reconstruit a partir du slug + couleurs
 *    canoniques.
 */
import { renderTeamLogoSvg } from "@bb/game-engine";
import type { TeamColors } from "@bb/game-engine";

interface TeamLogoProps {
  /** Roster slug (ex: "skaven", "dwarf"). undefined -> logo neutre. */
  slug: string | undefined;
  /** Taille en pixels (carre). Defaut 64. */
  size?: number;
  /**
   * Titre accessible. Si fourni, le SVG expose role="img" + aria-label,
   * sinon il est marque comme decoratif (aria-hidden).
   */
  title?: string;
  /** Override des couleurs canoniques (rare ; utile pour previews). */
  colorsOverride?: TeamColors;
  /** Classe CSS appliquee au span wrapper. */
  className?: string;
  /**
   * Logo uploade par le coach (URL publique servie par l'API). Quand il
   * est absent (null/undefined), on retombe sur le logo programmatique.
   */
  logoUrl?: string | null;
}

export default function TeamLogo({
  slug,
  size = 64,
  title,
  colorsOverride,
  className = "",
  logoUrl,
}: TeamLogoProps) {
  if (logoUrl) {
    return (
      <span
        className={`inline-flex items-center justify-center overflow-hidden rounded ${className}`.trim()}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={title ?? ""}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  const svg = renderTeamLogoSvg(slug, {
    size,
    title,
    override: colorsOverride,
  });

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`.trim()}
      style={{ width: size, height: size }}
      // Le SVG est genere cote serveur de maniere deterministe a partir
      // d'un slug controle ; les valeurs utilisateur (title) sont
      // echappees par renderTeamLogoSvg. Pas de XSS possible ici.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
