/**
 * Initialise `Skill.requiredSkills` depuis le registre du moteur.
 *
 * Ne remplit que les lignes jamais renseignées (`null`) : une fois la valeur
 * posée, c'est l'admin qui fait foi, y compris quand il retire un prérequis
 * (la colonne vaut alors `""`).
 */

import { prisma } from "../prisma";
import { SKILLS_DEFINITIONS } from "../../../../packages/game-engine/src/skills/index";

/** Nombre de lignes `Skill` initialisées. */
export async function syncSkillPrerequisites(): Promise<number> {
  let updated = 0;
  for (const skill of SKILLS_DEFINITIONS) {
    if (!skill.requiredSkills?.length) continue;
    const { count } = await prisma.skill.updateMany({
      where: { slug: skill.slug, requiredSkills: null },
      data: { requiredSkills: skill.requiredSkills.join(",") },
    });
    updated += count;
  }
  return updated;
}
