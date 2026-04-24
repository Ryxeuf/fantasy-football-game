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

// DEFENSIVE
// Effet cable dans `mechanics/defensive.ts` + `mechanics/blocking.ts`
// (annulation du Guard des adversaires marques par le joueur Defensive
// pendant le tour adverse, pour le calcul des assists offensifs).
// L'entree ici sert pour la decouverte UI et la documentation.
registerSkill({
  slug: 'defensive',
  triggers: ['on-block-defender'],
  description: "Pendant le tour adverse uniquement, tous les joueurs adverses marques par ce joueur ne peuvent pas utiliser le skill Guard.",
  canApply: (ctx) => hasSkill(ctx.player, 'defensive'),
});

// MIGHTY BLOW (+1)
registerSkill({
  slug: 'mighty-blow',
  triggers: ['on-armor', 'on-injury'],
  description: '+1 au jet d\'armure OU au jet de blessure (automatique).',
  canApply: (ctx) => hasSkill(ctx.player, 'mighty_blow') || hasSkill(ctx.player, 'mighty blow') || hasSkill(ctx.player, 'mighty-blow'),
  getModifiers: () => ({ armorModifier: 1 }), // Appliqué au meilleur choix par le moteur
});

// MIGHTY BLOW (+1) — variante BB3 utilisee dans les rosters
// (`mighty-blow-1`). Comportement identique a `mighty-blow` mais slug
// distinct, donc enregistrement separe pour que les rosters existants
// recoivent enfin le bonus +1 (O.1 batch 3h).
registerSkill({
  slug: 'mighty-blow-1',
  triggers: ['on-armor', 'on-injury'],
  description: '+1 au jet d\'armure OU au jet de blessure (automatique).',
  canApply: (ctx) => hasSkill(ctx.player, 'mighty-blow-1') || hasSkill(ctx.player, 'mighty_blow_1'),
  getModifiers: () => ({ armorModifier: 1 }),
});

// MIGHTY BLOW (+2) — variante BB3 utilisee par Morg n Thorg et autres
// stars (`mighty-blow-2`). Bonus de +2 au jet d'armure ou de blessure.
// (O.1 batch 3h)
registerSkill({
  slug: 'mighty-blow-2',
  triggers: ['on-armor', 'on-injury'],
  description: '+2 au jet d\'armure OU au jet de blessure (automatique).',
  canApply: (ctx) => hasSkill(ctx.player, 'mighty-blow-2') || hasSkill(ctx.player, 'mighty_blow_2'),
  getModifiers: () => ({ armorModifier: 2 }),
});

// ─── COMPÉTENCES AVANCÉES ────────────────────────────────────────────────

// DAUNTLESS
// Dauntless is resolved in `mechanics/dauntless.ts` and invoked from
// `handleBlock` before block dice are rolled. The registry entry is kept here
// for lookup and metadata purposes only.
registerSkill({
  slug: 'dauntless',
  triggers: ['on-block-attacker'],
  description: 'Si la force totale est inférieure à celle de la cible, lance un D6 + ST de base. Si le total est >= force totale adverse, la force est considérée comme égale pour ce blocage.',
  canApply: (ctx) => hasSkill(ctx.player, 'dauntless'),
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

// DIRTY PLAYER (+2) — variante BB3 utilisee notamment par le Dwarf
// Deathroller (`dirty-player-2`). Bonus de +2 au jet d'armure lors d'une
// faute. (O.1 batch 3h)
registerSkill({
  slug: 'dirty-player-2',
  triggers: ['on-foul'],
  description: '+2 au jet d\'armure lors d\'une faute.',
  canApply: (ctx) => hasSkill(ctx.player, 'dirty-player-2') || hasSkill(ctx.player, 'dirty_player_2'),
  getModifiers: () => ({ armorModifier: 2 }),
});

// SNEAKY GIT
// Effet resolu dans `mechanics/foul.ts` (annulation de l'expulsion sur doublet
// naturel) et dans `core/game-state.ts#canPlayerContinueMoving` (l'activation
// se poursuit apres la faute). L'entree du registre sert a la decouverte UI
// et a la documentation.
registerSkill({
  slug: 'sneaky-git',
  triggers: ['on-foul'],
  description: "Lors d'une faute, pas d'expulsion sur un doublet naturel au jet d'armure. L'activation du joueur peut se poursuivre apres la faute.",
  canApply: (ctx) => hasSkill(ctx.player, 'sneaky-git') || hasSkill(ctx.player, 'sneaky_git'),
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
// Règle BB3 :
//  - +1 au jet d'esquive (collecté via skill-registry ici).
//  - Malus d'armure -1 quand la cible est Stunty (appliqué directement dans
//    `calculateArmorTarget` / `performArmorRollWithNotification` / `blocking.ts`).
//  - Passes Long et Long Bomb interdites (appliqué via `canAttemptPassForRange`
//    dans `passing.ts`, consommé par `getLegalMoves` et `handlePass`).
registerSkill({
  slug: 'stunty',
  triggers: ['on-dodge'],
  description: '+1 au jet d\'esquive, armure réduite de 1 (plus fragile), passes limitées à Quick/Short.',
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
// Le skill est actif mais sa logique est gérée post-roll dans
// `mechanics/break-tackle.ts` (checkBreakTackle), qui s'exécute après un
// Dodge raté et ajoute +1 (ST ≤ 4) ou +2 (ST ≥ 5) une fois par activation.
// On n'applique aucun modificateur pré-jet ici pour éviter de rendre les
// dodges permanents, ce qui ne correspondrait pas à la règle BB3.
registerSkill({
  slug: 'break-tackle',
  triggers: ['on-dodge'],
  description:
    "Une fois par activation, après un test d'Agilité pour Esquiver, modifie le jet de +1 (ST ≤ 4) ou +2 (ST ≥ 5).",
  canApply: (ctx) =>
    hasSkill(ctx.player, 'break-tackle') || hasSkill(ctx.player, 'break_tackle'),
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
// Effet cable dans `mechanics/juggernaut.ts` + `mechanics/blocking.ts`
// (conversion BOTH_DOWN -> PUSH_BACK et annulation de Wrestle/Fend/Stand Firm
// du defenseur cible). L'entree du registre reste utile pour la description
// et l'auto-discovery (getSkillsForTrigger, UI).
registerSkill({
  slug: 'juggernaut',
  triggers: ['on-block-attacker'],
  description: 'Lors d\'un Blitz, peut traiter BOTH_DOWN comme PUSH_BACK. Le defenseur cible ne peut pas utiliser Fend, Stand Firm ni Wrestle.',
  canApply: (ctx) => hasSkill(ctx.player, 'juggernaut'),
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

// CANNONEER (O.1 batch 3f) : +1 au jet de passe sur Long et Bomb.
// Effectivement resolu par `calculatePassModifiers` dans `mechanics/passing.ts`.
registerSkill({
  slug: 'cannoneer',
  triggers: ['on-pass'],
  description: '+1 au jet de passe pour les passes Long et Long Bomb.',
  canApply: (ctx) => hasSkill(ctx.player, 'cannoneer'),
  getModifiers: () => ({ passModifier: 1 }),
});

// MONSTROUS MOUTH (O.1 batch 3f) : relance toute tentative ratee de reception
// (effectuee dans `performCatchRollWithSkill`) et Strip Ball ne peut pas etre
// utilise contre ce joueur (resolu dans `handlePushBack` de `mechanics/blocking.ts`).
registerSkill({
  slug: 'monstrous-mouth',
  triggers: ['on-catch'],
  description: 'Relance toute tentative ratee de reception. Strip Ball ne peut pas etre utilise contre ce joueur.',
  canApply: (ctx) =>
    hasSkill(ctx.player, 'monstrous-mouth') || hasSkill(ctx.player, 'monstrous_mouth'),
});

// CLOUD BURSTER (O.1 batch 3g) : sur une passe Long ou Bomb, le passeur force
// le coach adverse a relancer une interception reussie. Resolution dans
// `mechanics/passing.ts#executePass`. L'entree du registre sert a la decouverte UI.
registerSkill({
  slug: 'cloud-burster',
  triggers: ['on-pass'],
  description: "Sur une passe Long ou Long Bomb, le passeur peut forcer l'adversaire a relancer une interception reussie.",
  canApply: (ctx) =>
    hasSkill(ctx.player, 'cloud-burster') || hasSkill(ctx.player, 'cloud_burster'),
});

// TITCHY (O.1 batch 3g, trait) : n'exerce pas de zone de tacle et ne peut pas
// declarer d'action de Blocage. Les autres effets (ignorer les TZ adverses sur
// ses propres tests d'agilite) relevent des jets ou ce joueur est acteur et
// seront couverts par un batch ulterieur. Filtrage des TZ dans
// `mechanics/movement.ts#getAdjacentOpponents`, restriction du Block dans
// `mechanics/blocking.ts#canBlock`.
registerSkill({
  slug: 'titchy',
  triggers: ['passive'],
  description: "Ce joueur n'exerce pas de zone de tacle et ne peut pas declarer d'action de Blocage.",
  canApply: (ctx) => hasSkill(ctx.player, 'titchy'),
});

// ARM BAR (O.1 batch 3g) : +1 au jet d'armure (ou de blessure) du joueur
// adverse qui Tombe en ratant un Esquive/Saut/Bond pour quitter une case ou
// il etait Marque par ce joueur. La resolution effective se fait dans
// `actions.ts` (voir `applyRollFailure` + helper `getArmBarBonus` dans
// `mechanics/arm-bar.ts`). L'entree ici sert pour la decouverte UI.
registerSkill({
  slug: 'arm-bar',
  triggers: ['on-armor', 'on-injury'],
  description: "+1 au jet d'Armure (ou de Blessure) quand un adversaire Tombe en ratant un test d'agilite (Esquive/Saut/Bond) pour quitter une case ou il etait Marque par ce joueur.",
  canApply: (ctx) => hasSkill(ctx.player, 'arm-bar') || hasSkill(ctx.player, 'arm_bar'),
});

// SHADOWING
// La résolution du suivi (2D6 + MA diff >= 7) est effectuée par
// `resolveShadowingAfterDodge` dans `mechanics/shadowing.ts`, appelé depuis
// les trois chemins de Dodge dans `actions.ts`. L'entrée ici sert uniquement
// à déclarer l'effet pour le registre (affichage UI, documentation).
registerSkill({
  slug: 'shadowing',
  triggers: ['on-dodge'],
  description: 'Quand un adversaire quitte sa zone de tacle en esquivant, le joueur peut tenter de le suivre (2D6 + MA vs MA, succès ≥ 7).',
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
  description: 'Annule tous les modificateurs positifs que l\'adversaire appliquerait au jet d\'armure contre ce joueur (Claws, Mighty Blow sur armure, Dirty Player, Chainsaw, etc.). N\'affecte pas le jet de blessure.',
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

// ─── BOMBARDIER ─────────────────────────────────────────────────────────────
// Action speciale "Lancer de Bombe" implementee dans `mechanics/bombardier.ts`,
// branchee via l'action BOMB_THROW.

registerSkill({
  slug: 'bombardier',
  triggers: ['on-activation'],
  description: 'Action speciale (remplace un blocage) : lance une bombe sur une case en portee Quick/Short. Succes = explosion +1 armure ; fumble = explosion sur le lanceur ; echec = deviation D8.',
  canApply: (ctx) => hasSkill(ctx.player, 'bombardier'),
});

// ─── BALL AND CHAIN ─────────────────────────────────────────────────────────
// Ball and Chain remplace l'action de Mouvement du joueur par un deplacement
// automatique dans une direction aleatoire (D8). Implementation dans
// `mechanics/ball-and-chain.ts`, branche via l'action BALL_AND_CHAIN.

registerSkill({
  slug: 'ball-and-chain',
  triggers: ['on-activation'],
  description: 'Remplace l\'action de Mouvement par un deplacement automatique (jet D8) jusqu\'a MA cases. Sortie de terrain = crowd surf + turnover ; collision adverse = Block automatique.',
  canApply: (ctx) => hasSkill(ctx.player, 'ball-and-chain'),
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

// ─── KICK ──────────────────────────────────────────────────────────────────
// Le skill Kick est resolu dans `core/game-state.ts` (`calculateKickDeviation`)
// via `applyKickSkillToDeviation` (mechanics/kick-skill.ts). Quand l'equipe qui
// botte a un joueur Kick eligible (sur le terrain, hors LoS et wide zones), le
// D6 de deviation du ballon est divise par 2 (arrondi a l'entier inferieur).
// L'entree du registre sert pour la decouverte UI et la documentation.
registerSkill({
  slug: 'kick',
  triggers: ['on-kickoff'],
  description: "Lors d'un coup d'envoi, si ce joueur est sur le terrain (hors LoS et Wide Zones), le D6 de deviation du ballon peut etre divise par deux (arrondi a l'entier inferieur).",
  canApply: (ctx) => hasSkill(ctx.player, 'kick'),
});

// ─── FOUL APPEARANCE ───────────────────────────────────────────────────────
// Foul Appearance check is performed in handleBlock / handleBlitz before any
// block dice are rolled. The attacker's coach rolls a D6; on 1, the declared
// block action is wasted (no turnover). Registered here for lookup and
// metadata purposes.

registerSkill({
  slug: 'foul-appearance',
  triggers: ['on-block-defender'],
  description: 'Quand un joueur adverse déclare un Blocage ciblant ce joueur, l\'attaquant lance un D6 avant le blocage. Sur 1, le blocage est annulé et l\'action est gaspillée.',
  canApply: (ctx) => hasSkill(ctx.player, 'foul-appearance'),
});

// ─── HAIL MARY PASS ────────────────────────────────────────────────────────
// Hail Mary Pass est resolu dans `mechanics/passing.ts` :
//  - `canAttemptPassForRange` permet de viser n'importe quelle case (ignore la
//    regle de portee, y compris au-dela de Long Bomb).
//  - `executePass` : sur un jet de passe reussi, la passe n'est jamais precise,
//    le ballon devie depuis la case cible (pas de catch direct, pas de turnover).
// L'entree du registre sert a la decouverte UI et a la documentation.
registerSkill({
  slug: 'hail-mary-pass',
  triggers: ['on-pass'],
  description: "La case cible de la passe peut etre n'importe ou sur le terrain (la regle de portee est ignoree). La passe n'est jamais precise : meme sur un jet reussi, le ballon devie depuis la cible.",
  canApply: (ctx) => hasSkill(ctx.player, 'hail-mary-pass') || hasSkill(ctx.player, 'hail_mary_pass'),
});

// ─── SAFE PASS ─────────────────────────────────────────────────────────────
// Safe Pass est resolu dans `mechanics/passing.ts#executePass` : sur un jet de
// passe rate, le passeur garde le ballon, il n'y a pas de turnover ni de rebond,
// et l'activation du passeur se termine (geree par handlePass). L'entree du
// registre sert a la decouverte UI et a la documentation.
registerSkill({
  slug: 'safe-pass',
  triggers: ['on-pass'],
  description: "Si ce joueur rate une action de Passe, le ballon n'est pas lache, ne rebondit pas depuis la case qu'occupe ce joueur, et aucun Renversement n'est cause. Au lieu de cela, ce joueur garde possession du ballon et son activation se termine.",
  canApply: (ctx) => hasSkill(ctx.player, 'safe-pass') || hasSkill(ctx.player, 'safe_pass'),
});

// ─── DISTURBING PRESENCE ───────────────────────────────────────────────────
// Disturbing Presence est resolue dans `mechanics/disturbing-presence.ts`
// (`getDisturbingPresenceModifier`) et appliquee dans `passing.ts` (pass,
// catch, interception) et `throw-team-mate.ts`. Un adversaire avec ce skill
// situe a <= 3 cases applique -1 au test correspondant. L'entree du registre
// sert a l'affichage UI et a la documentation du skill.
registerSkill({
  slug: 'disturbing-presence',
  triggers: ['on-pass', 'on-catch'],
  description: "Quand un adversaire effectue une Passe, un Lancer d'Equipier, une Interception ou une Reception, il subit -1 par joueur avec ce skill a 3 cases ou moins.",
  canApply: (ctx) => hasSkill(ctx.player, 'disturbing-presence') || hasSkill(ctx.player, 'disturbing_presence'),
});

// ─── LEAP (O.1 batch 3i) ────────────────────────────────────────────────────
// Leap (Agility) permet de sauter par-dessus une case adjacente pour arriver
// a une case a distance Chebyshev 2, avec un jet d'Agilite remplacant l'esquive
// classique. Resolution dans `mechanics/leap.ts` (`executeLeap`, `canLeap`).
// L'entree du registre sert a la decouverte UI et a la documentation.
registerSkill({
  slug: 'leap',
  triggers: ['on-activation'],
  description: "Pendant son mouvement, le joueur peut sauter par-dessus une case adjacente (2 cases de mouvement) avec un jet d'Agilite. Pas de jet d'Esquive requis pour quitter les zones de tacle.",
  canApply: (ctx) => hasSkill(ctx.player, 'leap') || hasSkill(ctx.player, 'pogo-stick'),
});

// ─── STAB (O.1 batch 3i) ────────────────────────────────────────────────────
// Stab remplace une action de Blocage : jet d'armure direct (sans dés de bloc
// ni assistance) contre une cible adjacente debout. Mighty Blow s'applique a
// l'armure. Resolution dans `mechanics/stab.ts` (`executeStab`, `canStab`).
// L'entree du registre sert a la decouverte UI et a la documentation.
registerSkill({
  slug: 'stab',
  triggers: ['on-activation'],
  description: "Action speciale remplacant un Blocage : jet d'armure direct contre une cible adjacente. Pas de des de bloc, pas d'assistance, pas de turnover ; l'activation se termine apres le Stab.",
  canApply: (ctx) => hasSkill(ctx.player, 'stab'),
});

// ─── PROJECTILE VOMIT (O.1 batch 3i) ────────────────────────────────────────
// Projectile Vomit (trait de mutation) remplace une action de Blocage : jet
// D6 (2+ = succes) contre une cible adjacente ; succes = cible mise a terre
// suivie d'un jet d'armure (Mighty Blow s'applique). Echec termine l'activation
// sans turnover. Resolution dans `mechanics/projectile-vomit.ts`.
registerSkill({
  slug: 'projectile-vomit',
  triggers: ['on-activation'],
  description: "Action speciale remplacant un Blocage : jet D6 contre une cible adjacente. Sur 2+, la cible est mise a terre et subit un jet d'armure. Sur 1, l'activation se termine sans turnover.",
  canApply: (ctx) => hasSkill(ctx.player, 'projectile-vomit') || hasSkill(ctx.player, 'projectile_vomit'),
});

// ─── ON THE BALL (O.1 batch 3j) ─────────────────────────────────────────────
// On the Ball est une reaction defensive declenchee lors d'une action de Passe
// adverse : le joueur possedant ce skill peut se deplacer jusqu'a 3 cases avant
// que le jet de Passe soit effectue, une fois par tour d'equipe. Resolution
// dans `mechanics/on-the-ball.ts` (`executeOnTheBallMove`, `canUseOnTheBall`,
// tracking via `state.usedOnTheBallThisTurn`). L'entree du registre sert a la
// decouverte UI et a la documentation.
registerSkill({
  slug: 'on-the-ball',
  triggers: ['on-pass'],
  description: "Une fois par tour d'equipe, lorsque l'adversaire declare une action de Passe, ce joueur peut se deplacer jusqu'a 3 cases avant le jet de Passe, en terminant adjacent ou sur la case cible.",
  canApply: (ctx) => hasSkill(ctx.player, 'on-the-ball') || hasSkill(ctx.player, 'on_the_ball'),
});

// ─── THROW TEAM-MATE (O.1 batch 3j) ─────────────────────────────────────────
// Throw Team-Mate permet a un joueur (Big Guy, Ogre, Treeman, etc.) de lancer
// un coequipier Right Stuff sur une case cible. Implementation dans
// `mechanics/throw-team-mate.ts` (action THROW_TEAM_MATE dispatchee via
// actions.ts). L'entree du registre sert a la decouverte UI.
registerSkill({
  slug: 'throw-team-mate',
  triggers: ['on-pass'],
  description: "Action speciale : lance un coequipier possedant Right Stuff vers une case cible. Utilise les regles de portee et de deviation des passes ; la cible effectue un jet d'armure a l'atterrissage.",
  canApply: (ctx) => hasSkill(ctx.player, 'throw-team-mate') || hasSkill(ctx.player, 'throw_team_mate'),
});

// ─── DUMP-OFF (O.1 batch 3j) ────────────────────────────────────────────────
// Dump-off est une reaction defensive : quand ce joueur porteur du ballon est
// cible d'un Blocage/Blitz, il peut immediatement effectuer une Passe Rapide
// avant la resolution du bloc, interrompant l'activation de l'attaquant.
// Resolution dans `mechanics/dump-off.ts` (`canDumpOff`, `executeDumpOff`).
// L'entree du registre sert a la decouverte UI.
registerSkill({
  slug: 'dump-off',
  triggers: ['on-block-defender'],
  description: "Quand ce joueur porteur du ballon est cible d'un Blocage/Blitz, il peut effectuer immediatement une Passe Rapide avant la resolution du bloc. Pas de turnover si la passe rate.",
  canApply: (ctx) => hasSkill(ctx.player, 'dump-off') || hasSkill(ctx.player, 'dump_off'),
});

// ─── CHAINSAW (O.1 batch 3k) ────────────────────────────────────────────────
// Chainsaw (Secret Weapon) remplace une action de Blocage : jet d'armure
// direct contre une cible adjacente debout avec un modificateur +3. Mighty
// Blow ne s'applique pas. Un double 1 naturel fait exploser la tronconneuse
// sur son porteur. Resolution dans `mechanics/chainsaw.ts` (`executeChainsaw`,
// `canUseChainsaw`). L'entree du registre sert a la decouverte UI.
registerSkill({
  slug: 'chainsaw',
  triggers: ['on-activation'],
  description: "Arme Secrete. Action speciale remplacant un Blocage : jet d'armure direct (+3) contre une cible adjacente debout. Mighty Blow ne s'applique pas. Double 1 naturel = la tronconneuse explose sur le porteur.",
  canApply: (ctx) => hasSkill(ctx.player, 'chainsaw'),
});

// ─── MULTIPLE BLOCK (O.1 batch 3k) ──────────────────────────────────────────
// Multiple Block permet, une fois par tour d'equipe, de declarer une action de
// Blocage ciblant simultanement deux adversaires adjacents avec un malus de
// -2 ST applique a chacun des deux blocs. Resolution dans
// `mechanics/multiple-block.ts` (`canPerformMultipleBlock`,
// `findMultipleBlockTargets`, etc.) avec tracking via
// `state.usedMultipleBlockThisTurn` et `state.pendingMultipleBlock`.
// L'entree du registre sert a la decouverte UI.
registerSkill({
  slug: 'multiple-block',
  triggers: ['on-block-attacker'],
  description: "Une fois par tour d'equipe, ce joueur peut effectuer une action de Blocage ciblant deux adversaires adjacents simultanement. Chaque bloc subit un malus de -2 a la Force de l'attaquant.",
  canApply: (ctx) => hasSkill(ctx.player, 'multiple-block') || hasSkill(ctx.player, 'multiple_block'),
  getModifiers: () => ({ strengthModifier: -2 }),
});

// ─── ARMORED SKULL (O.1 batch 3l) ───────────────────────────────────────────
// Le modificateur -1 au jet de blessure est applique directement dans
// `mechanics/injury.ts` (`armoredSkullModifier`), appele par
// `performInjuryRoll` et `performLastingInjuryRoll`. On n'expose PAS de
// `getModifiers` ici pour eviter un double-comptage via le flux
// `skill-bridge.getInjurySkillModifiers` utilise par `blocking.ts`.
// L'entree du registre sert uniquement a la decouverte UI et a la
// documentation du skill.
registerSkill({
  slug: 'armored-skull',
  triggers: ['on-injury'],
  description: "-1 a tout jet de Blessure effectue contre ce joueur. Reduit les chances de KO et de Blessure grave.",
  canApply: (ctx) => hasSkill(ctx.player, 'armored-skull') || hasSkill(ctx.player, 'armored_skull'),
});

// ─── INSTABLE (O.1 batch 3l) ────────────────────────────────────────────────
// Instable interdit les actions Passe, Remise (Hand-Off) et Lancer d'Equipier.
// La prohibition est appliquee dans `mechanics/negative-traits.ts`
// (`checkInstableProhibition`) depuis les handlers d'action et depuis
// `getLegalMoves`. Aucune mecanique registry-driven n'est necessaire ici.
registerSkill({
  slug: 'instable',
  triggers: ['passive'],
  description: "Ce joueur ne peut pas declarer d'action de Passe, de Transmission (Hand-Off) ni de Lancer d'Equipier. L'action est refusee sans jet et sans turnover.",
  canApply: (ctx) => hasSkill(ctx.player, 'instable'),
});

// ─── RUNNING PASS (O.1 batch 3l) ────────────────────────────────────────────
// Running Pass permet au joueur de continuer son mouvement apres une Passe
// Rapide reussie (et une Transmission pour la variante `running-pass-2025`).
// La logique est entierement portee par `mechanics/running-pass.ts` et
// consommee par `canPlayerContinueMoving` dans `core/game-state.ts`. L'entree
// ici sert a la decouverte UI (catalogue des skills) et a la documentation.
registerSkill({
  slug: 'running-pass',
  triggers: ['on-pass'],
  description: "Le joueur peut continuer son mouvement apres une Passe Rapide reussie s'il lui reste du mouvement. Variante Season 3 (`running-pass-2025`) : s'applique egalement aux Transmissions (Hand-Off). Utilisable une fois par tour d'equipe.",
  canApply: (ctx) =>
    hasSkill(ctx.player, 'running-pass') ||
    hasSkill(ctx.player, 'running_pass') ||
    hasSkill(ctx.player, 'running-pass-2025'),
});

// ─── HYPNOTIC GAZE (O.1 batch 3k) ───────────────────────────────────────────
// Hypnotic Gaze est une action speciale remplacant une action standard : le
// joueur tente un jet d'Agilite (2+) pour priver un adversaire adjacent de sa
// zone de tacle jusqu'a sa prochaine activation. -1 par TZ adverse hors cible.
// Resolution dans `mechanics/hypnotic-gaze.ts` (`canHypnoticGaze`,
// `performHypnoticGaze`, `calculateGazeModifiers`). L'entree du registre sert
// a la decouverte UI.
registerSkill({
  slug: 'hypnotic-gaze',
  triggers: ['on-activation'],
  description: "Action speciale : jet d'Agilite (2+) contre un adversaire adjacent. Succes = la cible perd sa zone de tacle jusqu'a sa prochaine activation. Echec = fin d'activation (pas de turnover). -1 par zone de tacle adverse hors cible.",
  canApply: (ctx) => hasSkill(ctx.player, 'hypnotic-gaze') || hasSkill(ctx.player, 'hypnotic_gaze'),
});

// ─── BLOODLUST (3 variantes) (O.1 batch 3m) ─────────────────────────────────
// Bloodlust est verifie au debut de l'activation par `checkBloodlust` dans
// `mechanics/negative-traits.ts`. Le jet D6 (+1 si Block/Blitz) doit atteindre
// la cible de la variante (4+ par defaut, 2+ pour bloodlust-2, 3+ pour
// bloodlust-3) ; sinon l'activation se termine sans turnover. Chaque variante
// recoit son propre slug pour eviter le double-comptage et permettre a l'UI
// d'afficher le bon seuil. L'entree du registre sert a la decouverte UI et a
// la documentation.
registerSkill({
  slug: 'bloodlust',
  triggers: ['on-activation'],
  description: "Au debut de l'activation, jet D6 (+1 si Block/Blitz). Sur un resultat inferieur a 4 (ou 1 naturel), l'activation se termine sans turnover ; le Vampire pourrait mordre un Thrall adjacent.",
  canApply: (ctx) => hasSkill(ctx.player, 'bloodlust'),
});

registerSkill({
  slug: 'bloodlust-2',
  triggers: ['on-activation'],
  description: "Au debut de l'activation, jet D6 (+1 si Block/Blitz). Sur un resultat inferieur a 2 (ou 1 naturel), l'activation se termine sans turnover ; le Vampire pourrait mordre un Thrall adjacent.",
  canApply: (ctx) => hasSkill(ctx.player, 'bloodlust-2'),
});

registerSkill({
  slug: 'bloodlust-3',
  triggers: ['on-activation'],
  description: "Au debut de l'activation, jet D6 (+1 si Block/Blitz). Sur un resultat inferieur a 3 (ou 1 naturel), l'activation se termine sans turnover ; le Vampire pourrait mordre un Thrall adjacent.",
  canApply: (ctx) => hasSkill(ctx.player, 'bloodlust-3'),
});

// ─── ALWAYS HUNGRY (O.1 batch 3m) ───────────────────────────────────────────
// Always Hungry est verifie lors d'une action Throw Team-Mate dans
// `mechanics/negative-traits.ts` (`checkAlwaysHungry`). Sur un jet D6 = 1 avant
// le lancer, le porteur tente de manger son coequipier (jet d'echappee) au lieu
// de le lancer. L'entree du registre sert a la decouverte UI et a la
// documentation ; aucun modificateur n'est expose ici (le jet est dedie).
registerSkill({
  slug: 'always-hungry',
  triggers: ['on-pass'],
  description: "Quand ce joueur tente un Lancer d'Equipier, jet D6 (2+). Sur 1, il essaie de manger le coequipier au lieu de le lancer ; ce dernier peut tenter un jet d'echappee.",
  canApply: (ctx) => hasSkill(ctx.player, 'always-hungry') || hasSkill(ctx.player, 'always_hungry'),
});

// ─── SECRET WEAPON (O.1 batch 3m) ───────────────────────────────────────────
// Secret Weapon est resolu en fin de drive par `expelSecretWeapons` dans
// `mechanics/secret-weapons.ts`. Tout joueur portant ce trait qui a participe
// au drive est expulse par l'arbitre, sauf si un Bribe (pot-de-vin) reussit
// (jet D6 : 2+ = sauve, 1 = expulse quand meme). L'entree du registre sert a
// la decouverte UI et a la documentation.
registerSkill({
  slug: 'secret-weapon',
  triggers: ['passive'],
  description: "A la fin de chaque drive, ce joueur est expulse par l'arbitre (Sent-off). Un pot-de-vin (Bribe) peut etre utilise pour tenter de l'eviter (jet D6 : 2+ = sauve).",
  canApply: (ctx) => hasSkill(ctx.player, 'secret-weapon') || hasSkill(ctx.player, 'secret_weapon'),
});

// ─── POGO STICK (O.1 batch 3n) ──────────────────────────────────────────────
// Pogo Stick partage la mecanique de Leap (mechanics/leap.ts) : le joueur peut
// sauter par-dessus une case adjacente occupee (y compris Debout) et recoit
// +1 au jet d'Agilite du saut. `canLeap` et `calculateLeapAgilityModifier`
// lisent directement le skill `pogo-stick` sur le joueur. Le dispatch dans
// `actions/actions.ts` choisit `pogo-stick` comme label du skill declenche
// quand il est present. On expose ici une entree dediee pour que l'UI puisse
// differencier Pogo Stick de Leap et refleter le bonus specifique.
registerSkill({
  slug: 'pogo-stick',
  triggers: ['on-movement'],
  description: "Le joueur peut sauter par-dessus n'importe quelle case adjacente (libre ou occupee), avec un modificateur +1 sur le jet d'Agilite du saut.",
  canApply: (ctx) => hasSkill(ctx.player, 'pogo-stick') || hasSkill(ctx.player, 'pogo_stick'),
});

// ─── SWARMING (O.1 batch 3n) ────────────────────────────────────────────────
// Swarming est une regle de placement : un joueur portant ce trait peut etre
// place sur le terrain au debut du match meme si cela depasse le nombre
// maximum de joueurs autorises (Underworld / Goblin). La logique de placement
// est geree au niveau des validations de setup ; cette entree de registre
// sert a la decouverte UI (catalogue et fiche joueur) et ne doit PAS exposer
// de modificateur d'action en jeu.
registerSkill({
  slug: 'swarming',
  triggers: ['on-setup'],
  description: "Ce joueur peut etre place sur le terrain au debut du match meme si cela depasse le nombre maximum de joueurs autorises.",
  canApply: (ctx) => hasSkill(ctx.player, 'swarming'),
});

// ─── KICK TEAM-MATE (O.1 batch 3n) ──────────────────────────────────────────
// Kick Team-Mate est une action speciale alternative a Throw Team-Mate : une
// fois par tour d'equipe, en plus d'un autre joueur effectuant une Passe ou un
// Lancer d'Equipier, un seul joueur avec ce trait peut effectuer une action
// "Kick Team-Mate". Le dispatch se fait via les handlers d'action dedies.
// L'entree du registre sert a la decouverte UI et a la documentation.
registerSkill({
  slug: 'kick-team-mate',
  triggers: ['on-activation'],
  description: "Une fois par tour d'equipe, en plus d'un autre joueur effectuant une Passe ou un Lancer d'Equipier, un seul joueur avec ce trait peut effectuer l'action speciale 'Kick Team-Mate'.",
  canApply: (ctx) => hasSkill(ctx.player, 'kick-team-mate') || hasSkill(ctx.player, 'kick_team_mate'),
});

// ─── DRUNKARD (O.1 batch 3o) ────────────────────────────────────────────────
// Drunkard (Poivrot) impose -1 au jet de Foncer (GFI) du joueur. Le
// modificateur reel est applique par la logique de mouvement (GFI handler) ;
// l'entree du registre sert a la decouverte UI et a la documentation. On
// n'expose PAS de getModifiers ici pour eviter le double-comptage avec
// l'implementation existante du GFI.
registerSkill({
  slug: 'drunkard',
  triggers: ['on-gfi'],
  description: "Ce joueur subit un modificateur de -1 au jet de de lorsqu'il tente de Foncer (GFI).",
  canApply: (ctx) => hasSkill(ctx.player, 'drunkard'),
});

// ─── TIMMM-BER! (O.1 batch 3o) ──────────────────────────────────────────────
// Timmm-ber! est un trait de relevement pour les joueurs a tres faible
// mobilite (MA <= 2, typiquement les Treemen). Quand ce joueur tente de se
// relever, il beneficie d'un modificateur +1 par coequipier Debout adjacent
// et en position ouverte. Un 1 naturel reste un echec quel que soit le
// nombre d'aidants. La mecanique de relevement dediee lit directement le
// skill sur le joueur ; l'entree du registre sert a la decouverte UI.
registerSkill({
  slug: 'timmm-ber',
  triggers: ['on-activation'],
  description: "Si ce joueur a une Allocation de Mouvement de 2 ou moins, il applique +1 au jet pour se relever par coequipier Debout adjacent en position ouverte. Un 1 naturel reste un echec.",
  canApply: (ctx) => hasSkill(ctx.player, 'timmm-ber') || hasSkill(ctx.player, 'timmm_ber'),
});

// ─── FUMBLEROOSKIE (O.1 batch 3o) ───────────────────────────────────────────
// Fumblerooskie est une action volontaire : pendant un mouvement ou un Blitz
// alors qu'il est en possession du ballon, ce joueur peut choisir de "lacher"
// le ballon dans n'importe quelle case quittee pendant son mouvement. Le
// ballon ne rebondit pas. La mecanique est geree par un handler d'action
// dedie ; l'entree du registre sert a la decouverte UI et a la documentation.
registerSkill({
  slug: 'fumblerooskie',
  triggers: ['on-movement'],
  description: "Pendant un mouvement ou un Blitz en possession du ballon, ce joueur peut lacher le ballon dans n'importe quelle case qu'il quitte. Le ballon ne rebondit pas.",
  canApply: (ctx) => hasSkill(ctx.player, 'fumblerooskie'),
});

// ─── HIT AND RUN (O.1 batch 3p) ─────────────────────────────────────────────
// Hit and Run est un skill d'Agilite Season 3 : une fois par activation, apres
// avoir effectue une action de Bloc (ou Blitz), le joueur peut effectuer un
// mouvement supplementaire. La mecanique de prolongation de mouvement est
// geree par les handlers d'action dedies ; l'entree du registre sert a la
// decouverte UI et a la documentation. On n'expose PAS de getModifiers pour
// eviter un double-comptage avec l'implementation du post-bloc.
registerSkill({
  slug: 'hit-and-run',
  triggers: ['on-movement'],
  description: "Ce joueur peut effectuer un mouvement apres avoir effectue une action de Blocage.",
  canApply: (ctx) => hasSkill(ctx.player, 'hit-and-run') || hasSkill(ctx.player, 'hit_and_run'),
});

// ─── MY BALL (O.1 batch 3p) ─────────────────────────────────────────────────
// My Ball est un trait Season 3 (Halfling Beer Boar entre autres). Un joueur
// portant ce trait ne peut pas abandonner volontairement le ballon quand il
// en est en possession : il ne peut donc pas effectuer d'action de Passe,
// de Passe a la main, ni utiliser toute autre competence qui lui ferait
// renoncer a la possession. La restriction est appliquee au niveau du
// dispatch d'actions ; l'entree du registre sert a la decouverte UI. On
// n'expose pas de getModifiers : il ne s'agit pas d'un modificateur de jet
// mais d'une interdiction d'action.
registerSkill({
  slug: 'my-ball',
  triggers: ['on-pass'],
  description: "Ce joueur ne peut pas abandonner volontairement le ballon : il ne peut pas effectuer de Passe, de Passe a la main, ni utiliser toute competence qui lui ferait renoncer a la possession.",
  canApply: (ctx) => hasSkill(ctx.player, 'my-ball') || hasSkill(ctx.player, 'my_ball'),
});

// ─── PLAGUE RIDDEN (O.1 batch 3p) ───────────────────────────────────────────
// Plague Ridden est un trait Season 3 de l'equipe Nurgle : une fois par
// match, si un joueur adverse avec ST <= 4 et sans trait Decay / Regeneration
// / Microbe subit un resultat de Blessure MORT (15-16) suite a un Bloc ou
// Agression d'un joueur avec ce trait, et qu'il ne peut etre sauve par un
// apothicaire, le porteur peut choisir d'utiliser Plague Ridden : la victime
// ne meurt pas, elle est infectee. La logique d'application est geree par le
// handler de blessure ; l'entree du registre sert a la decouverte UI. On
// n'expose PAS de getModifiers pour eviter un double-comptage sur l'injury
// roll.
registerSkill({
  slug: 'plague-ridden',
  triggers: ['on-injury'],
  description: "Une fois par match, si un joueur adverse avec Force 4 ou moins (sans Decomposition, Regeneration ou Microbe) subit une Blessure MORT suite a un Bloc ou une Agression de ce joueur et ne peut etre sauve par un apothicaire, vous pouvez utiliser ce trait : la victime est infectee au lieu de mourir.",
  canApply: (ctx) => hasSkill(ctx.player, 'plague-ridden') || hasSkill(ctx.player, 'plague_ridden'),
});

// ─── CONTAGIEUX (O.1 batch 3q) ──────────────────────────────────────────────
// Contagieux (Contagious) est un trait Season 3 de l'equipe Nurgle : il permet
// au joueur porteur de transmettre une maladie ou une infection aux joueurs
// adverses suite a une blessure infligee. La logique de transmission est
// geree par le handler de blessure Nurgle ; l'entree du registre sert a la
// decouverte UI et a la documentation. On n'expose PAS de getModifiers pour
// eviter un double-comptage sur l'injury roll.
registerSkill({
  slug: 'contagieux',
  triggers: ['on-injury'],
  description: "Ce trait permet au joueur de transmettre une maladie ou une infection aux joueurs adverses suite a une blessure infligee.",
  canApply: (ctx) => hasSkill(ctx.player, 'contagieux'),
});

// ─── FORK (O.1 batch 3q) ────────────────────────────────────────────────────
// Fork (Fourchette) est une competence Scelerate Season 3 (Undead Zombie
// Lineman entre autres) : quand un joueur adverse est Repousse par ce joueur,
// l'adverse ne peut plus fournir de Soutien Offensif ni Defensif jusqu'a la
// fin de sa prochaine activation. Le marquage de l'interdiction de soutien
// est applique par le resolveur de bloc / push-back ; l'entree du registre
// sert a la decouverte UI. On n'expose PAS de getModifiers : il ne s'agit pas
// d'un modificateur de jet mais d'un debuff applique a la cible repoussee.
registerSkill({
  slug: 'fork',
  triggers: ['on-block-result'],
  description: "Quand un joueur adverse est Repousse par ce joueur, il ne peut plus fournir de Soutien Offensif ni Defensif jusqu'a la fin de sa prochaine activation.",
  canApply: (ctx) => hasSkill(ctx.player, 'fork'),
});

// ─── HATE (O.1 batch 3q) ────────────────────────────────────────────────────
// Hate (Haine (X)) est un trait Season 3 : chaque fois que ce joueur effectue
// une Action de Blocage contre un joueur ayant le meme Mot-Cle que celui entre
// parentheses (keyword cible), il peut relancer un resultat Attaquant Plaque.
// Le parametre (X) est porte par la donnee roster ; l'entree du registre sert
// a la decouverte UI et a la documentation. On n'expose PAS de getModifiers
// pour eviter un double-comptage avec l'implementation de la relance ciblee.
registerSkill({
  slug: 'hate',
  triggers: ['on-block-attacker'],
  description: "Chaque fois que ce joueur effectue une Action de Blocage contre un joueur ayant le meme Mot-Cle que celui entre parentheses, il peut relancer un resultat Attaquant Plaque.",
  canApply: (ctx) => hasSkill(ctx.player, 'hate'),
});

// ─── INSIGNIFIANT (O.1 batch 3q) ────────────────────────────────────────────
// Insignifiant (Insignificant) est un trait Season 3 (Snotling Lineman entre
// autres) : lors de la construction de la liste d'equipe, on ne peut pas
// inclure plus de joueurs ayant ce trait que de joueurs ne l'ayant pas. La
// validation est appliquee par le constructeur de roster ; l'entree du
// registre sert a la decouverte UI. On n'expose PAS de getModifiers : il ne
// s'agit pas d'un modificateur de jet mais d'une regle de composition
// d'equipe.
registerSkill({
  slug: 'insignifiant',
  triggers: ['on-setup'],
  description: "Quand vous creez une Liste d'Equipe, vous ne pouvez pas inclure plus de joueurs ayant ce Trait que de joueurs n'ayant pas ce Trait.",
  canApply: (ctx) => hasSkill(ctx.player, 'insignifiant'),
});

// ─── PICK-ME-UP (O.1 batch 3q) ──────────────────────────────────────────────
// Pick-me-up (Petit remontant) est un trait Season 3 (Halfling Beer Boar,
// Snotling Fun Hurler, Rotspawn) : a la fin du tour d'equipe adverse, lancez
// un D6 pour chaque coequipier a Terre et non-Etourdi dans les trois cases
// d'un joueur Debout avec ce trait ; sur un succes, le coequipier est
// immediatement releve. Le flow de relevement differe est gere par le
// handler de fin de tour adverse ; l'entree du registre sert a la decouverte
// UI. On n'expose PAS de getModifiers pour eviter un double-comptage sur le
// jet de relevement.
registerSkill({
  slug: 'pick-me-up',
  triggers: ['on-activation'],
  description: "A la fin du tour d'equipe adverse, lancez un D6 pour chaque coequipier a Terre et non-Etourdi dans les trois cases d'un joueur Debout avec ce trait ; sur un succes, le coequipier est immediatement releve.",
  canApply: (ctx) => hasSkill(ctx.player, 'pick-me-up') || hasSkill(ctx.player, 'pick_me_up'),
});

// ─── BREATHE FIRE (O.1 batch 3r) ────────────────────────────────────────────
// Breathe Fire (Souffle Ardent) est un trait Season 3 (Slann Kroxigor,
// variantes Black Orc Trained Troll) : une fois par activation, au lieu
// d'effectuer une action de Bloc, ce joueur peut effectuer une action
// Speciale Souffle de Feu (template conique, jet d'armure sur tout joueur
// touche). Le dispatch d'action et le template de zone sont geres par le
// handler d'action speciale dedie ; l'entree du registre sert a la
// decouverte UI. On n'expose PAS de getModifiers : il ne s'agit pas d'un
// modificateur de jet mais d'une action alternative.
registerSkill({
  slug: 'breathe-fire',
  triggers: ['on-activation'],
  description: "Une fois par activation, au lieu d'effectuer une action de Bloc, ce joueur peut effectuer une action Speciale Souffle de Feu.",
  canApply: (ctx) => hasSkill(ctx.player, 'breathe-fire') || hasSkill(ctx.player, 'breathe_fire'),
});

// ─── CLEARANCE (O.1 batch 3r) ───────────────────────────────────────────────
// Clearance (Degagement) est une competence Scelerate Season 3 : une fois
// par tour d'equipe, le joueur peut annoncer une action Speciale de
// Degagement. Il peut effectuer un mouvement d'abord, puis choisir une
// direction avec le gabarit de renvois (D6 direction + D6 cases) ; pas de
// Turnover si le ballon est au sol. Le dispatch d'action est gere par le
// handler d'action speciale dedie ; l'entree du registre sert a la
// decouverte UI. On n'expose PAS de getModifiers : il s'agit d'une action
// alternative, pas d'un modificateur de jet.
registerSkill({
  slug: 'clearance',
  triggers: ['on-activation'],
  description: "Une fois par tour, ce joueur peut annoncer une action Speciale de Degagement. Il peut bouger d'abord, puis utiliser le Gabarit de Renvois (D6 direction + D6 cases). Pas de Turnover si le ballon est au sol.",
  canApply: (ctx) => hasSkill(ctx.player, 'clearance'),
});

// ─── PILE-ON (O.1 batch 3r) ─────────────────────────────────────────────────
// Pile On (Pique) est un trait (BB2020 S3) : apres un bloc reussi qui met
// l'adversaire a Terre, ce joueur peut choisir de Valdinguer sur lui au lieu
// de rester debout, offrant un bonus au jet d'armure/blessure via le handler
// dedie ; ce trait permet egalement de relancer un jet d'agilite
// d'atterrissage rate. Les deux effets sont resolus respectivement dans
// l'injury handler et dans le landing handler ; l'entree du registre sert a
// la decouverte UI. On n'expose PAS de getModifiers pour eviter un
// double-comptage sur l'injury/landing.
registerSkill({
  slug: 'pile-on',
  triggers: ['on-injury'],
  description: "Apres un bloc reussi, ce joueur peut choisir de Valdinguer sur l'adversaire a Terre pour des degats supplementaires. Permet egalement de relancer un jet d'agilite d'atterrissage rate.",
  canApply: (ctx) => hasSkill(ctx.player, 'pile-on') || hasSkill(ctx.player, 'pile_on'),
});

// ─── PROVOCATION (O.1 batch 3r) ─────────────────────────────────────────────
// Provocation est une competence Scelerate Season 3 : quand ce joueur est
// Repousse suite a un blocage contre lui, il peut forcer le joueur adverse
// a Poursuivre (sauf si l'adverse est Enracine). L'effet est applique par
// le resolveur de push-back / follow-up ; l'entree du registre sert a la
// decouverte UI. On n'expose PAS de getModifiers : il s'agit d'une
// contrainte sur la decision de suivre, pas d'un modificateur de jet.
registerSkill({
  slug: 'provocation',
  triggers: ['on-block-result'],
  description: "Quand ce joueur est Repousse suite a un blocage contre lui, il peut forcer le joueur adverse a Poursuivre (sauf si enracine).",
  canApply: (ctx) => hasSkill(ctx.player, 'provocation'),
});

// ─── SUREFOOT (O.1 batch 3r) ────────────────────────────────────────────────
// Surefoot (Appuis Surs) est une competence General Season 3 : chaque fois
// que ce joueur est cense etre Plaque ou Chuter (esquive, GFI, bloc, etc.),
// jetez un D6 ; sur un 6, il n'est pas Plaque / ne Chute pas. Si cela se
// produit pendant son activation, il peut continuer normalement sans
// Turnover. Le jet d'evitement est gere par les handlers de mouvement /
// bloc dedies ; l'entree du registre sert a la decouverte UI. On n'expose
// PAS de getModifiers pour eviter un double-comptage sur le jet passif.
registerSkill({
  slug: 'surefoot',
  triggers: ['on-movement'],
  description: "Chaque fois que ce joueur est cense etre Plaque ou Chuter, jetez un D6. Sur un 6, il n'est pas Plaque / ne Chute pas. Pendant son activation, il peut continuer normalement sans Turnover.",
  canApply: (ctx) => hasSkill(ctx.player, 'surefoot'),
});

// ─── TRICKSTER (O.1 batch 3r) ───────────────────────────────────────────────
// Trickster (Farceur) est un trait Season 3 : avant de determiner combien
// de des sont lances lors d'un bloc (ou d'une action speciale qui remplace
// un bloc) cible sur ce joueur, il peut etre retire du terrain et replace
// sur n'importe quelle case inoccupee adjacente au joueur effectuant le
// bloc. Le re-placement pre-bloc est gere par le pre-processor d'action de
// bloc ; l'entree du registre sert a la decouverte UI. On n'expose PAS de
// getModifiers : il ne s'agit pas d'un modificateur de jet mais d'un
// re-placement defensif.
registerSkill({
  slug: 'trickster',
  triggers: ['on-block-defender'],
  description: "Avant de determiner les des de bloc, ce joueur peut etre retire du terrain et replace sur n'importe quelle case inoccupee adjacente au joueur effectuant le bloc.",
  canApply: (ctx) => hasSkill(ctx.player, 'trickster'),
});

// ─── BLIND RAGE (O.1 batch 3s) ──────────────────────────────────────────────
// Blind Rage (Rage Aveugle) est une regle speciale Star Player : quand ce
// joueur echoue a un jet d'Intrepide (Dauntless), il peut relancer le D6.
// La relance conditionnelle est geree par le handler Dauntless dedie ;
// l'entree du registre sert a la decouverte UI. On n'expose PAS de
// getModifiers : il s'agit d'une relance opt-in, pas d'un modificateur
// de jet.
registerSkill({
  slug: 'blind-rage',
  triggers: ['on-block-attacker'],
  description: "Peut relancer le D6 pour Intrepide (Dauntless) quand ce joueur rate le jet.",
  canApply: (ctx) => hasSkill(ctx.player, 'blind-rage') || hasSkill(ctx.player, 'blind_rage'),
});

// ─── SLAYER (O.1 batch 3s) ──────────────────────────────────────────────────
// Slayer (Tueur) est une regle speciale Star Player : chaque jet
// d'Intrepide (Dauntless) rate peut etre relance. La relance est geree
// par le handler Dauntless dedie ; l'entree du registre sert a la
// decouverte UI. On n'expose PAS de getModifiers : il s'agit d'une
// relance opt-in, pas d'un modificateur de jet.
registerSkill({
  slug: 'slayer',
  triggers: ['on-block-attacker'],
  description: "Peut relancer les jets d'Intrepide (Dauntless) rates.",
  canApply: (ctx) => hasSkill(ctx.player, 'slayer'),
});

// ─── CONSUMMATE PROFESSIONAL (O.1 batch 3s) ─────────────────────────────────
// Consummate Professional (Professionnel Accompli) est une regle speciale
// Star Player : une fois par match, ce joueur peut relancer n'importe
// quel de qu'il vient de lancer. La relance est consommee via le
// reroll manager dedie ; l'entree du registre sert a la decouverte UI.
// On n'expose PAS de getModifiers : il s'agit d'une relance ponctuelle
// gerée par un pool par-match, pas d'un modificateur de jet.
registerSkill({
  slug: 'consummate-professional',
  triggers: ['passive'],
  description: "Une fois par match, ce joueur peut relancer n'importe quel de qu'il vient de lancer.",
  canApply: (ctx) =>
    hasSkill(ctx.player, 'consummate-professional') ||
    hasSkill(ctx.player, 'consummate_professional'),
});

// ─── CRUSHING BLOW (O.1 batch 3s) ───────────────────────────────────────────
// Crushing Blow (Coup Devastateur) est une regle speciale Star Player :
// une fois par match, apres un blocage reussi, ce joueur peut ajouter
// +1 au jet d'armure inflige a l'adversaire. Le bonus ponctuel est
// gere par l'armor handler dedie via un flag per-match ; l'entree du
// registre sert a la decouverte UI. On n'expose PAS de getModifiers :
// il s'agit d'un bonus opt-in une fois par match, pas d'un modificateur
// de jet permanent.
registerSkill({
  slug: 'crushing-blow',
  triggers: ['on-armor'],
  description: "Une fois par match, +1 au jet d'armure apres un blocage reussi.",
  canApply: (ctx) => hasSkill(ctx.player, 'crushing-blow') || hasSkill(ctx.player, 'crushing_blow'),
});

// ─── PIROUETTE (O.1 batch 3s) ───────────────────────────────────────────────
// Pirouette est une regle speciale Star Player : une fois par tour,
// ce joueur peut ajouter +1 a un jet d'esquive. Le bonus ponctuel est
// gere par le dodge handler dedie via un flag per-turn ; l'entree du
// registre sert a la decouverte UI. On n'expose PAS de getModifiers :
// il s'agit d'un bonus opt-in une fois par tour, pas d'un modificateur
// de jet permanent.
registerSkill({
  slug: 'pirouette',
  triggers: ['on-dodge'],
  description: "Une fois par tour, +1 au jet d'esquive.",
  canApply: (ctx) => hasSkill(ctx.player, 'pirouette'),
});

// ─── RELIABLE (O.1 batch 3s) ────────────────────────────────────────────────
// Reliable (Fiable) est une regle speciale Star Player : un Lancer de
// Coequipier rate effectue par ce joueur ne cause pas de Turnover.
// L'annulation du Turnover est geree par le Throw Team-Mate handler
// dedie ; l'entree du registre sert a la decouverte UI. On n'expose
// PAS de getModifiers : il s'agit d'une contrainte sur la resolution
// du turnover, pas d'un modificateur de jet.
registerSkill({
  slug: 'reliable',
  triggers: ['on-pass'],
  description: "Un Lancer de Coequipier rate effectue par ce joueur ne cause pas de turnover.",
  canApply: (ctx) => hasSkill(ctx.player, 'reliable'),
});

// ─── STAKES (O.1 batch 3t) ──────────────────────────────────────────────────
// Stakes (Pieux) est une regle speciale Star Player : lors d'une attaque de
// Poignard (Stab) contre un joueur Khemri, Necromantique, Mort-Vivant ou
// Vampire, ce joueur ajoute +1 au jet d'Armure. Le bonus conditionnel au
// roster adverse est gere par l'armor handler dedie (verification du
// type d'equipe via le roster metadata) ; l'entree du registre sert a
// la decouverte UI. On n'expose PAS de getModifiers : le bonus est
// conditionne par le type de roster adverse, pas applicable
// inconditionnellement via collectModifiers.
registerSkill({
  slug: 'stakes',
  triggers: ['on-armor'],
  description: "+1 au jet d'Armure lors d'une attaque de Poignard contre un joueur Khemri, Necromantique, Mort-Vivant ou Vampire.",
  canApply: (ctx) => hasSkill(ctx.player, 'stakes'),
});

// ─── SOLITARY AGGRESSOR (O.1 batch 3t) ──────────────────────────────────────
// Solitary Aggressor (Agresseur Solitaire) est une competence Scelerate
// Season 3 : quand ce joueur effectue une Action d'Agression sans Soutien
// Offensif ni Defensif, il peut relancer un Jet d'Armure rate. La
// relance conditionnelle (verification absence de soutiens) est geree
// par le foul handler dedie ; l'entree du registre sert a la decouverte
// UI. On n'expose PAS de getModifiers : il s'agit d'une relance opt-in,
// pas d'un modificateur de jet.
registerSkill({
  slug: 'solitary-aggressor',
  triggers: ['on-foul'],
  description: "Quand ce joueur effectue une Agression sans Soutien Offensif ou Defensif, il peut relancer un Jet d'Armure rate.",
  canApply: (ctx) =>
    hasSkill(ctx.player, 'solitary-aggressor') ||
    hasSkill(ctx.player, 'solitary_aggressor'),
});

// ─── LIGHTNING AGGRESSION (O.1 batch 3t) ────────────────────────────────────
// Lightning Aggression (Agression Eclair) est une competence Scelerate
// Season 3 : l'Activation de ce joueur ne prend pas fin apres qu'il a
// effectue une Action d'Agression et il peut continuer son Action de
// Mouvement avec son mouvement restant. La prolongation d'activation
// post-Agression est geree par le foul handler dedie ; l'entree du
// registre sert a la decouverte UI. On n'expose PAS de getModifiers :
// il s'agit d'une regle de flow d'activation, pas d'un modificateur de
// jet.
registerSkill({
  slug: 'lightning-aggression',
  triggers: ['on-foul'],
  description: "L'Activation de ce joueur ne prend pas fin apres une Action d'Agression ; il peut continuer son Action de Mouvement avec son mouvement restant.",
  canApply: (ctx) =>
    hasSkill(ctx.player, 'lightning-aggression') ||
    hasSkill(ctx.player, 'lightning_aggression'),
});

// ─── BOOT TO THE HEAD (O.1 batch 3t) ────────────────────────────────────────
// Boot to the Head (Coup de Crampons) est une competence Scelerate Season 3
// : ce joueur peut fournir un Soutien Offensif quand un coequipier effectue
// une Action d'Agression, quel que soit le nombre de joueurs adverses qui
// le Marquent. L'override du comptage de soutien sur Agression est gere
// par le foul-assist resolver dedie ; l'entree du registre sert a la
// decouverte UI. On n'expose PAS de getModifiers : il s'agit d'une regle
// d'eligibilite au soutien, pas d'un modificateur de jet applique via
// collectModifiers.
registerSkill({
  slug: 'boot-to-the-head',
  triggers: ['on-foul'],
  description: "Ce joueur peut fournir un Soutien Offensif pour une Agression d'un coequipier, quel que soit le nombre de joueurs adverses qui le Marquent.",
  canApply: (ctx) =>
    hasSkill(ctx.player, 'boot-to-the-head') ||
    hasSkill(ctx.player, 'boot_to_the_head'),
});

// ─── VIOLENT INNOVATOR (O.1 batch 3t) ───────────────────────────────────────
// Violent Innovator (Innovateur Violent) est une competence Scelerate
// Season 3 : si un adversaire subit une Elimination suite a une Action
// Speciale effectuee par ce joueur, ce joueur gagne les PSP
// correspondants. L'octroi de SPP post-Elimination sur Action Speciale
// est gere par le SPP manager dedie ; l'entree du registre sert a la
// decouverte UI. On n'expose PAS de getModifiers : il s'agit d'un
// ajustement de comptage SPP, pas d'un modificateur de jet.
registerSkill({
  slug: 'violent-innovator',
  triggers: ['on-injury'],
  description: "Si un adversaire subit une Elimination suite a une Action Speciale effectuee par ce joueur, celui-ci gagne les PSP correspondants.",
  canApply: (ctx) =>
    hasSkill(ctx.player, 'violent-innovator') ||
    hasSkill(ctx.player, 'violent_innovator'),
});

// ─── SABOTEUR (O.1 batch 3t) ────────────────────────────────────────────────
// Saboteur est une competence Scelerate Season 3 reservee aux Armes
// Secretes : quand ce joueur est Plaque suite a l'Action de Blocage d'un
// adversaire, avant le jet d'Armure, il peut lancer un D6. Sur 1-3, rien
// ne se passe et le jet d'Armure suit ; sur 4+, l'arme sabotee explose,
// Plaque aussi l'adversaire (sans Turnover sauf si porteur de Ballon)
// et ce joueur est automatiquement KO. La resolution du D6 d'explosion
// est geree par le saboteur handler dedie ; l'entree du registre sert a
// la decouverte UI. On n'expose PAS de getModifiers : il s'agit d'une
// action alternative pre-armure, pas d'un modificateur de jet.
registerSkill({
  slug: 'saboteur',
  triggers: ['on-armor'],
  description: "Avant le jet d'Armure apres avoir ete Plaque, ce joueur peut jeter un D6 : sur 4+ son arme sabotee explose, Plaquant aussi l'adversaire et KO automatique pour lui. Necessite Arme Secrete.",
  canApply: (ctx) => hasSkill(ctx.player, 'saboteur'),
});

// ─── BULLSEYE (O.1 batch 3u) ────────────────────────────────────────────────
// Bullseye (Dans le Mille) est un trait Season 3 Force : lors d'une Action
// de Lancer de Coequipier, si le resultat du lancer est un Lancer Superbe,
// le joueur lance ne Valdingue pas et atterrit sur la case ciblee.
// L'annulation du Valdingue post-TTM sur Lancer Superbe est geree par le
// Throw Team-Mate handler dedie ; l'entree du registre sert a la
// decouverte UI. On n'expose PAS de getModifiers : il s'agit d'une
// regle speciale de resolution TTM, pas d'un modificateur de jet.
registerSkill({
  slug: 'bullseye',
  triggers: ['on-pass'],
  description: "Lors d'un Lancer de Coequipier avec Lancer Superbe, le joueur lance ne Valdingue pas et atterrit sur la case ciblee.",
  canApply: (ctx) => hasSkill(ctx.player, 'bullseye'),
});

// ─── CASSE-OS (O.1 batch 3u) ────────────────────────────────────────────────
// Casse-Os (Bone Breaker) est une regle speciale Star Player : une fois
// par match, ce joueur ajoute +1 en Force lors d'une Action de Blocage.
// Le bonus ponctuel de Force est gere par le blocking handler dedie via
// un flag per-match ; l'entree du registre sert a la decouverte UI. On
// n'expose PAS de getModifiers : il s'agit d'un bonus opt-in une fois
// par match, pas d'un modificateur de jet permanent.
registerSkill({
  slug: 'casse-os',
  triggers: ['on-block-attacker'],
  description: "Une fois par match, +1 en Force lors d'une Action de Blocage.",
  canApply: (ctx) => hasSkill(ctx.player, 'casse-os') || hasSkill(ctx.player, 'casse_os'),
});

// ─── COUP SAUVAGE (O.1 batch 3u) ────────────────────────────────────────────
// Coup Sauvage (Savage Blow) est une regle speciale Star Player : une fois
// par partie, ce joueur peut relancer n'importe quel nombre de des de
// Blocage qu'il vient de lancer. La relance du pool de des est geree par
// le blocking handler dedie via un flag per-match ; l'entree du registre
// sert a la decouverte UI. On n'expose PAS de getModifiers : il s'agit
// d'une relance opt-in une fois par partie, pas d'un modificateur de
// jet.
registerSkill({
  slug: 'coup-sauvage',
  triggers: ['on-block-attacker'],
  description: "Une fois par partie, ce joueur peut relancer n'importe quel nombre de des de Blocage qu'il vient de lancer.",
  canApply: (ctx) => hasSkill(ctx.player, 'coup-sauvage') || hasSkill(ctx.player, 'coup_sauvage'),
});

// ─── LA BALISTE (O.1 batch 3u) ──────────────────────────────────────────────
// La Baliste (The Ballista) est une regle speciale Star Player : une fois
// par match, ce joueur peut relancer un jet de Passe rate (Passe ou Lancer
// de Coequipier). La relance ponctuelle est geree par le pass/TTM handler
// dedie via un flag per-match ; l'entree du registre sert a la decouverte
// UI. On n'expose PAS de getModifiers : il s'agit d'une relance opt-in
// une fois par match, pas d'un modificateur de jet.
registerSkill({
  slug: 'la-baliste',
  triggers: ['on-pass'],
  description: "Une fois par match, ce joueur peut relancer un jet de Passe rate (Passe ou Lancer de Coequipier).",
  canApply: (ctx) => hasSkill(ctx.player, 'la-baliste') || hasSkill(ctx.player, 'la_baliste'),
});

// ─── LORD OF CHAOS (O.1 batch 3u) ───────────────────────────────────────────
// Lord of Chaos (Seigneur du Chaos) est une regle speciale Star Player
// d'equipe : l'equipe de ce joueur gagne +1 Relance d'Equipe pour la
// premiere mi-temps. Le bonus de setup kickoff est applique par le pre-
// match sequence resolver dedie ; l'entree du registre sert a la
// decouverte UI. On n'expose PAS de getModifiers : il s'agit d'un bonus
// de setup de ressource equipe, pas d'un modificateur de jet.
registerSkill({
  slug: 'lord-of-chaos',
  triggers: ['on-kickoff'],
  description: "L'equipe de ce joueur gagne +1 Relance d'Equipe pour la premiere mi-temps.",
  canApply: (ctx) => hasSkill(ctx.player, 'lord-of-chaos') || hasSkill(ctx.player, 'lord_of_chaos'),
});

// ─── FATAL FLIGHT (O.1 batch 3u) ────────────────────────────────────────────
// Fatal Flight (Vol Fatal) est une competence Scelerate Season 3 : lors
// d'un Lancer de Coequipier, si le joueur lance atterrit ou rebondit sur
// une case occupee et plaque l'adversaire, il peut appliquer +1 au jet
// d'Armure ou au jet de Blessure ; si l'adversaire subit une Elimination,
// le joueur gagne les PSP correspondants. Le bonus armure/blessure
// conditionnel post-TTM et l'octroi de SPP sont geres par le TTM
// handler + SPP manager dedies ; l'entree du registre sert a la
// decouverte UI. On n'expose PAS de getModifiers : le bonus est
// conditionne par l'atterrissage sur case occupee suite a un TTM, pas
// applicable inconditionnellement via collectModifiers.
registerSkill({
  slug: 'fatal-flight',
  triggers: ['on-armor'],
  description: "Lors d'un Lancer de Coequipier, si le joueur lance atterrit ou rebondit sur une case occupee et plaque l'adversaire, +1 au jet d'Armure ou de Blessure ; sur Elimination, gagne les PSP correspondants.",
  canApply: (ctx) => hasSkill(ctx.player, 'fatal-flight') || hasSkill(ctx.player, 'fatal_flight'),
});
