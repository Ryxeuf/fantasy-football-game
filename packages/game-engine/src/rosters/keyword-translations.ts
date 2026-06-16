/**
 * Traduction FR → EN des mots-clés de position (lignée/race + type de joueur).
 *
 * Les mots-clés sont stockés en FR (source data/positionnels-bloodbowl-2025.md,
 * cf. keywords-season3.ts). Pour l'affichage EN, on traduit token par token via
 * ce dictionnaire. La clé de lookup est normalisée (minuscule, accents retirés,
 * tirets → espaces) pour absorber les variantes de la source
 * (« Homme Lézard » / « Homme-Lézard », « Homme-Arbre » / « Homme-arbre »).
 *
 * Un token inconnu est laissé tel quel (repli FR) plutôt que perdu.
 */

/** Normalise un token pour le lookup (insensible casse/accents/tirets). */
function normalizeToken(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[-\s]+/g, " ")
    .trim();
}

/** Map clé normalisée FR → libellé EN officiel. */
const EN_BY_NORM: Record<string, string> = {
  // Lignées / races
  amalgame: "Amalgam",
  animal: "Animal",
  elfe: "Elf",
  gnoblar: "Gnoblar",
  gnome: "Gnome",
  gobelin: "Goblin",
  goule: "Ghoul",
  halfling: "Halfling",
  "homme lezard": "Lizardman",
  "homme arbre": "Treeman",
  "homme bete": "Beastman",
  humain: "Human",
  "loup garou": "Werewolf",
  minotaure: "Minotaur",
  "mort vivant": "Undead",
  nain: "Dwarf",
  ogre: "Ogre",
  orque: "Orc",
  rejeton: "Spawn",
  sbire: "Thrall",
  skaven: "Skaven",
  skink: "Skink",
  snotling: "Snotling",
  spectre: "Wraith",
  squelette: "Skeleton",
  troll: "Troll",
  vampire: "Vampire",
  yeti: "Yeti",
  zombie: "Zombie",
  // Types de joueur
  blitzer: "Blitzer",
  bloqueur: "Blocker",
  coureur: "Runner",
  "gros bras": "Big Guy",
  lanceur: "Thrower",
  receveur: "Catcher",
  special: "Special",
  "trois quart": "Lineman",
};

/** Traduit un token FR isolé. Repli : le token original si inconnu. */
export function translateKeywordToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return trimmed;
  return EN_BY_NORM[normalizeToken(trimmed)] ?? trimmed;
}

/**
 * Traduit un CSV de mots-clés (« Elfe, Trois-quart » → « Elf, Lineman »).
 * `lang !== "en"` ⇒ renvoie la chaîne FR inchangée. `null/""` ⇒ inchangé.
 */
export function translateKeywordsCsv(
  csv: string | null | undefined,
  lang: string,
): string | null {
  if (csv == null) return null;
  if (lang !== "en") return csv;
  return csv
    .split(",")
    .map((t) => translateKeywordToken(t))
    .join(", ");
}
