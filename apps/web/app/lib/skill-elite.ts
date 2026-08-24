/**
 * Compétences d'Élite.
 *
 * Une compétence marquée « Élite » (Saison 3) augmente la valeur du joueur
 * qui l'acquiert de 10 000 po supplémentaires (donc 30 000 po pour une
 * compétence primaire au lieu de 20 000). La donnée vient de `Skill.isElite`
 * (API `/api/skills`).
 *
 * Ce module centralise le libellé, l'explication et le style du badge pour
 * que la liste `/skills`, la fiche `/skills/[slug]`, les infobulles et les
 * rosters affichent exactement la même chose — même logique que
 * `skill-activation.ts` pour Actif/Passif.
 */

/** Surcoût de valeur d'équipe d'une compétence Élite (po). */
export const ELITE_SKILL_EXTRA_COST = 10_000;

/** Libellé court du badge (« Élite »). */
export function getSkillEliteLabel(language: string): string {
  return language === "fr" ? "Élite" : "Elite";
}

/** Phrase d'explication (attribut `title` du badge, lu par les lecteurs d'écran). */
export function getSkillEliteHint(language: string): string {
  return language === "fr"
    ? "Compétence Élite : +10 000 po sur la valeur du joueur qui l'acquiert (30 000 po au lieu de 20 000 en compétence primaire)."
    : "Elite skill: +10,000 gp added to the value of the player who takes it (30,000 gp instead of 20,000 as a primary skill).";
}

/** Classes de couleur du badge, communes à toutes les surfaces d'affichage. */
export const SKILL_ELITE_BADGE_CLASSES = "bg-amber-100 text-amber-800";

/** Variante « bordurée » utilisée sur la fiche détail (fond crème). */
export const SKILL_ELITE_OUTLINED_CLASSES =
  "border-amber-300 bg-amber-50 text-amber-800";

/** Variante lisible sur fond sombre (infobulles). */
export const SKILL_ELITE_DARK_CLASSES =
  "bg-amber-500/20 text-amber-200 border-amber-400/40";
