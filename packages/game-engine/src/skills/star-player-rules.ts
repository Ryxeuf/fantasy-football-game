/**
 * Règles spéciales des Star Players (top 10)
 *
 * Chaque règle est enregistrée comme un SkillEffect dans le skill-registry.
 * Les Star Players portent le slug de leur règle spéciale dans leur liste de skills.
 *
 * Règles "once per game" : vérifiées via GameState.usedStarPlayerRules
 * (clé = "playerId:ruleSlug", valeur = true).
 */

import type { GameState, Player } from '../core/types';
import { registerSkill } from './skill-registry';
import { hasSkill } from './skill-effects';
import { getSkillBySlug, type SkillDefinition } from './index';

// ─── Slugs des règles spéciales de Star Players ──────────────────────────

/** Set of all star player rule slugs for quick lookup */
export const STAR_PLAYER_RULE_SLUGS: ReadonlySet<string> = new Set([
  'blind-rage',
  'slayer',
  'coup-sauvage',
  'la-baliste',
  'consummate-professional',
  'crushing-blow',
  'lord-of-chaos',
  'pirouette',
  'casse-os',
  'reliable',
]);

/** Check if a skill slug is a star player special rule */
export function isStarPlayerRule(slug: string): boolean {
  return STAR_PLAYER_RULE_SLUGS.has(slug);
}

/** Get the star player rules a player has, with display info and usage status */
export function getPlayerStarRules(
  player: Player,
  usedStarPlayerRules?: Record<string, boolean>,
): Array<{
  slug: string;
  nameFr: string;
  nameEn: string;
  description: string;
  isUsed: boolean;
}> {
  const rules: Array<{
    slug: string;
    nameFr: string;
    nameEn: string;
    description: string;
    isUsed: boolean;
  }> = [];

  for (const skill of player.skills) {
    if (!isStarPlayerRule(skill)) continue;
    const def = getSkillBySlug(skill);
    if (!def) continue;

    const key = `${player.id}:${skill}`;
    const isUsed = usedStarPlayerRules?.[key] === true;

    rules.push({
      slug: skill,
      nameFr: def.nameFr,
      nameEn: def.nameEn,
      description: def.description,
      isUsed,
    });
  }

  return rules;
}

// ─── Helpers pour le suivi des règles "once per game" ───────────────────

/**
 * Vérifie si une règle spéciale a déjà été utilisée ce match.
 */
export function isStarPlayerRuleUsed(
  state: GameState,
  playerId: string,
  ruleSlug: string,
): boolean {
  const used = state.usedStarPlayerRules;
  if (!used) return false;
  return used[`${playerId}:${ruleSlug}`] === true;
}

/**
 * Marque une règle spéciale comme utilisée (retourne un nouveau GameState).
 */
export function markStarPlayerRuleUsed(
  state: GameState,
  playerId: string,
  ruleSlug: string,
): GameState {
  return {
    ...state,
    usedStarPlayerRules: {
      ...state.usedStarPlayerRules,
      [`${playerId}:${ruleSlug}`]: true,
    },
  };
}

// ─── 1. BLIND RAGE (Akhorne The Squirrel) ───────────────────────────────
// Peut relancer le D6 pour Intrépide (Dauntless).

registerSkill({
  slug: 'blind-rage',
  triggers: ['on-block-attacker'],
  description: 'Peut relancer le D6 pour Intrépide (Dauntless).',
  canApply: (ctx) => hasSkill(ctx.player, 'blind-rage') && hasSkill(ctx.player, 'dauntless'),
  canReroll: () => true,
});

// ─── 2. SLAYER (Grim Ironjaw) ───────────────────────────────────────────
// Peut relancer les jets d'Intrépide (Dauntless) ratés.

registerSkill({
  slug: 'slayer',
  triggers: ['on-block-attacker'],
  description: 'Peut relancer les jets d\'Intrépide (Dauntless) ratés.',
  canApply: (ctx) => hasSkill(ctx.player, 'slayer') && hasSkill(ctx.player, 'dauntless'),
  canReroll: () => true,
});

// ─── 3. COUP SAUVAGE (Anqi Panqi) ──────────────────────────────────────
// Une fois par partie, relancer n'importe quel nombre de dés de Blocage.

registerSkill({
  slug: 'coup-sauvage',
  triggers: ['on-block-attacker'],
  description: 'Une fois par partie, peut relancer n\'importe quel nombre de dés de Blocage.',
  canApply: (ctx) =>
    hasSkill(ctx.player, 'coup-sauvage') &&
    !isStarPlayerRuleUsed(ctx.state, ctx.player.id, 'coup-sauvage'),
  canReroll: () => true,
});

// ─── 4. LA BALISTE (Morg 'n' Thorg) ────────────────────────────────────
// Une fois par match, relancer un jet de Passe raté.

registerSkill({
  slug: 'la-baliste',
  triggers: ['on-pass'],
  description: 'Une fois par match, peut relancer un jet de Passe raté (Passe ou Lancer de Coéquipier).',
  canApply: (ctx) =>
    hasSkill(ctx.player, 'la-baliste') &&
    !isStarPlayerRuleUsed(ctx.state, ctx.player.id, 'la-baliste'),
  canReroll: () => true,
});

// ─── 5. CONSUMMATE PROFESSIONAL (Griff Oberwald) ────────────────────────
// Une fois par match, relancer n'importe quel dé.

registerSkill({
  slug: 'consummate-professional',
  triggers: ['on-dodge', 'on-block-attacker', 'on-pass', 'on-catch', 'on-pickup', 'on-gfi'],
  description: 'Une fois par match, peut relancer n\'importe quel dé.',
  canApply: (ctx) =>
    hasSkill(ctx.player, 'consummate-professional') &&
    !isStarPlayerRuleUsed(ctx.state, ctx.player.id, 'consummate-professional'),
  canReroll: () => true,
});

// ─── 6. CRUSHING BLOW (Varag Ghoul-Chewer) ──────────────────────────────
// Une fois par match, +1 au jet d'armure après un Blitz.

registerSkill({
  slug: 'crushing-blow',
  triggers: ['on-armor'],
  description: 'Une fois par match, +1 au jet d\'armure après un blocage réussi.',
  canApply: (ctx) =>
    hasSkill(ctx.player, 'crushing-blow') &&
    !isStarPlayerRuleUsed(ctx.state, ctx.player.id, 'crushing-blow'),
  getModifiers: () => ({ armorModifier: 1 }),
});

// ─── 7. LORD OF CHAOS (Lord Borak The Despoiler) ───────────────────────
// L'équipe gagne +1 relance d'équipe pour la première mi-temps.

registerSkill({
  slug: 'lord-of-chaos',
  triggers: ['passive'],
  description: 'L\'équipe gagne +1 relance d\'équipe pour la première mi-temps.',
  canApply: (ctx) => hasSkill(ctx.player, 'lord-of-chaos'),
  specialEffect: (ctx) => {
    if (ctx.state.half !== 1) return null;

    const teamKey = ctx.player.team === 'A' ? 'teamA' : 'teamB';
    return {
      teamRerolls: {
        ...ctx.state.teamRerolls,
        [teamKey]: ctx.state.teamRerolls[teamKey] + 1,
      },
    };
  },
});

// ─── 8. PIROUETTE (Roxanna Darknail) ────────────────────────────────────
// Une fois par tour, +1 au jet d'esquive.

registerSkill({
  slug: 'pirouette',
  triggers: ['on-dodge'],
  description: 'Une fois par tour, +1 au jet d\'esquive.',
  canApply: (ctx) =>
    hasSkill(ctx.player, 'pirouette') &&
    !isStarPlayerRuleUsed(ctx.state, ctx.player.id, 'pirouette'),
  getModifiers: () => ({ dodgeModifier: 1 }),
});

// ─── 9. CASSE-OS (Mighty Zug) ──────────────────────────────────────────
// Une fois par match, +1 en Force (ST) sur un blocage.

registerSkill({
  slug: 'casse-os',
  triggers: ['on-block-attacker'],
  description: 'Une fois par match, +1 en Force lors d\'un blocage.',
  canApply: (ctx) =>
    hasSkill(ctx.player, 'casse-os') &&
    !isStarPlayerRuleUsed(ctx.state, ctx.player.id, 'casse-os'),
  getModifiers: () => ({ strengthModifier: 1 }),
});

// ─── 10. RELIABLE (Deeproot Strongbranch) ───────────────────────────────
// Un Lancer de Coéquipier raté ne cause pas de turnover.

registerSkill({
  slug: 'reliable',
  triggers: ['on-pass'],
  description: 'Un Lancer de Coéquipier raté ne cause pas de turnover.',
  canApply: (ctx) => hasSkill(ctx.player, 'reliable'),
  specialEffect: (ctx) => {
    // Prevent turnover on failed TTM
    return { isTurnover: false };
  },
});
