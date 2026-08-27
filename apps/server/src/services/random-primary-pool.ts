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
 * Base injoignable ou catégorie absente en base (miroir sqlite de test) ⇒ la
 * table officielle telle quelle : le tirage reste servi.
 */

import {
  RANDOM_PRIMARY_SKILL_TABLE_2025,
  type RandomSkillCategoryCode,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { dbCategoryToCode } from "./skill-access";

/**
 * Liste ORDONNÉE des compétences tirables pour cette catégorie et ce ruleset.
 * À passer en `pool` à `rollRandomPrimaryCandidates`.
 */
export async function resolveRandomPrimaryPool(
  category: RandomSkillCategoryCode,
  ruleset: string,
): Promise<readonly string[]> {
  const official = RANDOM_PRIMARY_SKILL_TABLE_2025[category] ?? [];
  if (official.length === 0) return official;

  let rows: Array<{
    slug: string;
    category: string | null;
    excludedFromSelection: boolean;
  }>;
  try {
    rows = (await prisma.skill.findMany({
      where: { slug: { in: [...official] }, ruleset: ruleset as never },
      select: { slug: true, category: true, excludedFromSelection: true },
    })) as typeof rows;
  } catch {
    return official;
  }
  // Aucune ligne : catalogue non seedé pour ce ruleset ⇒ repli intégral,
  // plutôt qu'un pool vide qui bloquerait toute amélioration aléatoire.
  if (rows.length === 0) return official;

  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return official.filter((slug) => {
    const row = bySlug.get(slug);
    if (!row) return false;
    if (row.excludedFromSelection) return false;
    return dbCategoryToCode(row.category) === category;
  });
}
