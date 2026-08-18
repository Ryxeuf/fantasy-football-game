/**
 * E8 — Actif / Passif d'une compétence ou d'un trait.
 *
 * Dans le livre de règles, les compétences et traits *passifs* sont soulignés :
 * ils s'appliquent en permanence, sans que le coach ait à les déclencher. Les
 * autres sont *actifs* : il faut les annoncer / les utiliser au bon moment.
 *
 * Ce module centralise le libellé, l'explication et le style du badge pour que
 * la liste `/skills`, la fiche `/skills/[slug]` et les infobulles au survol
 * affichent exactement la même chose. La donnée vient de `Skill.isPassive`
 * (API `/api/skills`), avec repli sur `SkillDefinition.isPassive` du
 * game-engine quand l'API n'est pas jointe.
 */

export type SkillActivation = "active" | "passive";

/** `isPassive` peut être absent (API pré-E8 / fallback) : on retombe sur actif. */
export function getSkillActivation(
  isPassive?: boolean | null,
): SkillActivation {
  return isPassive ? "passive" : "active";
}

/** Libellé court du badge (« Passif » / « Actif »). */
export function getSkillActivationLabel(
  isPassive: boolean | null | undefined,
  language: string,
): string {
  if (getSkillActivation(isPassive) === "passive") {
    return language === "fr" ? "Passif" : "Passive";
  }
  return language === "fr" ? "Actif" : "Active";
}

/** Phrase d'explication (attribut `title` du badge, lu par les lecteurs d'écran). */
export function getSkillActivationHint(
  isPassive: boolean | null | undefined,
  language: string,
): string {
  if (getSkillActivation(isPassive) === "passive") {
    return language === "fr"
      ? "Passif : s'applique en permanence, sans avoir à être déclenché."
      : "Passive: always applies, with nothing to trigger.";
  }
  return language === "fr"
    ? "Actif : doit être déclenché ou annoncé au moment voulu."
    : "Active: must be triggered or declared when relevant.";
}

/** Classes de couleur du badge, communes à toutes les surfaces d'affichage. */
export const SKILL_ACTIVATION_BADGE_CLASSES: Record<SkillActivation, string> = {
  passive: "bg-violet-100 text-violet-800",
  active: "bg-emerald-100 text-emerald-800",
};

/** Variante « bordurée » utilisée sur la fiche détail (fond crème). */
export const SKILL_ACTIVATION_OUTLINED_CLASSES: Record<
  SkillActivation,
  string
> = {
  passive: "border-violet-300 bg-violet-50 text-violet-800",
  active: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

/** Variante lisible sur fond sombre (infobulles). */
export const SKILL_ACTIVATION_DARK_CLASSES: Record<SkillActivation, string> = {
  passive: "bg-violet-500/20 text-violet-200 border-violet-400/40",
  active: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
};
