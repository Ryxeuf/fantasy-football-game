/**
 * Coûts unitaires des relances d'équipe (po entiers).
 *
 * Source unique de vérité — slugs alignés sur `season3-rosters.ts` /
 * `positions.ts` (ex. `black_orc`, pas `blackorc`).
 *
 * Consommé par le builder web, le serveur (VE/VEA, achats) et les calculs
 * de trésorerie via `getRerollCost`.
 */

/** Coût par défaut si le roster est inconnu (50k po — règle BB courante). */
export const DEFAULT_REROLL_COST = 50_000;

/**
 * Coûts officiels Blood Bowl 2020 / Season 3, indexés par slug canonique.
 */
export const REROLL_COSTS: Record<string, number> = {
  amazon: 60_000,
  black_orc: 60_000,
  bretonnian: 60_000,
  chaos_chosen: 60_000,
  chaos_dwarf: 70_000,
  chaos_renegade: 60_000,
  dark_elf: 50_000,
  dwarf: 50_000,
  elven_union: 50_000,
  gnome: 50_000,
  goblin: 60_000,
  halfling: 60_000,
  high_elf: 50_000,
  human: 50_000,
  imperial_nobility: 70_000,
  khorne: 60_000,
  lizardmen: 70_000,
  necromantic_horror: 70_000,
  norse: 60_000,
  nurgle: 60_000,
  ogre: 60_000,
  old_world_alliance: 50_000,
  orc: 60_000,
  skaven: 50_000,
  slann: 70_000,
  snotling: 60_000,
  tomb_kings: 70_000,
  underworld: 70_000,
  undead: 70_000,
  vampire: 70_000,
  wood_elf: 50_000,
};

/**
 * Anciens slugs (pré-migration underscore) encore présents en DB ou tests.
 * Résolus vers le slug canonique avant lookup.
 */
const LEGACY_REROLL_SLUG_ALIASES: Record<string, string> = {
  blackorc: "black_orc",
  chaos: "chaos_chosen",
  chaosdwarf: "chaos_dwarf",
  chaosrenegades: "chaos_renegade",
  darkelf: "dark_elf",
  elvenunion: "elven_union",
  highelf: "high_elf",
  imperial: "imperial_nobility",
  necromantic: "necromantic_horror",
  oldworldalliance: "old_world_alliance",
  tombkings: "tomb_kings",
  woodelf: "wood_elf",
};

export function resolveRosterSlugForReroll(roster: string): string {
  return LEGACY_REROLL_SLUG_ALIASES[roster] ?? roster;
}

export function getRerollCost(roster: string): number {
  const slug = resolveRosterSlugForReroll(roster);
  return REROLL_COSTS[slug] ?? DEFAULT_REROLL_COST;
}

export function getAllRerollCosts(): Readonly<Record<string, number>> {
  return REROLL_COSTS;
}
