/**
 * Résolution des compétences Élite.
 *
 * Une compétence marquée `Skill.isElite` (Saison 3) coûte
 * `ELITE_SKILL_SURCHARGE` (+10 000 po) de valeur d'équipe EN PLUS de son
 * surcoût d'avancement — une compétence primaire Élite vaut donc 30 000 po
 * au lieu de 20 000. La source de vérité est la base (éditable en admin),
 * initialisée au seed depuis `SEASON_3_ELITE_SKILLS`.
 */

/** Client minimal : accepte `prisma` comme un `tx` de transaction. */
export interface SkillFindManyClient {
  skill: {
    findMany: (args: {
      where: { isElite: boolean; ruleset?: string };
      select: { slug: boolean };
    }) => Promise<Array<{ slug: string }>>;
  };
}

/**
 * Slugs des compétences Élite pour un ruleset donné (toutes si omis).
 * Tolérant : si le modèle `Skill` est absent (mock de test étroit) ou que la
 * requête échoue, renvoie un ensemble vide — le calcul de VE reste valide,
 * simplement sans surcoût Élite.
 */
export async function getEliteSkillSlugs(
  db: unknown,
  ruleset?: string | null,
): Promise<Set<string>> {
  try {
    const rows = await (db as SkillFindManyClient).skill.findMany({
      where: { isElite: true, ...(ruleset ? { ruleset } : {}) },
      select: { slug: true },
    });
    return new Set(rows.map((r) => r.slug));
  } catch {
    return new Set();
  }
}
