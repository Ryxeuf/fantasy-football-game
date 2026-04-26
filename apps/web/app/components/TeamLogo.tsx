/**
 * TeamLogo (O.8b — cosmetiques visuels).
 *
 * Composant React qui affiche le logo programmatique d'une equipe en
 * inlinant le SVG genere par `renderTeamLogoSvg` (game-engine). Pas de
 * fetch, pas d'asset a embarquer : le SVG est entierement reconstruit
 * a partir du slug + couleurs canoniques.
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
}

export default function TeamLogo({
  slug,
  size = 64,
  title,
  colorsOverride,
  className = "",
}: TeamLogoProps) {
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
