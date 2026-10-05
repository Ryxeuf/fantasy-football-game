/**
 * « Skins » de dés — le RENDU d'un thème de dés, module PUR.
 *
 * Un skin = un jeu de faces PNG pour le Dé de Blocage (`public/images/dices/`,
 * trois tailles 64/128/320 px) + une palette avec laquelle les dés NUMÉRIQUES
 * (D6 à points, D3/D8/D16/2D6 chiffrés) sont dessinés dans le même style.
 * Aucun PNG n'existe pour les dés numériques : ils sont dessinés en SVG (web)
 * ou en `Graphics` (plateau Pixi) aux couleurs du skin.
 *
 * Partagé par le site (`apps/web/app/components/dice`) et par les composants
 * de match en ligne de ce package (popup de choix de blocage, journal, popup
 * de résultat, dé animé du plateau) : un seul registre, pas de miroir.
 *
 * Les ids sont ceux du catalogue serveur (`apps/server/src/services/
 * dice-theme-catalogue.ts`) — verrouillé par
 * `apps/web/app/components/dice/themes/catalogue-consistency.test.ts`.
 */

/** Les cinq résultats du Dé de Blocage, nommés comme les fichiers PNG. */
export type DiceFaceOutcome =
  | "attacker-down"
  | "both-down"
  | "push"
  | "defender-stumbles"
  | "defender-down";

export const DICE_FACE_OUTCOMES: readonly DiceFaceOutcome[] = [
  "attacker-down",
  "both-down",
  "push",
  "defender-stumbles",
  "defender-down",
];

/** Correspondance avec `BlockResult` du moteur (`@bb/game-engine`). */
export const OUTCOME_BY_BLOCK_RESULT = {
  PLAYER_DOWN: "attacker-down",
  BOTH_DOWN: "both-down",
  PUSH_BACK: "push",
  STUMBLE: "defender-stumbles",
  POW: "defender-down",
} as const satisfies Record<string, DiceFaceOutcome>;

/** Correspondance avec `BlockDieFace` du site (`components/dice/types`). */
export const OUTCOME_BY_BLOCK_FACE = {
  down: "attacker-down",
  bothdown: "both-down",
  push: "push",
  stumble: "defender-stumbles",
  pow: "defender-down",
} as const satisfies Record<string, DiceFaceOutcome>;

export interface DicePalette {
  /** Fond du jeton. */
  readonly background: string;
  /** Symbole / points / chiffre. */
  readonly symbol: string;
  /** Liseré et ornements. */
  readonly accent: string;
}

export interface DiceSkin {
  readonly id: string;
  /** Dossier public des faces : `<assetBase>/<taille>px/<résultat>.png`. */
  readonly assetBase: string;
  readonly palette: DicePalette;
  /** Vrai si les faces PNG portent un liseré (le D6 en reprend un). */
  readonly framed: boolean;
}

export type DiceAssetSize = 64 | 128 | 320;

export const DEFAULT_DICE_SKIN_ID = "nuffle" as const;

const ROOT = "/images/dices";

function classic(id: string, background: string, symbol: string, accent: string): DiceSkin {
  return {
    id,
    assetBase: `${ROOT}/nuffle-des-pack-5-themes/${id}`,
    palette: { background, symbol, accent },
    framed: true,
  };
}

function team(id: string, background: string, symbol: string, accent: string): DiceSkin {
  return {
    id,
    assetBase: `${ROOT}/nuffle-des-31-equipes/equipes/${id}`,
    palette: { background, symbol, accent },
    framed: true,
  };
}

/**
 * Palettes : relevées sur les PNG pour le pack « 5 thèmes », reprises du
 * `manifest.json` (`palette_direction`) pour les 31 équipes.
 */
const SKINS: readonly DiceSkin[] = [
  // Le dé ORIGINAL (or & charbon) — thème par défaut, servi à tout le monde.
  {
    id: DEFAULT_DICE_SKIN_ID,
    assetBase: `${ROOT}/nuffle-des-originaux/original-or`,
    palette: { background: "#241C13", symbol: "#D2A84E", accent: "#D2A84E" },
    framed: false,
  },
  classic("acier-bleu", "#0F2B4B", "#D8E4EA", "#3B90FA"),
  classic("chaos-rouge", "#481D1E", "#F0D8AE", "#D03E3B"),
  classic("malepierre", "#152B1E", "#B4E454", "#BFEE5E"),
  classic("glace", "#DEF0F6", "#184866", "#5EAAC7"),
  team("alliance-vieux-monde", "#172F48", "#F2D796", "#A88045"),
  team("amazones", "#163F37", "#F5E6B8", "#D88956"),
  team("bas-fonds", "#30203F", "#CAE76E", "#9C69B8"),
  team("elfes-noirs", "#261A3B", "#DCCFEF", "#B44D77"),
  team("elfes-sylvains", "#183E2F", "#E9D797", "#74AB69"),
  team("hauts-elfes", "#21466C", "#F7EDCF", "#CFAB54"),
  team("hommes-lezards", "#123D44", "#F6D464", "#3CB9AD"),
  team("nains", "#2A3541", "#EBD6A6", "#B88041"),
  team("nains-chaos", "#311D23", "#EBC6A0", "#DD7146"),
  team("nordiques", "#243F50", "#F0EEE2", "#75B2C4"),
  team("bretonniens", "#253C76", "#F2DC9F", "#AF3D49"),
  team("necromantiques", "#282837", "#E1D5B5", "#CF8646"),
  team("humains", "#223C69", "#F2E3C5", "#C45343"),
  team("morts-ambulants", "#373141", "#E8D6AE", "#9B8D79"),
  team("noblesse-imperiale", "#3C203A", "#F0D39A", "#B781A4"),
  team("orques", "#354020", "#EEDAB0", "#D77539"),
  team("rois-tombes", "#143A50", "#EDD183", "#41A8B7"),
  team("skavens", "#182338", "#ED9D42", "#A8BBC7"),
  team("slann", "#123F45", "#E7EBA6", "#42B7A7"),
  team("union-elfique", "#3C2851", "#F1DFB9", "#43B5AA"),
  team("vampires", "#351922", "#E8DCE0", "#B13551"),
  team("elus-chaos", "#302A2A", "#E0C595", "#BC7245"),
  team("khorne", "#501A1A", "#F0CC8B", "#BE7D37"),
  team("nurgle", "#313C23", "#DDE19E", "#AF9D50"),
  team("orques-noirs", "#1B2729", "#D7DCAC", "#87A545"),
  team("renegats-chaos", "#352A31", "#E5D5B9", "#B87A4A"),
  team("gnomes", "#243C38", "#F3D8A4", "#C46F56"),
  team("gobelins", "#23442C", "#E4EA91", "#E4B63D"),
  team("halflings", "#513224", "#F6DEAE", "#C78247"),
  team("ogres", "#3D3029", "#F0D9B1", "#BA7750"),
  team("snotlings", "#2B432A", "#DBE8A2", "#CA8150"),
];

export const DICE_SKINS: Readonly<Record<string, DiceSkin>> = Object.freeze(
  Object.fromEntries(SKINS.map((s) => [s.id, s])),
);

export const DEFAULT_DICE_SKIN: DiceSkin = DICE_SKINS[DEFAULT_DICE_SKIN_ID];

/** Skin d'un thème ; repli sur le dé original pour un id inconnu ou absent. */
export function getDiceSkin(id: string | null | undefined): DiceSkin {
  return (id ? DICE_SKINS[id] : undefined) ?? DEFAULT_DICE_SKIN;
}

/**
 * Taille de PNG à charger pour un affichage de `cssPx` pixels CSS : la plus
 * petite qui reste nette sur un écran 2x. Sans indication, 128 px.
 */
export function diceAssetSizeFor(cssPx: number | undefined): DiceAssetSize {
  if (cssPx === undefined || !Number.isFinite(cssPx)) return 128;
  if (cssPx <= 32) return 64;
  if (cssPx <= 64) return 128;
  return 320;
}

/** Chemin public d'une face du Dé de Blocage. */
export function blockFaceSrc(
  skin: DiceSkin,
  outcome: DiceFaceOutcome,
  size: DiceAssetSize = 128,
): string {
  return `${skin.assetBase}/${size}px/${outcome}.png`;
}

/** `#RRGGBB` → entier `0xRRGGBB` (couleurs Pixi). Repli noir si invalide. */
export function hexColorToNumber(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  return m ? parseInt(m[1], 16) : 0x000000;
}

/** Position des points d'un D6 sur une grille 3×3 (colonnes/lignes 12, 20, 28 sur 40). */
export const D6_PIPS: Readonly<Record<1 | 2 | 3 | 4 | 5 | 6, ReadonlyArray<readonly [number, number]>>> = {
  1: [[20, 20]],
  2: [[12, 12], [28, 28]],
  3: [[12, 12], [20, 20], [28, 28]],
  4: [[12, 12], [28, 12], [12, 28], [28, 28]],
  5: [[12, 12], [28, 12], [20, 20], [12, 28], [28, 28]],
  6: [[12, 12], [28, 12], [12, 20], [28, 20], [12, 28], [28, 28]],
};

export function isPipValue(n: number): n is 1 | 2 | 3 | 4 | 5 | 6 {
  return Number.isInteger(n) && n >= 1 && n <= 6;
}
