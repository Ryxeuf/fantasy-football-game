/**
 * Accès compétences Primaire/Secondaire — helpers de catégorisation et
 * validation du pool de level-up.
 *
 * Contexte
 * --------
 * `Position.primarySkills` / `secondarySkills` (BB Season 3) encodent, par CSV
 * de codes catégorie `G/A/S/P/M/K`, les catégories où un joueur peut piocher en
 * montée de niveau (primaire vs secondaire). Ce module :
 *   - mappe une catégorie DB (`Skill.category`) vers son code canonique,
 *   - normalise la notation source (la source FR utilise `F` pour Force, EN `S`
 *     pour Strength : on fusionne `F → S`),
 *   - décide si une skill choisie est autorisée pour un type d'avancement.
 *
 * Codes canoniques : `G` Général, `A` Agilité, `S` Force (Strength), `P` Passe,
 * `M` Mutation, `K` Sournoiserie (catégorie DB « Scélérates »). Attention : le
 * code `S` = Force/Strength (la notation officielle FR abrège Force « F » et
 * Sournoiserie « S » — la conversion source→canonique se fait à l'import, pas
 * ici ; cf. scripts/generate-skill-access-season3.ts).
 *
 * Les fonctions pures (sans I/O) sont testables en unitaire ; seul
 * `categoryCodeForSkill` touche la DB (intégration).
 */

import { prisma } from "../prisma";

export type SkillCategoryCode = "G" | "A" | "S" | "P" | "M" | "K";

export type AdvancementAccessType =
  | "primary"
  | "secondary"
  | "random-primary"
  | "random-secondary";

/** Résultat de la vérification d'accès. `no-data` = accès non renseigné. */
export type AccessCheck = "ok" | "out-of-pool" | "no-data";

/** Nom de catégorie DB (`Skill.category`) → code canonique. Les catégories
 *  non pickables (Trait, Extraordinary) renvoient `null`. « Scélérates » =
 *  Sournoiserie, désormais piochable (code `K`) en Season 3. */
const DB_CATEGORY_TO_CODE: Readonly<Record<string, SkillCategoryCode>> = {
  General: "G",
  Agility: "A",
  Strength: "S",
  Passing: "P",
  Mutation: "M",
  "Scélérates": "K",
};

export function dbCategoryToCode(
  category: string | null | undefined,
): SkillCategoryCode | null {
  if (!category) return null;
  return DB_CATEGORY_TO_CODE[category] ?? null;
}

/**
 * Normalise une lettre d'accès **canonique** vers le code canonique.
 * Tolère l'alias `F` (Force) → `S` (les saisies admin historiques abrègent
 * Force « F », le code stocké étant « S »). `K` = Sournoiserie. Lettre
 * inconnue → `null`. NB : la conversion de la notation source officielle
 * (où `S` = Sournoiserie, `F` = Force) se fait à l'import, pas ici.
 */
export function normalizeAccessLetter(
  letter: string,
): SkillCategoryCode | null {
  const u = letter.trim().toUpperCase();
  if (u === "F") return "S"; // alias Force = Strength
  if (
    u === "G" ||
    u === "A" ||
    u === "S" ||
    u === "P" ||
    u === "M" ||
    u === "K"
  ) {
    return u;
  }
  return null;
}

/**
 * Parse une chaîne d'accès en `Set` de codes canoniques. Robuste au format :
 * accepte les codes séparés par virgule (`"G,S"`) comme concaténés (`"GS"`,
 * `"SF"`) — la source originale concatène les lettres. Itère caractère par
 * caractère et normalise (`F→S`, dédoublonnage via le Set).
 */
export function parseAccessCsv(
  csv: string | null | undefined,
): Set<SkillCategoryCode> {
  const out = new Set<SkillCategoryCode>();
  if (!csv) return out;
  for (const ch of csv) {
    const code = normalizeAccessLetter(ch);
    if (code) out.add(code);
  }
  return out;
}

/**
 * Décide si une skill (par son code catégorie) est autorisée pour le type
 * d'avancement, étant donné les CSV d'accès de la position.
 *
 *   - `no-data`     : les deux CSV sont `null` (accès non renseigné) → la
 *                     validation doit être ignorée (rétro-compat season_2).
 *   - `out-of-pool` : skill non catégorisable, ou hors du pool autorisé.
 *   - `ok`          : skill dans le pool autorisé pour ce type.
 *
 * `""` (chaîne vide) compte comme "renseigné, pool vide" (positions animales).
 */
export function checkSkillAccess(params: {
  type: AdvancementAccessType;
  skillCode: SkillCategoryCode | null;
  primarySkills: string | null | undefined;
  secondarySkills: string | null | undefined;
}): AccessCheck {
  const { type, skillCode, primarySkills, secondarySkills } = params;
  if (primarySkills == null && secondarySkills == null) return "no-data";
  if (!skillCode) return "out-of-pool";
  const isPrimaryType = type === "primary" || type === "random-primary";
  const pool = isPrimaryType
    ? parseAccessCsv(primarySkills)
    : parseAccessCsv(secondarySkills);
  return pool.has(skillCode) ? "ok" : "out-of-pool";
}

/** Ordre canonique d'affichage/stockage des codes catégorie. */
const CODE_ORDER: readonly SkillCategoryCode[] = [
  "G",
  "A",
  "S",
  "P",
  "M",
  "K",
];

/**
 * Normalise une saisie d'accès vers une CSV canonique ordonnée (`"G,S"`).
 * Replie F→S, dédoublonne, ignore les caractères invalides. `""` -> `""`.
 * Sert à nettoyer les saisies admin avant stockage.
 */
export function toCanonicalAccessCsv(csv: string): string {
  const set = parseAccessCsv(csv);
  return CODE_ORDER.filter((c) => set.has(c)).join(",");
}

/**
 * Code catégorie d'une skill par `slug` + `ruleset`, via la table `Skill`
 * (source de vérité, slugs kebab-case). `null` si introuvable ou catégorie
 * non pickable.
 */
export async function categoryCodeForSkill(
  slug: string,
  ruleset: string,
): Promise<SkillCategoryCode | null> {
  const skill = await prisma.skill.findFirst({
    // ruleset typé string : la valeur est la même en client Postgres (enum)
    // et SQLite (mappé en String pour les tests).
    where: { slug, ruleset: ruleset as never },
    select: { category: true },
  });
  return dbCategoryToCode(skill?.category);
}
