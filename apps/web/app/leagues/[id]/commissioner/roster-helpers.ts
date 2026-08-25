/**
 * Helpers PURS de l'editeur commissaire : acces competences d'un poste,
 * filtrage/recherche de l'effectif, formatage des montants.
 *
 * Aucun import React : testables en unitaire sans rendu.
 */

import type {
  EditPlayer,
  PositionAccess,
  SkillCatalogItem,
  StaffConfig,
  TeamStaff,
} from "./types";

/** Nom de categorie DB → code canonique (cf. AdvancementEditor). */
export const SKILL_CATEGORY_CODE: Record<string, string> = {
  General: "G",
  Agility: "A",
  Strength: "S",
  Passing: "P",
  Mutation: "M",
  "Scélérates": "K",
};

/** Libelle FR d'une categorie de competence, pour grouper le selecteur. */
export const SKILL_CATEGORY_LABEL: Record<string, string> = {
  G: "Générales",
  A: "Agilité",
  S: "Force",
  P: "Passe",
  M: "Mutation",
  K: "Scélérates",
};

/** Parse un CSV d'acces ("G,S" / "GS", alias F→S) en Set de codes. */
export function parseAccessCodes(csv: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!csv) return out;
  for (const ch of csv.toUpperCase()) {
    if (ch === "F") out.add("S");
    else if ("GASPMK".includes(ch)) out.add(ch);
  }
  return out;
}

export const CHARS = ["MA", "ST", "AG", "PA", "AV"] as const;
export type CharKind = (typeof CHARS)[number];

/**
 * Abreviations FR affichees (M/F/AG/CP/AR). Les codes internes
 * MA/ST/AG/PA/AV restent inchanges cote API/DB.
 */
export const CHAR_LABELS: Record<CharKind, string> = {
  MA: "M",
  ST: "F",
  AG: "AG",
  PA: "CP",
  AV: "AR",
};

/** Valeur courante d'une caracteristique (PA peut etre absente). */
export function charValueOf(player: EditPlayer, kind: CharKind): number | null {
  switch (kind) {
    case "MA":
      return player.ma;
    case "ST":
      return player.st;
    case "AG":
      return player.ag;
    case "PA":
      return player.pa;
    case "AV":
      return player.av;
  }
}

/** Competences possedees par un joueur (CSV → liste de slugs). */
export function skillsOf(player: EditPlayer): string[] {
  return player.skills
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export interface SkillOption {
  slug: string;
  nameFr: string;
  /** Code de categorie canonique (G/A/S/P/M/K). */
  code: string;
  /** La competence est-elle dans l'acces PRIMAIRE du poste ? */
  primary: boolean;
}

/**
 * Competences selectionnables pour un joueur : catalogue filtre par le pool
 * d'acces primaire+secondaire de son poste, moins celles deja possedees.
 * Triees primaire d'abord, puis par nom.
 */
export function accessibleSkills(
  catalog: readonly SkillCatalogItem[],
  access: PositionAccess | undefined,
  owned: readonly string[],
): SkillOption[] {
  if (!access) return [];
  const primary = parseAccessCodes(access.primarySkills);
  const secondary = parseAccessCodes(access.secondarySkills);
  const ownedSet = new Set(owned);
  return catalog
    .flatMap((c) => {
      const code = SKILL_CATEGORY_CODE[c.category];
      if (code === undefined || ownedSet.has(c.slug)) return [];
      if (!primary.has(code) && !secondary.has(code)) return [];
      return [
        { slug: c.slug, nameFr: c.nameFr, code, primary: primary.has(code) },
      ];
    })
    .sort((a, b) =>
      a.primary === b.primary
        ? a.nameFr.localeCompare(b.nameFr)
        : a.primary
          ? -1
          : 1,
    );
}

export type RosterFilter = "all" | "alive" | "dead";

/**
 * Filtre l'effectif : statut + recherche libre (nom, numero, poste). La
 * recherche est insensible a la casse et aux accents.
 */
export function filterPlayers(
  players: readonly EditPlayer[],
  filter: RosterFilter,
  query: string,
  positionLabel: (slug: string) => string,
): EditPlayer[] {
  const needle = normalize(query);
  return players.filter((p) => {
    if (filter === "alive" && p.dead) return false;
    if (filter === "dead" && !p.dead) return false;
    if (needle.length === 0) return true;
    const haystack = normalize(
      `${p.name} ${p.number} ${positionLabel(p.position)}`,
    );
    return haystack.includes(needle);
  });
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Montant en po, format francais (ex: « 50 000 po »). */
export function formatGold(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} po`;
}

/** Montant SIGNE en po, pour un differentiel (ex: « +60 000 po »). */
export function formatGoldDelta(amount: number): string {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toLocaleString("fr-FR")} po`;
}

/**
 * Cout du differentiel de staff — miroir client de `staffCostDelta`
 * (serveur), pour annoncer le montant AVANT d'enregistrer. Le serveur
 * reste l'autorite : il recalcule et refuse un debit impossible.
 */
export function staffCostDelta(
  before: TeamStaff,
  after: TeamStaff,
  config: StaffConfig,
): number {
  const apothecary = (after.apothecary ? 1 : 0) - (before.apothecary ? 1 : 0);
  return (
    (after.rerolls - before.rerolls) * config.rerollCost +
    (after.cheerleaders - before.cheerleaders) * config.cheerleaderCost +
    (after.assistants - before.assistants) * config.assistantCost +
    (after.dedicatedFans - before.dedicatedFans) * config.dedicatedFanCost +
    apothecary * config.apothecaryCost
  );
}
