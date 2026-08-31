/**
 * Résolution du logo d'une équipe pour une image Open Graph.
 *
 * Deux sources possibles, deux rendus différents :
 *
 *  - **logo uploadé** (`Team.logoUrl`) → une image. L'URL peut être
 *    RELATIVE (`/images/team-logos/x.png`) quand
 *    `TEAM_LOGO_ASSET_PUBLIC_BASE` n'est pas posé côté serveur ; satori ne
 *    résout pas les chemins relatifs, on absolutise contre l'origine du
 *    site, qui est bien celle qui sert `public/images/team-logos`.
 *
 *  - **pas de logo** → l'emblème du roster, décrit en DONNÉES
 *    (couleurs canoniques + monogramme) et rendu nativement par
 *    `OgImageTemplate`.
 *
 *    Pourquoi ne pas réutiliser `renderTeamLogoSvg` en data URI, comme
 *    `<TeamLogo>` : satori rasterise un `<img src="data:image/svg+xml…">`
 *    sans résoudre les polices du SVG imbriqué. Le `<text>` du monogramme
 *    DISPARAÎT — on obtient un disque de couleur muet (constaté au rendu).
 *    Les mêmes données rendues en éléments satori portent, elles, le
 *    monogramme.
 *
 * Pur et testable sans satori ni réseau.
 */
import { getTeamColors, getTeamLogo } from "@bb/game-engine";

/** Image prête à poser dans la boîte carrée du template. */
export interface TeamOgLogoImage {
  readonly kind: "image";
  readonly src: string;
}

/** Emblème de repli, rendu par le template avec ses propres éléments. */
export interface TeamOgLogoEmblem {
  readonly kind: "emblem";
  /** Monogramme du roster (1 à 3 caractères, ex. « SK »). */
  readonly glyph: string;
  /** Couleur de fond (primaire canonique du roster), en hexadécimal. */
  readonly background: string;
  /** Couleur du monogramme et du liseré (secondaire canonique). */
  readonly foreground: string;
  /** `true` pour les rosters dont l'emblème canonique est un disque. */
  readonly round: boolean;
}

export type TeamOgLogo = TeamOgLogoImage | TeamOgLogoEmblem;

/** 0x1f77b4 → "#1f77b4". */
function toHexColor(value: number): string {
  const clamped = Math.max(0, Math.min(0xffffff, Math.floor(value)));
  return `#${clamped.toString(16).padStart(6, "0")}`;
}

/**
 * Absolutise une URL d'asset.
 *
 * Retourne `null` (plutôt qu'une chaîne vide) quand rien d'exploitable
 * n'est fourni : un `src` vide fait échouer l'`ImageResponse` entière, il
 * ne faut donc jamais en produire un.
 */
export function absolutizeAssetUrl(
  url: string | null | undefined,
  base: string,
): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  const cleanBase = base.replace(/\/+$/, "");
  return `${cleanBase}/${raw.replace(/^\/+/, "")}`;
}

/**
 * Emblème du roster : mêmes données canoniques que `<TeamLogo>`
 * (`getTeamLogo` pour la forme et le monogramme, `getTeamColors` pour les
 * couleurs), donc une équipe sans logo garde son identité visuelle d'un
 * bout à l'autre du site.
 */
export function rosterEmblem(
  rosterSlug: string | null | undefined,
): TeamOgLogoEmblem {
  const slug = rosterSlug ?? undefined;
  const logo = getTeamLogo(slug);
  const colors = getTeamColors(slug);
  return {
    kind: "emblem",
    glyph: logo.glyph,
    background: toHexColor(colors.primary),
    foreground: toHexColor(colors.secondary),
    round: logo.shape === "circle",
  };
}

export interface TeamOgLogoInput {
  /** `Team.logoUrl` — logo uploadé par le coach. */
  logoUrl?: string | null;
  /** Slug de roster, pour l'emblème de repli. */
  roster?: string | null;
  /** Origine servant les assets relatifs (site public). */
  assetBase: string;
}

/**
 * Logo à afficher dans la carte OG d'une équipe. Rend toujours quelque
 * chose : l'emblème du roster est le repli, et il n'échoue jamais.
 */
export function resolveTeamOgLogo(input: TeamOgLogoInput): TeamOgLogo {
  const uploaded = absolutizeAssetUrl(input.logoUrl, input.assetBase);
  if (uploaded) return { kind: "image", src: uploaded };
  return rosterEmblem(input.roster);
}
