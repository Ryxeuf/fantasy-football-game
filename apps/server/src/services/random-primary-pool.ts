/**
 * Pool de l'amélioration « Compétence Principale au hasard », résolu EN BASE.
 *
 * La table officielle 2D6 (`RANDOM_PRIMARY_SKILL_TABLE_2025`, livre p.121) est
 * une RÈGLE : 12 compétences par catégorie, tirage uniforme. Elle reste donc la
 * liste d'appartenance et l'ordre de référence — comme la table de coup d'envoi
 * (`KICKOFF_EVENTS`), elle ne devient pas administrable.
 *
 * Ce qui, en revanche, est de la DONNÉE et vit en base : la CATÉGORIE d'une
 * compétence (`Skill.category`, éditable en admin) et son caractère
 * sélectionnable (`Skill.excludedFromSelection`). Quand les deux divergent, le
 * tirage propose une compétence que le contrôle d'accès rejette ensuite —
 * l'anti-triche refuse alors un choix pourtant légal (S17 de l'audit).
 *
 * Ce module réconcilie les deux : la table donne la liste, la base la FILTRE.
 * Sont retirées les entrées dont la ligne `Skill` (pour ce ruleset)
 *   - n'existe pas,
 *   - est `excludedFromSelection`,
 *   - a été recatégorisée hors de la catégorie tirée.
 *
 * Le filtre ne fait que retirer, jamais ajouter : une compétence que l'admin
 * déplace VERS une catégorie n'entre pas d'office dans un tableau 2D6 qui n'a
 * que 12 lignes (sinon les variantes non officielles — Châtaigne +2, Joueur
 * Déloyal +2 — deviendraient tirables). Pour retirer une entrée du tirage, il
 * faut donc la recatégoriser ou la marquer `excludedFromSelection`.
 *
 * Les prérequis d'acquisition dépendent du joueur : ils ne retirent pas la
 * compétence du pool mais la rendent inéligible (cf. `RandomPrimaryDraw`).
 *
 * Base injoignable ou catégorie absente en base (miroir sqlite de test) ⇒ la
 * table officielle telle quelle : le tirage reste servi.
 */

import {
  RANDOM_PRIMARY_SKILL_TABLE_2025,
  meetsSkillPrerequisites,
  type RandomSkillCategoryCode,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { dbCategoryToCode } from "./skill-access";

/** Arguments de `rollRandomPrimaryCandidates` résolus en base pour un joueur. */
export interface RandomPrimaryDraw {
  /** Liste ORDONNÉE des compétences tirables de la catégorie. */
  readonly pool: readonly string[];
  /** Compétences du pool que CE joueur ne peut pas acquérir (prérequis). */
  readonly ineligible: ReadonlySet<string>;
}

/**
 * Prépare le tirage d'un joueur : à passer tel quel à
 * `rollRandomPrimaryCandidates`. Le tirage et sa vérification à la validation
 * doivent recevoir les mêmes `ownedSlugs` pour retrouver les mêmes candidats.
 */
export async function resolveRandomPrimaryDraw(
  category: RandomSkillCategoryCode,
  ruleset: string,
  ownedSlugs: readonly string[],
): Promise<RandomPrimaryDraw> {
  const official = RANDOM_PRIMARY_SKILL_TABLE_2025[category] ?? [];
  const fallback = { pool: official, ineligible: new Set<string>() };
  if (official.length === 0) return fallback;

  let rows: Array<{
    slug: string;
    category: string | null;
    excludedFromSelection: boolean;
    requiredSkills?: string | null;
  }>;
  try {
    rows = (await prisma.skill.findMany({
      where: { slug: { in: [...official] }, ruleset: ruleset as never },
      select: {
        slug: true,
        category: true,
        excludedFromSelection: true,
        requiredSkills: true,
      },
    })) as typeof rows;
  } catch {
    return fallback;
  }
  // Aucune ligne : catalogue non seedé pour ce ruleset ⇒ repli intégral,
  // plutôt qu'un pool vide qui bloquerait toute amélioration aléatoire.
  if (rows.length === 0) return fallback;

  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const pool = official.filter((slug) => {
    const row = bySlug.get(slug);
    if (!row) return false;
    if (row.excludedFromSelection) return false;
    return dbCategoryToCode(row.category) === category;
  });
  const ineligible = new Set(
    rows
      .filter((r) => !meetsSkillPrerequisites(r.requiredSkills, ownedSlugs))
      .map((r) => r.slug),
  );
  return { pool, ineligible };
}
