/**
 * Système de compétences modulaire (architecture plugin)
 * Chaque skill est un objet avec canApply(), apply() et description
 * Permet d'ajouter facilement de nouvelles compétences sans modifier le code existant
 */

import type { Player, GameState, RNG, BlockResult } from '../core/types';
import { hasSkill } from './skill-effects';

// ─── Types de contexte pour l'application des skills ─────────────────────

export type SkillTrigger =
  | 'on-block-attacker'      // L'attaquant lors d'un bloc
  | 'on-block-defender'      // Le défenseur lors d'un bloc
  | 'on-block-result'        // Modification du résultat de bloc
  | 'on-dodge'               // Lors d'un jet d'esquive
  | 'on-gfi'                 // Lors d'un GFI
  | 'on-pickup'              // Lors d'un ramassage
  | 'on-pass'                // Lors d'une passe
  | 'on-catch'               // Lors d'une réception
  | 'on-armor'               // Lors d'un jet d'armure
  | 'on-injury'              // Lors d'un jet de blessure
  | 'on-foul'                // Lors d'une faute
  | 'on-movement'            // Lors d'un mouvement
  | 'on-turnover'            // Lors d'un turnover
  | 'on-setup'               // Lors du placement
  | 'on-kickoff'             // Lors du kickoff
  | 'on-activation'          // Au début de l'activation du joueur (ex: Bone Head)
  | 'passive';               // Effet passif permanent

export interface SkillContext {
  player: Player;
  opponent?: Player;
  state: GameState;
  rng?: RNG;
  blockResult?: BlockResult;
  diceRoll?: number;
  targetNumber?: number;
}

export interface SkillModifier {
  dodgeModifier?: number;
  pickupModifier?: number;
  passModifier?: number;
  catchModifier?: number;
  armorModifier?: number;
  injuryModifier?: number;
  gfiModifier?: number;
  strengthModifier?: number;
  movementModifier?: number;
  blockDiceModifier?: number; // +1 = additional die for attacker
}

export interface SkillEffect {
  slug: string;
  triggers: SkillTrigger[];
  description: string;

  /** Vérifie si cette compétence peut s'appliquer dans le contexte */
  canApply: (ctx: SkillContext) => boolean;

  /** Retourne les modificateurs à appliquer */
  getModifiers?: (ctx: SkillContext) => SkillModifier;

  /** Modifie le résultat d'un bloc (ex: Block, Dodge, Wrestle) */
  modifyBlockResult?: (ctx: SkillContext) => BlockResult | null;

  /** Indique si le joueur peut relancer un jet */
  canReroll?: (ctx: SkillContext) => boolean;

  /** Effet spécial non-standard */
  specialEffect?: (ctx: SkillContext) => Partial<GameState> | null;
}

// ─── Registre global des skills ──────────────────────────────────────────

const skillRegistry: Map<string, SkillEffect> = new Map();

export function registerSkill(effect: SkillEffect): void {
  skillRegistry.set(effect.slug, effect);
}

export function getSkillEffect(slug: string): SkillEffect | undefined {
  const normalized = slug.toLowerCase().replace(/[_ ]/g, '-');
  return skillRegistry.get(normalized);
}

export function getAllRegisteredSkills(): SkillEffect[] {
  return Array.from(skillRegistry.values());
}

export function getSkillsForTrigger(trigger: SkillTrigger): SkillEffect[] {
  return getAllRegisteredSkills().filter(s => s.triggers.includes(trigger));
}

/**
 * Collecte tous les modificateurs applicables pour un joueur dans un contexte
 */
export function collectModifiers(
  player: Player,
  trigger: SkillTrigger,
  ctx: Omit<SkillContext, 'player'>
): SkillModifier {
  const fullCtx: SkillContext = { ...ctx, player };
  const result: SkillModifier = {};

  for (const skill of player.skills) {
    const effect = getSkillEffect(skill);
    if (!effect) continue;
    if (!effect.triggers.includes(trigger)) continue;
    if (!effect.canApply(fullCtx)) continue;
    if (!effect.getModifiers) continue;

    const mods = effect.getModifiers(fullCtx);
    // Additionner les modificateurs
    for (const [key, value] of Object.entries(mods)) {
      const k = key as keyof SkillModifier;
      result[k] = (result[k] ?? 0) + (value as number);
    }
  }

  return result;
}

// ─── Enregistrement des compétences de base ──────────────────────────────

// BLOCK
registerSkill({
  slug: 'block',
  triggers: ['on-block-result'],
  description: 'Sur BOTH_DOWN, le joueur peut choisir de ne pas tomber.',
  canApply: (ctx) => hasSkill(ctx.player, 'block') && ctx.blockResult === 'BOTH_DOWN',
  modifyBlockResult: () => null, // Annule la chute pour ce joueur
});

// DODGE
registerSkill({
  slug: 'dodge',
  triggers: ['on-block-result', 'on-dodge'],
  description: 'Sur STUMBLE, transforme en PUSH_BACK (sauf si l\'attaquant a Tackle). Permet une relance d\'esquive.',
  canApply: (ctx) => hasSkill(ctx.player, 'dodge'),
  modifyBlockResult: (ctx) => {
    if (ctx.blockResult === 'STUMBLE' && ctx.opponent && !hasSkill(ctx.opponent, 'tackle')) {
      return 'PUSH_BACK';
    }
    return null;
  },
  canReroll: (ctx) => ctx.blockResult === undefined, // Reroll pour dodge uniquement (pas bloc)
});

// TACKLE
registerSkill({
  slug: 'tackle',
  triggers: ['on-block-result'],
  description: 'Annule la compétence Dodge de l\'adversaire.',
  canApply: (ctx) => hasSkill(ctx.player, 'tackle') && !!ctx.opponent && hasSkill(ctx.opponent, 'dodge'),
});

// SURE HANDS
registerSkill({
  slug: 'sure-hands',
  triggers: ['on-pickup'],
  description: 'Permet de relancer un jet de ramassage raté.',
  canApply: (ctx) => hasSkill(ctx.player, 'sure_hands') || hasSkill(ctx.player, 'sure hands') || hasSkill(ctx.player, 'sure-hands'),
  canReroll: () => true,
});

// SURE FEET
registerSkill({
  slug: 'sure-feet',
  triggers: ['on-gfi'],
  description: 'Permet de relancer un jet de GFI raté.',
  canApply: (ctx) => hasSkill(ctx.player, 'sure_feet') || hasSkill(ctx.player, 'sure feet') || hasSkill(ctx.player, 'sure-feet'),
  canReroll: () => true,
});

// GUARD
registerSkill({
  slug: 'guard',
  triggers: ['on-block-attacker', 'on-block-defender'],
  description: 'Peut fournir des assists même quand marqué par d\'autres adversaires.',
  canApply: (ctx) => hasSkill(ctx.player, 'guard'),
});

// MIGHTY BLOW (+1)
registerSkill({
  slug: 'mighty-blow',
  triggers: ['on-armor', 'on-injury'],
  description: '+1 au jet d\'armure OU au jet de blessure (automatique).',
  canApply: (ctx) => hasSkill(ctx.player, 'mighty_blow') || hasSkill(ctx.player, 'mighty blow') || hasSkill(ctx.player, 'mighty-blow'),
  getModifiers: () => ({ armorModifier: 1 }), // Appliqué au meilleur choix par le moteur
});

// ─── COMPÉTENCES AVANCÉES ────────────────────────────────────────────────

// DAUNTLESS
registerSkill({
  slug: 'dauntless',
  triggers: ['on-block-attacker'],
  description: 'Si ST inférieure à l\'adversaire, lance un D6 + ST. Si >= ST adverse, la force est considérée comme égale.',
  canApply: (ctx) => {
    if (!hasSkill(ctx.player, 'dauntless')) return false;
    return !!ctx.opponent && ctx.player.st < ctx.opponent.st;
  },
  getModifiers: (ctx) => {
    if (!ctx.rng || !ctx.opponent) return {};
    const roll = Math.floor(ctx.rng() * 6) + 1;
    if (ctx.player.st + roll >= ctx.opponent.st) {
      return { strengthModifier: ctx.opponent.st - ctx.player.st };
    }
    return {};
  },
});

// FRENZY
registerSkill({
  slug: 'frenzy',
  triggers: ['on-block-attacker'],
  description: 'Doit suivre l\'adversaire et bloquer une seconde fois si le premier bloc est un PUSH_BACK ou STUMBLE.',
  canApply: (ctx) => hasSkill(ctx.player, 'frenzy'),
});

// JUMP UP
registerSkill({
  slug: 'jump-up',
  triggers: ['on-movement'],
  description: 'Peut se relever gratuitement (sans dépenser 3 PM). Peut bloquer depuis le sol.',
  canApply: (ctx) => hasSkill(ctx.player, 'jump-up') || hasSkill(ctx.player, 'jump_up'),
});

// STAND FIRM
registerSkill({
  slug: 'stand-firm',
  triggers: ['on-block-defender'],
  description: 'Ne peut pas être repoussé. Le résultat de bloc s\'applique sur place.',
  canApply: (ctx) => hasSkill(ctx.player, 'stand-firm') || hasSkill(ctx.player, 'stand_firm'),
});

// SIDE STEP
registerSkill({
  slug: 'sidestep',
  triggers: ['on-block-defender'],
  description: 'Le joueur choisit la direction de poussée (au lieu de l\'attaquant).',
  canApply: (ctx) => hasSkill(ctx.player, 'sidestep'),
});

// DIRTY PLAYER (+1)
registerSkill({
  slug: 'dirty-player-1',
  triggers: ['on-foul'],
  description: '+1 au jet d\'armure lors d\'une faute.',
  canApply: (ctx) => hasSkill(ctx.player, 'dirty-player-1') || hasSkill(ctx.player, 'dirty_player') || hasSkill(ctx.player, 'dirty player'),
  getModifiers: () => ({ armorModifier: 1 }),
});

// PASS
registerSkill({
  slug: 'pass',
  triggers: ['on-pass'],
  description: 'Permet de relancer un jet de passe raté.',
  canApply: (ctx) => hasSkill(ctx.player, 'pass'),
  canReroll: () => true,
});

// CATCH
registerSkill({
  slug: 'catch',
  triggers: ['on-catch'],
  description: 'Permet de relancer un jet de réception raté.',
  canApply: (ctx) => hasSkill(ctx.player, 'catch'),
  canReroll: () => true,
});

// THICK SKULL
registerSkill({
  slug: 'thick-skull',
  triggers: ['on-injury'],
  description: 'KO seulement sur 9+ au lieu de 8+ (résultat 8 = stunned).',
  canApply: (ctx) => hasSkill(ctx.player, 'thick-skull') || hasSkill(ctx.player, 'thick_skull'),
  getModifiers: () => ({ injuryModifier: -1 }),
});

// STUNTY
registerSkill({
  slug: 'stunty',
  triggers: ['on-armor', 'on-dodge', 'on-pass'],
  description: '+1 au jet d\'esquive, -1 à l\'armure, passes interdites au-delà de courte.',
  canApply: (ctx) => hasSkill(ctx.player, 'stunty'),
  getModifiers: (ctx) => {
    const mods: SkillModifier = {};
    // Contexte esquive : +1 au dodge
    if (ctx.blockResult === undefined) {
      mods.dodgeModifier = 1;
    }
    return mods;
  },
});

// WRESTLE
registerSkill({
  slug: 'wrestle',
  triggers: ['on-block-result'],
  description: 'Sur BOTH_DOWN, les deux joueurs sont mis au sol sans jet d\'armure et sans turnover. Prévaut sur Block.',
  canApply: (ctx) => hasSkill(ctx.player, 'wrestle') && ctx.blockResult === 'BOTH_DOWN',
  modifyBlockResult: () => 'BOTH_DOWN',
});

// FEND
registerSkill({
  slug: 'fend',
  triggers: ['on-block-defender'],
  description: 'L\'attaquant ne peut pas suivre (follow-up) après une poussée.',
  canApply: (ctx) => hasSkill(ctx.player, 'fend'),
});

// STRIP BALL
registerSkill({
  slug: 'strip-ball',
  triggers: ['on-block-attacker'],
  description: 'Si le défenseur est poussé et porte le ballon, celui-ci ne bénéficie pas de son skill Sure Hands.',
  canApply: (ctx) => hasSkill(ctx.player, 'strip-ball') || hasSkill(ctx.player, 'strip_ball'),
});

// PRO
registerSkill({
  slug: 'pro',
  triggers: ['on-dodge', 'on-pickup', 'on-pass', 'on-catch', 'on-block-result', 'on-gfi'],
  description: 'Peut relancer un jet raté sur 3+ (D6). Consomme l\'utilisation une fois par tour.',
  canApply: (ctx) => hasSkill(ctx.player, 'pro'),
  canReroll: () => true, // Le check 3+ est fait au moment de l'application
});

// BREAK TACKLE
registerSkill({
  slug: 'break-tackle',
  triggers: ['on-dodge'],
  description: 'Peut utiliser la Force (ST) au lieu de l\'Agilité (AG) pour un jet d\'esquive.',
  canApply: (ctx) => hasSkill(ctx.player, 'break-tackle') || hasSkill(ctx.player, 'break_tackle'),
  getModifiers: (ctx) => {
    // Si ST > AG, c'est avantageux
    if (ctx.player.st > ctx.player.ag) {
      return { dodgeModifier: ctx.player.st - ctx.player.ag };
    }
    return {};
  },
});

// HORNS
registerSkill({
  slug: 'horns',
  triggers: ['on-block-attacker'],
  description: '+1 ST lors d\'un Blitz.',
  canApply: (ctx) => hasSkill(ctx.player, 'horns'),
  getModifiers: () => ({ strengthModifier: 1 }),
});

// JUGGERNAUT
registerSkill({
  slug: 'juggernaut',
  triggers: ['on-block-attacker'],
  description: 'Lors d\'un Blitz, BOTH_DOWN et PUSH_BACK sont traités comme POW. Annule Fend et Stand Firm.',
  canApply: (ctx) => hasSkill(ctx.player, 'juggernaut'),
  modifyBlockResult: (ctx) => {
    if (ctx.blockResult === 'BOTH_DOWN' || ctx.blockResult === 'PUSH_BACK') {
      return 'POW';
    }
    return null;
  },
});

// NERVES OF STEEL
registerSkill({
  slug: 'nerves-of-steel',
  triggers: ['on-pass', 'on-catch'],
  description: 'Ignore les zones de tacle adverses pour les jets de passe et de réception.',
  canApply: (ctx) => hasSkill(ctx.player, 'nerves-of-steel') || hasSkill(ctx.player, 'nerves_of_steel'),
  getModifiers: () => ({ passModifier: 99, catchModifier: 99 }), // Annule les malus TZ (capped côté appelant)
});

// SPRINT
registerSkill({
  slug: 'sprint',
  triggers: ['on-gfi'],
  description: 'Peut tenter 3 GFI au lieu de 2.',
  canApply: (ctx) => hasSkill(ctx.player, 'sprint'),
  getModifiers: () => ({ movementModifier: 1 }),
});

// LEADER
registerSkill({
  slug: 'leader',
  triggers: ['passive'],
  description: 'L\'équipe reçoit 1 relance de Leader utilisable une fois par mi-temps.',
  canApply: (ctx) => hasSkill(ctx.player, 'leader'),
});

// SAFE PAIR OF HANDS
registerSkill({
  slug: 'safe-pair-of-hands',
  triggers: ['on-block-defender'],
  description: 'Si le joueur est renversé et portait le ballon, il peut placer le ballon sur une case adjacente libre (pas de rebond).',
  canApply: (ctx) => hasSkill(ctx.player, 'safe-pair-of-hands') || hasSkill(ctx.player, 'safe_pair_of_hands'),
});

// GRAB
registerSkill({
  slug: 'grab',
  triggers: ['on-block-attacker'],
  description: 'L\'attaquant peut choisir n\'importe quelle case adjacente libre pour pousser le défenseur (pas seulement les 3 directions standard).',
  canApply: (ctx) => hasSkill(ctx.player, 'grab'),
});

// DIVING TACKLE
registerSkill({
  slug: 'diving-tackle',
  triggers: ['on-dodge'],
  description: 'Peut se placer au sol pour donner -2 au jet d\'esquive d\'un joueur adjacent qui tente de s\'échapper.',
  canApply: (ctx) => hasSkill(ctx.player, 'diving-tackle') || hasSkill(ctx.player, 'diving_tackle'),
  getModifiers: () => ({ dodgeModifier: -2 }),
});

// DIVING CATCH
registerSkill({
  slug: 'diving-catch',
  triggers: ['on-catch'],
  description: '+1 au jet de réception. Peut réceptionner le ballon sur une case adjacente.',
  canApply: (ctx) => hasSkill(ctx.player, 'diving-catch') || hasSkill(ctx.player, 'diving_catch'),
  getModifiers: () => ({ catchModifier: 1 }),
});

// ACCURATE
registerSkill({
  slug: 'accurate',
  triggers: ['on-pass'],
  description: '+1 au jet de passe pour les passes Quick et Short.',
  canApply: (ctx) => hasSkill(ctx.player, 'accurate'),
  getModifiers: () => ({ passModifier: 1 }),
});

// STRONG ARM
registerSkill({
  slug: 'strong-arm',
  triggers: ['on-pass'],
  description: '+1 au jet de passe pour les passes Short, Long et Bomb.',
  canApply: (ctx) => hasSkill(ctx.player, 'strong-arm') || hasSkill(ctx.player, 'strong_arm'),
  getModifiers: () => ({ passModifier: 1 }),
});

// SHADOWING
registerSkill({
  slug: 'shadowing',
  triggers: ['on-dodge'],
  description: 'Quand un adversaire adjacent tente de s\'esquiver, le joueur peut tenter de le suivre (MA vs MA).',
  canApply: (ctx) => hasSkill(ctx.player, 'shadowing'),
});

// PREHENSILE TAIL
registerSkill({
  slug: 'prehensile-tail',
  triggers: ['on-dodge'],
  description: '-1 au jet d\'esquive de tout joueur tentant de quitter la zone de tacle de ce joueur.',
  canApply: (ctx) => hasSkill(ctx.player, 'prehensile-tail') || hasSkill(ctx.player, 'prehensile_tail'),
  getModifiers: () => ({ dodgeModifier: -1 }),
});

// TENTACLES
registerSkill({
  slug: 'tentacles',
  triggers: ['on-dodge'],
  description: 'L\'adversaire doit réussir un jet de ST vs ST pour quitter la zone de tacle.',
  canApply: (ctx) => hasSkill(ctx.player, 'tentacles'),
});

// TWO HEADS
registerSkill({
  slug: 'two-heads',
  triggers: ['on-dodge'],
  description: '+1 au jet d\'esquive.',
  canApply: (ctx) => hasSkill(ctx.player, 'two-heads') || hasSkill(ctx.player, 'two_heads'),
  getModifiers: () => ({ dodgeModifier: 1 }),
});

// VERY LONG LEGS
registerSkill({
  slug: 'very-long-legs',
  triggers: ['on-dodge', 'on-catch'],
  description: '+1 au jet d\'esquive et peut tenter d\'intercepter des passes à 2 cases.',
  canApply: (ctx) => hasSkill(ctx.player, 'very-long-legs') || hasSkill(ctx.player, 'very_long_legs'),
  getModifiers: () => ({ dodgeModifier: 1 }),
});

// BIG HAND
registerSkill({
  slug: 'big-hand',
  triggers: ['on-pickup'],
  description: 'Ignore les malus de zones de tacle adverses pour le ramassage.',
  canApply: (ctx) => hasSkill(ctx.player, 'big-hand') || hasSkill(ctx.player, 'big_hand'),
  getModifiers: () => ({ pickupModifier: 99 }), // Annule TZ malus
});

// EXTRA ARMS
registerSkill({
  slug: 'extra-arms',
  triggers: ['on-catch', 'on-pickup'],
  description: '+1 au jet de réception et de ramassage.',
  canApply: (ctx) => hasSkill(ctx.player, 'extra-arms') || hasSkill(ctx.player, 'extra_arms'),
  getModifiers: () => ({ catchModifier: 1, pickupModifier: 1 }),
});

// CLAWS
registerSkill({
  slug: 'claws',
  triggers: ['on-armor'],
  description: 'Les jets d\'armure de l\'adversaire sont toujours percés sur 8+, quel que soit l\'AV.',
  canApply: (ctx) => hasSkill(ctx.player, 'claws') || hasSkill(ctx.player, 'claw'),
});

// IRON HARD SKIN
registerSkill({
  slug: 'iron-hard-skin',
  triggers: ['on-armor'],
  description: 'Annule la compétence Claws de l\'adversaire.',
  canApply: (ctx) => hasSkill(ctx.player, 'iron-hard-skin') || hasSkill(ctx.player, 'iron_hard_skin'),
});

// PILE DRIVER
registerSkill({
  slug: 'pile-driver',
  triggers: ['on-block-attacker'],
  description: 'Après avoir renversé un joueur, peut effectuer une faute gratuite (sans risque d\'expulsion).',
  canApply: (ctx) => hasSkill(ctx.player, 'pile-driver') || hasSkill(ctx.player, 'pile_driver'),
});

// BRAWLER
registerSkill({
  slug: 'brawler',
  triggers: ['on-block-attacker'],
  description: 'Lors d\'un bloc, peut relancer un résultat BOTH_DOWN une fois par tour.',
  canApply: (ctx) => hasSkill(ctx.player, 'brawler') && ctx.blockResult === 'BOTH_DOWN',
  canReroll: () => true,
});

// REGENERATION
registerSkill({
  slug: 'regeneration',
  triggers: ['on-injury'],
  description: 'Quand retiré du jeu (KO/Casualty), lance un D6. Sur 4+, le joueur rejoint les réserves. Se fait AVANT l\'apothicaire.',
  canApply: (ctx) => hasSkill(ctx.player, 'regeneration'),
});

// DECAY
registerSkill({
  slug: 'decay',
  triggers: ['on-injury'],
  description: '+1 au jet de blessure contre ce joueur (blessures plus graves).',
  canApply: (ctx) => hasSkill(ctx.player, 'decay'),
  getModifiers: () => ({ injuryModifier: 1 }),
});

// ─── LONER (3 variants) ─────────────────────────────────────────────────────
// Loner doesn't use the standard canReroll flow — it's checked in handleRerollChoose
// when a player with Loner attempts to use a team reroll. Registered here for
// lookup and metadata purposes.

registerSkill({
  slug: 'loner-3',
  triggers: ['passive'],
  description: 'Ce joueur doit obtenir 3+ sur un D6 pour utiliser une relance d\'équipe.',
  canApply: (ctx) => hasSkill(ctx.player, 'loner-3'),
});

registerSkill({
  slug: 'loner-4',
  triggers: ['passive'],
  description: 'Ce joueur doit obtenir 4+ sur un D6 pour utiliser une relance d\'équipe.',
  canApply: (ctx) => hasSkill(ctx.player, 'loner-4'),
});

registerSkill({
  slug: 'loner-5',
  triggers: ['passive'],
  description: 'Ce joueur doit obtenir 5+ sur un D6 pour utiliser une relance d\'équipe.',
  canApply: (ctx) => hasSkill(ctx.player, 'loner-5'),
});

// ─── BONE HEAD ──────────────────────────────────────────────────────────────
// Bone Head check is performed in applyMove before dispatching to action handlers.
// Registered here for lookup and metadata purposes.

registerSkill({
  slug: 'bone-head',
  triggers: ['on-activation'],
  description: 'Au début de l\'activation, jet D6. Sur 1, le joueur ne peut pas agir (activation terminée).',
  canApply: (ctx) => hasSkill(ctx.player, 'bone-head'),
});

// ─── REALLY STUPID ─────────────────────────────────────────────────────────
// Really Stupid check is performed in applyMove before dispatching to action handlers.
// Registered here for lookup and metadata purposes.

registerSkill({
  slug: 'really-stupid',
  triggers: ['on-activation'],
  description: 'Au début de l\'activation, jet D6. Sur 1-3 (ou 1 si coéquipier adjacent non-RS), le joueur ne peut pas agir.',
  canApply: (ctx) => hasSkill(ctx.player, 'really-stupid'),
});

registerSkill({
  slug: 'really-stupid-2',
  triggers: ['on-activation'],
  description: 'Au début de l\'activation, jet D6 (+2 si coéquipier adjacent non-RS). Sur 1-3, le joueur ne peut pas agir.',
  canApply: (ctx) => hasSkill(ctx.player, 'really-stupid-2'),
});

// ─── WILD ANIMAL ──────────────────────────────────────────────────────────────
// Wild Animal check is performed in applyMove before dispatching to action handlers.
// Registered here for lookup and metadata purposes.

registerSkill({
  slug: 'wild-animal',
  triggers: ['on-activation'],
  description: 'Au début de l\'activation, jet D6 (+2 si Block/Blitz). Sur 1-3 total, le joueur ne peut pas agir.',
  canApply: (ctx) => hasSkill(ctx.player, 'wild-animal'),
});

// ─── ANIMAL SAVAGERY ────────────────────────────────────────────────────────
// Animal Savagery check is performed in applyMove before dispatching to action handlers.
// Registered here for lookup and metadata purposes.

registerSkill({
  slug: 'animal-savagery',
  triggers: ['on-activation'],
  description: 'Au début de l\'activation, jet D6. Sur 1, attaque un coéquipier adjacent aléatoire (bloc forcé). Sans coéquipier adjacent, activation terminée.',
  canApply: (ctx) => hasSkill(ctx.player, 'animal-savagery'),
});

// ─── TAKE ROOT ──────────────────────────────────────────────────────────────
// Take Root check is performed in applyMove before dispatching to action handlers.
// Registered here for lookup and metadata purposes.

registerSkill({
  slug: 'take-root',
  triggers: ['on-activation'],
  description: 'Au début de l\'activation, jet D6. Sur 1, le joueur est enraciné et ne peut pas agir (activation terminée).',
  canApply: (ctx) => hasSkill(ctx.player, 'take-root'),
});

// ─── ANIMOSITY (5 variants) ─────────────────────────────────────────────────
// Animosity is checked in handlePass/handleHandoff before the action executes.
// Registered here for lookup and metadata purposes.

registerSkill({
  slug: 'animosity',
  triggers: ['on-pass'],
  description: 'Jet d\'Animosité (D6) avant passe/remise à un coéquipier de lignée différente. Sur 1, refuse et activation terminée.',
  canApply: (ctx) => hasSkill(ctx.player, 'animosity'),
});

registerSkill({
  slug: 'animosity-all',
  triggers: ['on-pass'],
  description: 'Jet d\'Animosité (D6) avant passe/remise à tout coéquipier. Sur 1, refuse et activation terminée.',
  canApply: (ctx) => hasSkill(ctx.player, 'animosity-all'),
});

registerSkill({
  slug: 'animosity-underworld',
  triggers: ['on-pass'],
  description: 'Jet d\'Animosité (D6) avant passe/remise à un coéquipier de lignée différente (Underworld). Sur 1, refuse et activation terminée.',
  canApply: (ctx) => hasSkill(ctx.player, 'animosity-underworld'),
});

registerSkill({
  slug: 'animosity-all-dwarf-halfling',
  triggers: ['on-pass'],
  description: 'Jet d\'Animosité (D6) avant passe/remise à un coéquipier Nain ou Halfling. Sur 1, refuse et activation terminée.',
  canApply: (ctx) => hasSkill(ctx.player, 'animosity-all-dwarf-halfling'),
});

registerSkill({
  slug: 'animosity-all-dwarf-human',
  triggers: ['on-pass'],
  description: 'Jet d\'Animosité (D6) avant passe/remise à un coéquipier Nain ou Humain. Sur 1, refuse et activation terminée.',
  canApply: (ctx) => hasSkill(ctx.player, 'animosity-all-dwarf-human'),
});

// ─── NO HANDS ──────────────────────────────────────────────────────────────
// No Hands prevents the player from picking up, catching, or carrying the ball.
// Checked in handleBallPickup, executePass, executeHandoff, and bounceBall.
// Registered here for lookup and metadata purposes.

registerSkill({
  slug: 'no-hands',
  triggers: ['passive'],
  description: 'Ce joueur ne peut ni ramasser, ni attraper, ni transporter le ballon. Les actions Passe et Remise lui sont interdites.',
  canApply: (ctx) => hasSkill(ctx.player, 'no-hands'),
});

// ─── RIGHT STUFF ───────────────────────────────────────────────────────────
// Right Stuff enables a player (ST ≤ 3) to be thrown by a teammate with
// Throw Team-Mate. The ST ≤ 3 check is enforced in canThrowTeamMate().
// Registered here for lookup and metadata purposes.

registerSkill({
  slug: 'right-stuff',
  triggers: ['passive'],
  description: 'Si ce joueur a une Force de 3 ou moins, il peut être lancé par un coéquipier ayant la compétence Lancer d\'Équipier.',
  canApply: (ctx) => hasSkill(ctx.player, 'right-stuff'),
});
