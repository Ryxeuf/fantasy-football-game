/**
 * Réimport idempotent des accès Primaire/Secondaire de compétences sur les
 * positions Season 3 existantes, depuis la source canonique
 * `SKILL_ACCESS_SEASON3` (générée depuis data/positionnels-bloodbowl-2025.md).
 *
 * Ne touche QUE les colonnes `primarySkills`/`secondarySkills` des positions
 * `ruleset = season_3` (pas de wipe des équipes / relations de skills, contrai-
 * rement au seed complet). Sûr à rejouer plusieurs fois.
 *
 * Exposé via :
 *   - POST /admin/utilities/reimport-season3-access (bouton admin)
 *   - scripts/reimport-season3-access.ts (CLI conteneur)
 */

import { prisma } from "../prisma";
import { SKILL_ACCESS_SEASON3 } from "../../../../packages/game-engine/src/rosters/skill-access-season3";
import { toCanonicalAccessCsv } from "../services/skill-access";

export interface ReimportSeason3AccessResult {
  /** Nombre de rosters season_3 parcourus. */
  readonly rosters: number;
  /** Nombre total de positions season_3 vues. */
  readonly positionsTotal: number;
  /** Positions effectivement mises à jour (avec entrée d'accès). */
  readonly updated: number;
  /** Slugs de positions sans entrée dans la map d'accès (ignorées). */
  readonly missing: readonly string[];
}

/**
 * Écrit `primary/secondarySkills` sur chaque position season_3 à partir de
 * `SKILL_ACCESS_SEASON3[slug]`. Les valeurs sont repassées par
 * `toCanonicalAccessCsv` (dédup + ordre canonique, reconnaît `K`). Une chaîne
 * vide (`""`) reste vide = « pool renseigné mais vide » (positions animales).
 */
export async function reimportSeason3SkillAccess(): Promise<ReimportSeason3AccessResult> {
  const rosters = await prisma.roster.findMany({
    where: { ruleset: "season_3" as never },
    select: { id: true, positions: { select: { id: true, slug: true } } },
  });

  let positionsTotal = 0;
  let updated = 0;
  const missing: string[] = [];

  for (const roster of rosters) {
    for (const pos of roster.positions) {
      positionsTotal++;
      const access = SKILL_ACCESS_SEASON3[pos.slug];
      if (!access) {
        missing.push(pos.slug);
        continue;
      }
      await prisma.position.update({
        where: { id: pos.id },
        data: {
          primarySkills: toCanonicalAccessCsv(access.primary),
          secondarySkills: toCanonicalAccessCsv(access.secondary),
        },
      });
      updated++;
    }
  }

  return { rosters: rosters.length, positionsTotal, updated, missing };
}
