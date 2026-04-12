/**
 * Terrain skin registry — H.7 variantes de terrain (herbe/ruine/neige).
 *
 * Defines the visual palette for each terrain variant. The renderer
 * (PixiBoard) consumes a TerrainSkin to draw the field background,
 * endzones, grid lines and center line with thematic colors.
 *
 * Pure data module — no side effects, trivially unit-testable.
 */

/** Available terrain skin identifiers. */
export type TerrainSkinId = "grass" | "ruins" | "snow";

/** Full visual palette for a terrain variant. */
export interface TerrainSkin {
  id: TerrainSkinId;
  name: string;
  /** Main field background color (24-bit hex). */
  fieldColor: number;
  /** Endzone checkerboard primary color for team A. */
  endzoneTeamAColor: number;
  /** Endzone checkerboard primary color for team B. */
  endzoneTeamBColor: number;
  /** Endzone checkerboard secondary color (alternating squares). */
  endzoneSecondaryColor: number;
  /** Sideline border and lane marker color. */
  lineColor: number;
  /** Midfield center line color. */
  centerLineColor: number;
  /** Grid line color. */
  gridColor: number;
  /** Grid line opacity (0–1). */
  gridAlpha: number;
}

/** Canonical terrain skin definitions. */
export const TERRAIN_SKINS: Record<TerrainSkinId, TerrainSkin> = {
  grass: {
    id: "grass",
    name: "Herbe classique",
    fieldColor: 0x6b8e23,
    endzoneTeamAColor: 0xff0000,
    endzoneTeamBColor: 0x0000ff,
    endzoneSecondaryColor: 0xf5f5f5,
    lineColor: 0xffffff,
    centerLineColor: 0xffff00,
    gridColor: 0xcccccc,
    gridAlpha: 0.3,
  },
  ruins: {
    id: "ruins",
    name: "Ruines antiques",
    fieldColor: 0x6b5e4f,
    endzoneTeamAColor: 0x8b3a3a,
    endzoneTeamBColor: 0x3a4f8b,
    endzoneSecondaryColor: 0xd4c5a9,
    lineColor: 0xc8b89a,
    centerLineColor: 0xd4a053,
    gridColor: 0x8a7a6a,
    gridAlpha: 0.35,
  },
  snow: {
    id: "snow",
    name: "Terrain enneige",
    fieldColor: 0xc8dce8,
    endzoneTeamAColor: 0xb03030,
    endzoneTeamBColor: 0x2060b0,
    endzoneSecondaryColor: 0xf0f4f8,
    lineColor: 0x90b8d8,
    centerLineColor: 0x4a90c8,
    gridColor: 0xa0c0d8,
    gridAlpha: 0.25,
  },
};

/** Default skin used when no terrain is specified. */
export const DEFAULT_TERRAIN_SKIN_ID: TerrainSkinId = "grass";

/**
 * Resolve a terrain skin by id. Returns the default (grass) skin for
 * unknown or undefined ids — callers never get `null`.
 */
export function getTerrainSkin(id: TerrainSkinId | undefined): TerrainSkin {
  if (!id) return TERRAIN_SKINS[DEFAULT_TERRAIN_SKIN_ID];
  return TERRAIN_SKINS[id] ?? TERRAIN_SKINS[DEFAULT_TERRAIN_SKIN_ID];
}

/**
 * Weather condition strings that map to the snow terrain skin.
 * Matches conditions from hivernale, montagnard and some classique weather.
 */
const SNOW_CONDITIONS = new Set([
  "Blizzard",
  "Neige épaisse",
  "Neige légère",
  "Grêle",
  "Tempête de neige",
  "Gel intense",
  "Verglas",
  "Avalanche",
  "Froid mordant",
]);

/**
 * Weather condition strings that map to the ruins terrain skin.
 * Matches conditions from souterraine, cimetiere and terres-gastes weather.
 */
const RUINS_CONDITIONS = new Set([
  "Éboulement",
  "Ruines instables",
  "Obscurité",
  "Tremblements",
  "Brume sépulcrale",
  "Esprits agités",
  "Sol instable",
  "Poussière ancienne",
  "Vent des cryptes",
  "Terrain maudit",
]);

/**
 * Infer the most fitting terrain skin from a weather condition string.
 * Returns the skin id (not the full skin object) so callers can override.
 */
export function resolveTerrainSkinFromWeather(
  condition: string | undefined,
): TerrainSkinId {
  if (!condition) return DEFAULT_TERRAIN_SKIN_ID;
  if (SNOW_CONDITIONS.has(condition)) return "snow";
  if (RUINS_CONDITIONS.has(condition)) return "ruins";
  return DEFAULT_TERRAIN_SKIN_ID;
}
