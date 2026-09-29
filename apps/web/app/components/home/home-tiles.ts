/**
 * Tuiles « Compendium » de la home (pur, testable sans DOM).
 *
 * Une tuile = une icône, un titre, une ligne, un lien. Elles remplacent les
 * grandes cartes à paragraphe ET la rangée « Accès rapide » qui reprenait
 * exactement leurs liens. Toutes pointent quelque part : la carte « Export
 * PDF » était la seule sans lien, et plusieurs pages utiles (règles, aide de
 * jeu, tier-list) n'étaient atteignables que par le menu.
 */

export type HomeTileKey =
  | "rosters"
  | "starPlayers"
  | "skills"
  | "rules"
  | "gameAid"
  | "tierList"
  | "tutorial"
  | "exportPdf"
  | "localMatches";

export interface HomeTile {
  readonly key: HomeTileKey;
  readonly href: string;
}

const BASE_TILES: ReadonlyArray<HomeTile> = [
  { key: "rosters", href: "/teams" },
  { key: "starPlayers", href: "/star-players" },
  { key: "skills", href: "/skills" },
  { key: "rules", href: "/compendium" },
  { key: "gameAid", href: "/aide-de-jeu" },
  { key: "tierList", href: "/teams/tier-list" },
  { key: "tutorial", href: "/tutoriel" },
  // L'export PDF se lance depuis la fiche d'une équipe.
  { key: "exportPdf", href: "/me/teams" },
];

export interface HomeTilesOptions {
  /** Brique « parties offline » (flag `offline_match`, OFF en prod). */
  readonly offlineMatchEnabled: boolean;
}

export function buildHomeTiles({ offlineMatchEnabled }: HomeTilesOptions): ReadonlyArray<HomeTile> {
  return offlineMatchEnabled
    ? [...BASE_TILES, { key: "localMatches", href: "/local-matches" }]
    : BASE_TILES;
}
