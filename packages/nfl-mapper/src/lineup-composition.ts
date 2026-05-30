/**
 * Caps de composition de lineup par "style de jeu" (Nuffle Coach).
 *
 * Game design (cf. session 2026-05-30) : pour eviter le meta degenere
 * "11 postes offensifs premium empiles", le coach choisit un STYLE DE JEU
 * en debut de saison. Ce style definit des PLAFONDS (max) par archetype.
 *
 * Principes :
 *  - Ce sont des **maximums uniquement**, jamais des minimums. Un plafond
 *    n'oblige jamais a aligner un joueur qu'on n'a pas → robuste aux
 *    blessures (si ton QB se blesse, "max 2 passers" ne te force a rien).
 *  - Seuls les archetypes **offensifs premium** sont plafonnes
 *    (passer / rusher / receiver / bigGuy). Les fillers — lineman,
 *    frontSeven, secondary — restent **non plafonnes** (absents du
 *    tableau). Garantit qu'un coach peut TOUJOURS completer ses 11
 *    titulaires meme avec un roster decime.
 *  - Pur, deterministe, sans I/O : reutilisable cote serveur (validation
 *    setLineup) et cote web (preview des caps dans l'UI).
 *
 * La classification d'un titulaire en archetype se fait via le **poste
 * NFL** (`getArchetypeFromNflPosition`), pas le poste BB : un RB reste un
 * `rusher` quelle que soit la race (Blitzer / Ulfwerener / Bloodspawn...).
 */
import type { CompositionArchetype } from "./position-to-bb.js";

/**
 * Styles de jeu disponibles. Choisis a la creation de l'entry, modifiable
 * tant que la semaine en cours n'est pas lockee.
 */
export type PlayStyle = "balanced" | "offensive" | "air_raid" | "defensive";

export const PLAY_STYLES: readonly PlayStyle[] = [
  "balanced",
  "offensive",
  "air_raid",
  "defensive",
];

/** Style par defaut si l'entry n'en a pas choisi (retro-compat pre-feature). */
export const DEFAULT_PLAY_STYLE: PlayStyle = "balanced";

/**
 * Plafond par archetype. Une cle absente = archetype **non plafonne**
 * (filler libre). On ne liste donc que les archetypes premium contraints.
 */
export type ArchetypeCaps = Partial<Record<CompositionArchetype, number>>;

/**
 * Tableau central des presets. Tuner ici pour ajuster le meta — une seule
 * source de verite, partagee serveur + web.
 *
 * Plafonds exprimes sur 11 titulaires. lineman / frontSeven / secondary
 * volontairement absents = illimites (faisabilite garantie).
 */
export const PLAY_STYLE_CAPS: Readonly<Record<PlayStyle, ArchetypeCaps>> = {
  // Equilibre : casse le stack (max 3 receveurs + 3 rushers + 2 passers).
  balanced: { passer: 2, rusher: 3, receiver: 3, bigGuy: 2 },
  // Offensif : course/reception genereuses, reste cape pour eviter le full-stack.
  offensive: { passer: 2, rusher: 4, receiver: 5, bigGuy: 2 },
  // Air-raid : jeu aerien extreme (jusqu'a 6 receveurs) mais course bridee.
  air_raid: { passer: 2, rusher: 1, receiver: 6, bigGuy: 1 },
  // Defensif : offense limitee a 5 slots premium (1+2+2) → force la defense.
  defensive: { passer: 1, rusher: 2, receiver: 2, bigGuy: 3 },
};

/** Type guard : true si `s` est un PlayStyle connu. */
export function isPlayStyle(s: unknown): s is PlayStyle {
  return (
    typeof s === "string" && (PLAY_STYLES as readonly string[]).includes(s)
  );
}

/**
 * Normalise une valeur potentiellement nulle/inconnue (ex: champ DB
 * optionnel) vers un PlayStyle valide. Fallback sur le style par defaut.
 */
export function coercePlayStyle(s: unknown): PlayStyle {
  return isPlayStyle(s) ? s : DEFAULT_PLAY_STYLE;
}

/** Retourne les caps d'un style (tolerant aux valeurs invalides). */
export function getCapsForStyle(style: unknown): ArchetypeCaps {
  return PLAY_STYLE_CAPS[coercePlayStyle(style)];
}

/** Une violation de plafond detectee sur un lineup. */
export interface CompositionViolation {
  readonly archetype: CompositionArchetype;
  readonly count: number;
  readonly cap: number;
}

/**
 * Verifie une liste d'archetypes (un par titulaire) contre les plafonds du
 * style. Retourne la liste des violations (vide = lineup conforme).
 *
 * Pur : aucune exception levee, aucune I/O. Le caller decide quoi faire
 * des violations (throw cote service, warning cote UI).
 *
 * @param archetypes - archetype de chaque titulaire (ordre indifferent)
 * @param style - style de jeu de l'entry (tolerant : coerce si invalide)
 */
export function checkComposition(
  archetypes: readonly CompositionArchetype[],
  style: unknown,
): readonly CompositionViolation[] {
  const caps = getCapsForStyle(style);
  const counts = new Map<CompositionArchetype, number>();
  for (const a of archetypes) {
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }

  const violations: CompositionViolation[] = [];
  for (const [arch, cap] of Object.entries(caps) as Array<
    [CompositionArchetype, number]
  >) {
    const count = counts.get(arch) ?? 0;
    if (count > cap) {
      violations.push({ archetype: arch, count, cap });
    }
  }
  // Ordre stable pour des messages d'erreur deterministes.
  violations.sort((a, b) => a.archetype.localeCompare(b.archetype));
  return violations;
}
