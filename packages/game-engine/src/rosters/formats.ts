/**
 * Formats de jeu : Blood Bowl à 11 (`bb11`) vs Blood Bowl à Sept (`sevens`).
 *
 * Axe ORTHOGONAL au `ruleset` (season_2 / season_3, qui désigne l'édition
 * des règles). Le format pilote uniquement les contraintes de SÉLECTION
 * d'équipe : budget de départ, nombre de joueurs, staff, relances, etc.
 *
 * Source unique de vérité : `FORMAT_CONSTRAINTS` est consommé à la fois par
 * la validation serveur (handlers `/team/build`, `/team/create-from-roster`)
 * et par l'UI du builder (`apps/web/app/me/teams/new`). Toute valeur ci-dessous
 * est exprimée en **kpo** (milliers de pièces d'or) pour coller à la convention
 * du builder (`teamValue: 1000` = 1 000 000 po, `cost: 50` = 50 000 po).
 *
 * ⚠️ Les valeurs Sevens proviennent du livre officiel "Blood Bowl à Sept"
 * (cf. data/ReglesBloodbowlSeven + docs/sevens.md). À garder synchronisé avec
 * la doc et la page de règles si elle existe.
 */

import type { PositionDefinition } from "./positions";

export type GameFormat = "bb11" | "sevens";
export const FORMATS: GameFormat[] = ["bb11", "sevens"];
export const DEFAULT_FORMAT: GameFormat = "bb11";

export interface FormatConstraints {
  /** Nombre de joueurs sur le terrain (informatif). */
  onPitch: number;
  /** Budget de sélection par défaut, en kpo. */
  startingBudget: number;
  /** Joueurs permanents : bornes min/max à la sélection. */
  minPlayers: number;
  maxPlayers: number;
  /**
   * Nombre maximum de joueurs NON-Linemen (postes spécialisés + Gros Bras).
   * `null` = pas de limite globale (chaque poste reste borné par sa fiche).
   */
  maxNonLinemen: number | null;
  /** Relances : plafond + multiplicateur de coût vs roster (Sevens = ×2). */
  maxRerolls: number;
  rerollCostMultiplier: number;
  /** Staff : plafonds + coûts unitaires (kpo). */
  maxCheerleaders: number;
  cheerleaderCost: number;
  maxAssistants: number;
  assistantCost: number;
  maxDedicatedFans: number;
  dedicatedFanCost: number;
  /** Apothicaire : autorisé ou non, et coût (kpo). */
  apothecaryAllowed: boolean;
  apothecaryCost: number;
  /** Gros Bras (joueurs avec Solitaire/Loner) autorisés à la sélection. */
  bigGuysAllowed: boolean;
  /** Star Players recrutables de façon permanente à la sélection. */
  starPlayersAllowed: boolean;
}

/**
 * Contraintes par format.
 *
 * `bb11` reflète le comportement historique (avant l'introduction du format) :
 * budget 1000k, 11–16 joueurs, staff/relances/apothicaire sans restriction
 * particulière.
 *
 * `sevens` encode les règles officielles de "Blood Bowl à Sept".
 */
export const FORMAT_CONSTRAINTS: Record<GameFormat, FormatConstraints> = {
  bb11: {
    onPitch: 11,
    startingBudget: 1000,
    minPlayers: 11,
    maxPlayers: 16,
    maxNonLinemen: null,
    maxRerolls: 8,
    rerollCostMultiplier: 1,
    maxCheerleaders: 12,
    cheerleaderCost: 10,
    maxAssistants: 6,
    assistantCost: 10,
    maxDedicatedFans: 6,
    dedicatedFanCost: 10,
    apothecaryAllowed: true,
    apothecaryCost: 50,
    bigGuysAllowed: true,
    starPlayersAllowed: true,
  },
  sevens: {
    onPitch: 7,
    startingBudget: 600,
    minPlayers: 7,
    maxPlayers: 11,
    maxNonLinemen: 4,
    maxRerolls: 6,
    rerollCostMultiplier: 2,
    maxCheerleaders: 6,
    cheerleaderCost: 20,
    maxAssistants: 3,
    assistantCost: 20,
    maxDedicatedFans: 6,
    dedicatedFanCost: 20,
    // Le livre autorise 0-1 apothicaire (si la fiche d'équipe le permet),
    // au tarif Sevens de 80 000 po.
    apothecaryAllowed: true,
    apothecaryCost: 80,
    // Gros Bras autorisés dans la limite de la fiche d'équipe (non bannis).
    bigGuysAllowed: true,
    // Les Star Players sont des "coups de pouce" d'avant-match, pas des
    // recrues permanentes en Sevens → désactivés à la sélection.
    starPlayersAllowed: false,
  },
};

export function isGameFormat(value: unknown): value is GameFormat {
  return value === "bb11" || value === "sevens";
}

export function getFormatConstraints(format: GameFormat): FormatConstraints {
  return FORMAT_CONSTRAINTS[format] ?? FORMAT_CONSTRAINTS[DEFAULT_FORMAT];
}

/**
 * Un "Lineman" est le poste de base d'une équipe : sa limitation est 0-12
 * voire 0-16 (cf. règles officielles Sevens). Heuristique robuste même pour
 * les linemen renommés (Zombie, Brawler, etc.) : `max >= 12`.
 */
export function isLineman(position: Pick<PositionDefinition, "max">): boolean {
  return position.max >= 12;
}

/** Un Gros Bras possède la compétence Solitaire (Loner). */
export function isBigGuy(position: Pick<PositionDefinition, "skills">): boolean {
  return /(^|,)\s*loner/i.test(position.skills ?? "");
}

/**
 * Compte les joueurs NON-Linemen sélectionnés (postes spécialisés + Gros Bras),
 * d'après les positions du roster et la map slug→count.
 */
export function countNonLinemen(
  positions: ReadonlyArray<PositionDefinition>,
  counts: Readonly<Record<string, number>>,
): number {
  let total = 0;
  for (const p of positions) {
    if (isLineman(p)) continue;
    total += Math.max(0, counts[p.slug] ?? 0);
  }
  return total;
}

/**
 * Positions sélectionnables pour un format donné. Filtre les Gros Bras si le
 * format les interdit (`bigGuysAllowed: false`). Aujourd'hui aucun format ne
 * les bannit, mais l'option est prête.
 */
export function getSelectablePositions(
  positions: ReadonlyArray<PositionDefinition>,
  format: GameFormat,
): PositionDefinition[] {
  const c = getFormatConstraints(format);
  if (c.bigGuysAllowed) return [...positions];
  return positions.filter((p) => !isBigGuy(p));
}

export interface FormatTeamSelection {
  format: GameFormat;
  positions: ReadonlyArray<PositionDefinition>;
  /** Map slug → nombre choisi. */
  counts: Readonly<Record<string, number>>;
  starPlayerCount: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
}

export interface FormatValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valide une sélection d'équipe vis-à-vis des contraintes de format (hors
 * budget et hors min/max par poste, gérés en amont par le handler). Pur et
 * testable. Renvoie la première violation rencontrée.
 */
export function validateFormatSelection(
  input: FormatTeamSelection,
): FormatValidationResult {
  const c = getFormatConstraints(input.format);

  const totalPlayers = Object.values(input.counts).reduce(
    (sum, n) => sum + Math.max(0, n ?? 0),
    0,
  );

  if (totalPlayers < c.minPlayers || totalPlayers > c.maxPlayers) {
    return {
      valid: false,
      error: `Il faut entre ${c.minPlayers} et ${c.maxPlayers} joueurs`,
    };
  }

  if (c.maxNonLinemen !== null) {
    const nonLinemen = countNonLinemen(input.positions, input.counts);
    if (nonLinemen > c.maxNonLinemen) {
      return {
        valid: false,
        error: `Maximum ${c.maxNonLinemen} joueurs non-Linemen (postes spécialisés) en ${input.format === "sevens" ? "Blood Bowl à Sept" : "Blood Bowl"}`,
      };
    }
  }

  if (!c.bigGuysAllowed) {
    const hasBigGuy = input.positions.some(
      (p) => isBigGuy(p) && Math.max(0, input.counts[p.slug] ?? 0) > 0,
    );
    if (hasBigGuy) {
      return { valid: false, error: "Les Gros Bras ne sont pas autorisés dans ce format" };
    }
  }

  if (!c.starPlayersAllowed && input.starPlayerCount > 0) {
    return {
      valid: false,
      error: "Les Star Players ne sont pas recrutables à la sélection dans ce format",
    };
  }

  if (totalPlayers + input.starPlayerCount > c.maxPlayers) {
    return {
      valid: false,
      error: `Trop de joueurs : ${totalPlayers} + ${input.starPlayerCount} Star Players (maximum ${c.maxPlayers})`,
    };
  }

  if (input.rerolls > c.maxRerolls) {
    return { valid: false, error: `Maximum ${c.maxRerolls} relances dans ce format` };
  }
  if (input.cheerleaders > c.maxCheerleaders) {
    return { valid: false, error: `Maximum ${c.maxCheerleaders} cheerleaders dans ce format` };
  }
  if (input.assistants > c.maxAssistants) {
    return { valid: false, error: `Maximum ${c.maxAssistants} coachs assistants dans ce format` };
  }
  if (input.dedicatedFans > c.maxDedicatedFans) {
    return { valid: false, error: `Maximum ${c.maxDedicatedFans} fans dévoués dans ce format` };
  }
  if (input.apothecary && !c.apothecaryAllowed) {
    return { valid: false, error: "L'apothicaire n'est pas autorisé dans ce format" };
  }

  return { valid: true };
}
