/**
 * Noms d'affichage FR des rosters, indexés par slug.
 *
 * Module volontairement LÉGER (pas d'import des définitions complètes de
 * rosters) pour pouvoir être consommé par le bundle client sans embarquer
 * toutes les positions. La cohérence avec `TEAM_ROSTERS_BY_RULESET`
 * (source de vérité) est verrouillée par `roster-names.test.ts` : tout
 * nouveau roster doit être ajouté ici, sinon le test échoue.
 */

export const ROSTER_NAMES: Record<string, string> = {
  amazon: "Amazones",
  black_orc: "Orques Noirs",
  bretonnian: "Bretonniens",
  chaos_chosen: "Élus du Chaos",
  chaos_dwarf: "Nains du chaos",
  chaos_renegade: "Renégats du Chaos",
  dark_elf: "Elfes noirs",
  dwarf: "Nains",
  elven_union: "Union elfique",
  gnome: "Gnomes",
  goblin: "Gobelins",
  halfling: "Halflings",
  high_elf: "Hauts elfes",
  human: "Humains",
  imperial_nobility: "Noblesse Impériale",
  khorne: "Khorne",
  lizardmen: "Hommes Lézard",
  necromantic_horror: "Horreurs nécromantiques",
  norse: "Nordiques",
  nurgle: "Nurgle",
  ogre: "Ogres",
  old_world_alliance: "Alliance du Vieux Monde",
  orc: "Orques",
  skaven: "Skavens",
  slann: "Slann",
  snotling: "Snotlings",
  tomb_kings: "Rois des tombes",
  undead: "Morts ambulants",
  underworld: "Bas-Fonds",
  vampire: "Vampires",
  wood_elf: "Elfes sylvains",
};

/**
 * Nom lisible d'un roster à partir de son slug. Fallback : le slug
 * lui-même (jamais de texte vide côté UI).
 */
export function getRosterName(slug: string | null | undefined): string {
  if (!slug) return "";
  return ROSTER_NAMES[slug] ?? slug;
}
