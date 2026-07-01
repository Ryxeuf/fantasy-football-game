/**
 * Tableau de Compétences aléatoires — Blood Bowl 2025 / Saison 3 (livre p.121).
 *
 * Utilisé par l'amélioration « Déterminer au hasard une Compétence Principale »
 * (random-primary), moins chère que le choix libre (cf. tableau des
 * améliorations). Règle du livre :
 *
 *   1. Le coach choisit une **catégorie** parmi les catégories Principales de
 *      la position du joueur.
 *   2. On jette 2D6 : le 1er dé désigne le bloc (1-3 = haut, 4-6 = bas), le 2e
 *      la ligne (1-6). Cela donne UNE compétence de la catégorie.
 *   3. On répète → 2 compétences candidates ; le coach en choisit UNE.
 *   4. Si une compétence tirée est déjà possédée / inutilisable, on relance.
 *
 * Le tirage 2D6 (bloc 50/50 puis ligne uniforme) équivaut à un tirage
 * **uniforme** parmi les 12 compétences de la catégorie. On encode donc la
 * liste ordonnée p.121 par catégorie (ordre conservé pour la traçabilité) et
 * `rollRandomPrimaryCandidates` tire des candidats distincts, hors compétences
 * possédées, de façon déterministe (seed) pour être reproductible et
 * vérifiable côté serveur (anti-triche).
 *
 * Codes catégorie (canoniques, cf. apps/server skill-access) :
 *   A=Agilité, S=Force, G=Générales, M=Mutation, P=Passe, K=Scélérates.
 *
 * NB Saison 3 : `provocation` (Provocation) est en **Générales** et `clearance`
 * (Dégagement) en **Passe** d'après p.121 — la catégorie DB S3 est alignée via
 * `SEASON_3_CATEGORY_CHANGES` (apps/server), sinon le contrôle d'accès au
 * level-up les rejetterait.
 */

import { makeRNG } from "../utils/rng";

export type RandomSkillCategoryCode = "A" | "S" | "G" | "M" | "P" | "K";

/**
 * 12 compétences (slugs kebab-case, alignés sur la table `Skill`) par
 * catégorie, dans l'ordre du livre p.121 (bloc 1-3 lignes 1→6, puis bloc 4-6
 * lignes 1→6).
 */
export const RANDOM_PRIMARY_SKILL_TABLE_2025: Readonly<
  Record<RandomSkillCategoryCode, readonly string[]>
> = {
  // Agilité
  A: [
    "catch", // Réception
    "diving-catch", // Réception Plongeante
    "diving-tackle", // Tacle Plongeant
    "dodge", // Esquive
    "defensive", // Défenseur
    "hit-and-run", // Frappe-et-court
    "jump-up", // Rétablissement
    "leap", // Saut
    "safe-pair-of-hands", // Libération
    "sidestep", // Glissade Contrôlée
    "sprint", // Sprint
    "sure-feet", // Équilibre
  ],
  // Force
  S: [
    "arm-bar", // Clé de Bras
    "brawler", // Bagarreur
    "break-tackle", // Esquive en Force
    "bullseye", // Dans le Mille
    "grab", // Projection
    "guard", // Garde
    "juggernaut", // Juggernaut
    "mighty-blow-1", // Châtaigne
    "multiple-block", // Blocage Multiple
    "stand-firm", // Stabilité
    "strong-arm", // Bras Musclé
    "thick-skull", // Crâne Épais
  ],
  // Générales
  G: [
    "block", // Blocage
    "dauntless", // Intrépide
    "fend", // Parade
    "frenzy", // Frénésie
    "kick", // Frappe Précise
    "pro", // Pro
    "surefoot", // Appuis Sûrs
    "strip-ball", // Arracher le Ballon
    "sure-hands", // Prise Sûre
    "tackle", // Tacle
    "provocation", // Provocation
    "wrestle", // Lutte
  ],
  // Mutation
  M: [
    "big-hand", // Main Démesurée
    "claws", // Griffes
    "disturbing-presence", // Présence Perturbante
    "extra-arms", // Bras Supplémentaires
    "foul-appearance", // Répulsion
    "horns", // Cornes
    "iron-hard-skin", // Peau de Fer
    "monstrous-mouth", // Grande Gueule
    "prehensile-tail", // Queue Préhensile
    "tentacles", // Tentacules
    "two-heads", // Deux Têtes
    "very-long-legs", // Très Longues Jambes
  ],
  // Passe
  P: [
    "accurate", // Précision
    "cannoneer", // Canonnier
    "cloud-burster", // Perce-nuages
    "dump-off", // Délestage
    "running-pass-2025", // Transmission dans la Course
    "hail-mary-pass", // Passe Désespérée
    "leader", // Chef
    "nerves-of-steel", // Nerfs d'Acier
    "on-the-ball", // Sur le Ballon
    "pass", // Passe
    "clearance", // Dégagement
    "safe-pass", // Passe Assurée
  ],
  // Scélérates
  K: [
    "dirty-player-1", // Joueur Déloyal
    "fork", // Fourchette
    "fumblerooskie", // Fumberooski
    "fatal-flight", // Vol Fatal
    "solitary-aggressor", // Agresseur Solitaire
    "pile-driver", // Marteau-pilon
    "boot-to-the-head", // Coup de Crampons
    "lightning-aggression", // Agression Éclair
    "saboteur", // Saboteur
    "shadowing", // Poursuite
    "sneaky-git", // Sournois
    "violent-innovator", // Innovateur Violent
  ],
};

/** Vrai si `code` est une catégorie tirable au hasard. */
export function isRandomSkillCategory(
  code: string,
): code is RandomSkillCategoryCode {
  return code in RANDOM_PRIMARY_SKILL_TABLE_2025;
}

/**
 * Tire `count` (défaut 2) compétences candidates DISTINCTES dans la catégorie,
 * en excluant les compétences déjà possédées (reroll des doublons implicite),
 * de façon déterministe via `seed` (reproductible côté serveur pour valider le
 * choix du coach). Renvoie moins de `count` candidats si le pool disponible est
 * plus petit (ex: joueur possédant presque toute la catégorie).
 */
export function rollRandomPrimaryCandidates(params: {
  category: RandomSkillCategoryCode;
  ownedSlugs: readonly string[];
  seed: string;
  count?: number;
}): string[] {
  const { category, ownedSlugs, seed } = params;
  const count = params.count ?? 2;
  const owned = new Set(ownedSlugs);
  const available = (RANDOM_PRIMARY_SKILL_TABLE_2025[category] ?? []).filter(
    (slug) => !owned.has(slug),
  );

  // Mélange de Fisher-Yates seedé → tirage sans remise (candidats distincts).
  const rng = makeRNG(`${seed}:random-primary`);
  const arr = [...available];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}
