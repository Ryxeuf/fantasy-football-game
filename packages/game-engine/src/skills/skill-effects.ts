/**
 * Effets mécaniques des compétences (skills) dans le jeu.
 * Chaque fonction vérifie si un joueur possède un skill et applique l'effet correspondant.
 */

import type { Player } from '../core/types';

/** Vérifie si un joueur possède une compétence donnée (par slug) */
export function hasSkill(player: Player, skillSlug: string): boolean {
  return player.skills.some(
    s => s.toLowerCase() === skillSlug.toLowerCase()
  );
}

// ─── BLOCK ────────────────────────────────────────────────────
/**
 * Sur BOTH_DOWN, un joueur avec Block peut choisir de ne pas tomber.
 * L'adversaire tombe quand même sauf s'il a aussi Block.
 */
export function blockNegatesBothDown(player: Player): boolean {
  return hasSkill(player, 'block');
}

// ─── DODGE ────────────────────────────────────────────────────
/**
 * Sur STUMBLE, si le défenseur a Dodge (et l'attaquant n'a pas Tackle),
 * le résultat devient un PUSH_BACK au lieu d'un renversement.
 * Dodge permet aussi une relance d'esquive ratée (1x par tour).
 */
export function dodgeNegatesStumble(defender: Player, attacker: Player): boolean {
  return hasSkill(defender, 'dodge') && !hasSkill(attacker, 'tackle');
}

export function canRerollDodge(player: Player): boolean {
  return hasSkill(player, 'dodge');
}

// ─── TACKLE ───────────────────────────────────────────────────
/**
 * Tackle annule la compétence Dodge de l'adversaire.
 * Déjà intégré via dodgeNegatesStumble().
 */

// ─── SURE HANDS ───────────────────────────────────────────────
/**
 * Sure Hands permet de relancer un jet de ramassage raté (1x).
 */
export function canRerollPickup(player: Player): boolean {
  return hasSkill(player, 'sure_hands') || hasSkill(player, 'sure hands');
}

// ─── SURE FEET ────────────────────────────────────────────────
/**
 * Sure Feet permet de relancer un jet de GFI raté (1x par activation).
 */
export function canRerollGFI(player: Player): boolean {
  return hasSkill(player, 'sure_feet') || hasSkill(player, 'sure feet');
}

// ─── GUARD ────────────────────────────────────────────────────
/**
 * Guard permet de fournir des assists même quand le joueur est
 * marqué par d'autres adversaires (normalement, être marqué empêche d'assister).
 */
export function hasGuard(player: Player): boolean {
  return hasSkill(player, 'guard');
}

// ─── MIGHTY BLOW ──────────────────────────────────────────────
/**
 * Mighty Blow (+1) ajoute +1 au jet d'armure OU au jet de blessure
 * (choix de l'attaquant, appliqué automatiquement au jet d'armure ici).
 */
export function getMightyBlowBonus(attacker: Player): number {
  if (hasSkill(attacker, 'mighty_blow') || hasSkill(attacker, 'mighty blow')) {
    return 1;
  }
  return 0;
}
