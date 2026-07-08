/**
 * Système d'inducements Blood Bowl BB3 Season 2
 * Catalogue, validation d'achat, calcul petty cash et application des effets
 */

import { ExtendedGameState } from './game-state';
import { createLogEntry } from '../utils/logging';
import { StarPlayerDefinition, getAvailableStarPlayers, getStarPlayerBySlug } from '../rosters/star-players';
import { TeamId } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Identifiant unique d'un type d'inducement */
export type InducementSlug =
  | 'prayers_to_nuffle'
  | 'part_time_assistant_coaches'
  | 'temp_agency_cheerleaders'
  | 'team_mascot'
  | 'weather_mage'
  | 'extra_team_training'
  | 'bloodweiser_kegs'
  | 'bribe'
  | 'mortuary_assistant'
  | 'plague_doctor'
  | 'riotous_rookies'
  | 'wandering_apothecary'
  | 'halfling_master_chef'
  | 'biased_referee'
  | 'infamous_coaching_staff'
  | 'mercenary_players'
  | 'wizard'
  /** Retiré du catalogue S3 (A53) — conservé pour les données historiques. */
  | 'igor'
  | 'star_player';

/** Définition d'un inducement dans le catalogue */
export interface InducementDefinition {
  slug: InducementSlug;
  displayName: string;
  displayNameFr: string;
  baseCost: number;
  maxQuantity: number;
  /**
   * Règle (régionale OU spéciale d'équipe) qui donne un prix réduit
   * (ex: chantage_et_corruption pour Pots-de-vin).
   */
  discountRule?: string;
  /** Coût réduit si l'équipe a la règle. */
  discountCost?: number;
  /** Roster qui bénéficie du prix réduit (ex: halfling pour le Chef Cuistot). */
  discountRoster?: string;
  /** A53 — quantité max augmentée pour les équipes ayant la règle. */
  ruleMaxQuantity?: { rule: string; max: number };
  /**
   * A53 — prix variable (ex: Joueurs Mercenaires) : le coût est saisi par
   * le coach (baseCost = 0, indicatif).
   */
  variableCost?: boolean;
  /** Fonction de restriction : retourne true si l'équipe peut acheter cet inducement */
  canPurchase?: (ctx: InducementContext) => boolean;
  description: string;
}

/** Contexte pour valider si une équipe peut acheter un inducement */
export interface InducementContext {
  teamId: TeamId;
  regionalRules: string[];
  hasApothecary: boolean;
  rosterSlug: string;
  /**
   * A53 — règles spéciales d'équipe (slugs, cf. team-special-rules.ts).
   * Optionnel pour rétro-compat : absent = aucune.
   */
  specialRules?: string[];
}

/** Toutes les règles (régionales + spéciales) du contexte. */
function contextRules(ctx: InducementContext): string[] {
  return [...ctx.regionalRules, ...(ctx.specialRules ?? [])];
}

/** Un inducement acheté par une équipe */
export interface PurchasedInducement {
  slug: InducementSlug;
  displayName: string;
  cost: number;
  quantity: number;
  /** Pour les star players : slug du joueur star */
  starPlayerSlug?: string;
}

/** Sélection d'inducements soumise par un coach */
export interface InducementSelection {
  items: Array<{
    slug: InducementSlug;
    quantity: number;
    /** Pour star_player : slug du star player */
    starPlayerSlug?: string;
  }>;
}

/** Résultat de la validation d'une sélection */
export interface InducementValidationResult {
  valid: boolean;
  totalCost: number;
  errors: string[];
  purchasedItems: PurchasedInducement[];
}

/** Données nécessaires pour le calcul du petty cash */
export interface PettyCashInput {
  ctvTeamA: number;
  ctvTeamB: number;
  treasuryTeamA: number;
  treasuryTeamB: number;
  /**
   * FR14/A55 — plafond de trésorerie que l'équipe la plus faible (CTV le
   * plus bas) peut investir en coups de pouce AU-DELÀ de la différence de
   * CTV. Règle de ligue (ex: 50000) : l'extra vient de SA trésorerie,
   * selon disponibilité (20k dispo -> +20k max). `0`/absent = désactivé
   * (jeu en ligne inchangé : trésorerie libre). Aucun effet si égalité de
   * CTV.
   */
  underdogBonus?: number;
  /**
   * A55 — dépenses de coups de pouce déjà engagées par chaque équipe.
   * En mode ligue (underdogBonus défini), la dépense de l'équipe la plus
   * forte augmente d'autant la cagnotte de l'équipe la plus faible
   * (règle officielle : la CTV de la plus forte inclut ses achats).
   */
  spentTeamA?: number;
  spentTeamB?: number;
}

/** Résultat du calcul de petty cash */
export interface PettyCashResult {
  teamA: { pettyCash: number; maxBudget: number };
  teamB: { pettyCash: number; maxBudget: number };
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/**
 * A53 — Catalogue officiel Saison 2025 (« Acheter des Coups de Pouce ! »,
 * livre p.142-149). Une entrée par Coup de Pouce commun ; les prix
 * « variables » du livre sont soit fixés à la variante publiée (Arbitre
 * Partial = Représentant de Ligue Louche, Staff Célèbre = Josef Bugman,
 * Sorcier = Sorcier-Sportif), soit saisis par le coach (Mercenaires).
 */
export const INDUCEMENT_CATALOGUE: readonly InducementDefinition[] = [
  {
    slug: 'prayers_to_nuffle',
    displayName: 'Prayers to Nuffle',
    displayNameFr: 'Prières à Nuffle',
    baseCost: 10_000,
    maxQuantity: 3,
    description:
      "Pour chaque prière achetée, jetez un D16 sur le Tableau des Prières à Nuffle (relancez les doublons). L'effet dure jusqu'à la fin du match.",
  },
  {
    slug: 'part_time_assistant_coaches',
    displayName: 'Part-time Assistant Coaches',
    displayNameFr: 'Coachs Assistants à Temps Partiel',
    baseCost: 20_000,
    maxQuantity: 5,
    description: '+1 coach assistant pour la durée du match, par unité achetée.',
  },
  {
    slug: 'temp_agency_cheerleaders',
    displayName: 'Temp Agency Cheerleaders',
    displayNameFr: 'Cheerleaders Intérimaires',
    baseCost: 5_000,
    maxQuantity: 5,
    description: '+1 cheerleader pour la durée du match, par unité achetée.',
  },
  {
    slug: 'team_mascot',
    displayName: 'Team Mascot',
    displayNameFr: "Mascotte d'Équipe",
    baseCost: 25_000,
    maxQuantity: 1,
    description:
      "Une relance d'équipe supplémentaire à chaque mi-temps (sur 1-3 au D6, elle s'avère inefficace) ; permet aussi de relancer un 1 naturel au D6 du résultat Fans en Folie du coup d'envoi.",
  },
  {
    slug: 'weather_mage',
    displayName: 'Weather Mage',
    displayNameFr: 'Mage Météo',
    baseCost: 25_000,
    maxQuantity: 1,
    description:
      "Une fois par match, au début d'un de vos tours : refaites immédiatement un jet sur le Tableau de Météo avec un modificateur de -2 à +2, appliqué jusqu'au prochain changement de météo.",
  },
  {
    slug: 'bloodweiser_kegs',
    displayName: 'Premium Blitz Kegs',
    displayNameFr: 'Fûts de Blitz Premium',
    baseCost: 50_000,
    maxQuantity: 2,
    description:
      '+1 aux jets de rétablissement de vos joueurs K.-O. pour chaque fût acheté.',
  },
  {
    slug: 'bribe',
    displayName: 'Bribes',
    displayNameFr: 'Pots-de-vin',
    baseCost: 100_000,
    maxQuantity: 3,
    discountRule: 'chantage_et_corruption',
    discountCost: 50_000,
    ruleMaxQuantity: { rule: 'chantage_et_corruption', max: 6 },
    description:
      "Quand un joueur est Expulsé, jetez un D6 : sur 2+ il reste en jeu (le pot-de-vin est dépensé, et perdu même sur un 1). 0-6 à 50 000 po pour les équipes avec Chantage et Corruption.",
  },
  {
    slug: 'extra_team_training',
    displayName: 'Extra Team Training',
    displayNameFr: 'Entraînement Supplémentaire',
    baseCost: 100_000,
    maxQuantity: 8,
    description:
      "+1 relance d'équipe pour la durée du match, par entraînement acheté.",
  },
  {
    slug: 'mortuary_assistant',
    displayName: 'Mortuary Assistant',
    displayNameFr: 'Assistant Funéraire',
    baseCost: 100_000,
    maxQuantity: 1,
    canPurchase: (ctx) =>
      contextRules(ctx).includes('maitres_de_la_non_vie'),
    description:
      'Une fois par match, relance un jet de Régénération raté pour un de vos joueurs. Équipes avec la règle spéciale Maîtres de la Non-vie seulement.',
  },
  {
    slug: 'plague_doctor',
    displayName: 'Plague Doctor',
    displayNameFr: 'Médecin de la Peste',
    baseCost: 100_000,
    maxQuantity: 1,
    canPurchase: (ctx) =>
      contextRules(ctx).includes('favori_de') && ctx.rosterSlug === 'nurgle',
    description:
      "Une fois par match, relance un jet de Régénération raté ; peut aussi être utilisé comme un apothicaire. Équipes avec la règle spéciale Favoris de Nurgle seulement.",
  },
  {
    slug: 'riotous_rookies',
    displayName: 'Riotous Rookies',
    displayNameFr: 'Débutants Déchaînés',
    baseCost: 150_000,
    maxQuantity: 1,
    canPurchase: (ctx) =>
      contextRules(ctx).includes('trois_quarts_a_vil_prix'),
    description:
      'Ajoute 2D3+1 Journaliers à votre équipe pour ce match. Équipes avec la règle spéciale Trois-quarts à Vil Prix seulement.',
  },
  {
    slug: 'wandering_apothecary',
    displayName: 'Wandering Apothecary',
    displayNameFr: 'Apothicaire Ambulant',
    baseCost: 100_000,
    maxQuantity: 2,
    canPurchase: (ctx) => ctx.hasApothecary,
    description:
      "Un usage d'apothicaire supplémentaire pendant le match, utilisable une fois par partie comme un apothicaire normal. Inaccessible aux équipes qui ne peuvent pas embaucher d'apothicaire.",
  },
  {
    slug: 'halfling_master_chef',
    displayName: 'Halfling Master Chef',
    displayNameFr: 'Chef Cuistot Halfling',
    baseCost: 300_000,
    maxQuantity: 1,
    discountRoster: 'halfling',
    discountCost: 100_000,
    description:
      "Avant le coup d'envoi de chaque mi-temps, jetez 3 D6 : pour chaque 4+, votre équipe gagne une relance et l'adversaire en perd une pour la mi-temps. 100 000 po pour les équipes de Halflings.",
  },
  {
    slug: 'biased_referee',
    displayName: 'Biased Referee',
    displayNameFr: 'Arbitre Partial (Représentant de Ligue Louche)',
    baseCost: 120_000,
    maxQuantity: 1,
    discountRule: 'chantage_et_corruption',
    discountCost: 80_000,
    description:
      "Œil Attentif : après une Action d'Agression adverse sans expulsion, sur 5+ au D6 le joueur adverse est Expulsé. « Moi je n'ai rien vu ! » : +1 pour Contester la Décision. 80 000 po avec Chantage et Corruption.",
  },
  {
    slug: 'infamous_coaching_staff',
    displayName: 'Infamous Coaching Staff',
    displayNameFr: 'Staff Célèbre (Josef Bugman)',
    baseCost: 100_000,
    maxQuantity: 1,
    description:
      "Josef Bugman : +1 chaque fois que vous jetez pour le rétablissement d'un joueur K.-O. ; une fois par match, après les placements mais avant le coup d'envoi, retirez et replacez D3 de vos joueurs. Ne peut pas aussi être recruté en Star Player.",
  },
  {
    slug: 'mercenary_players',
    displayName: 'Mercenary Players',
    displayNameFr: 'Joueurs Mercenaires',
    baseCost: 0,
    maxQuantity: 3,
    variableCost: true,
    description:
      "Joueur issu de votre fiche d'équipe, embauché pour le match : coût de la fiche + 30 000 po (+ 50 000 po pour une unique Compétence Principale au choix). Gagne Solitaire (4+). Saisissez le coût calculé.",
  },
  {
    slug: 'wizard',
    displayName: 'Wizard',
    displayNameFr: 'Sorcier (Sorcier-Sportif)',
    baseCost: 150_000,
    maxQuantity: 1,
    description:
      'Sorcier-Sportif : une fois par match, lance Boule de Feu ou Zap !',
  },
  {
    slug: 'star_player',
    displayName: 'Star Player',
    displayNameFr: 'Joueur Star',
    baseCost: 0, // Variable — cost is per star player
    maxQuantity: 2,
    description: 'Hire a Star Player for the match. Cost varies per player.',
  },
] as const;

/** Lookup rapide par slug */
const CATALOGUE_MAP = new Map<InducementSlug, InducementDefinition>(
  INDUCEMENT_CATALOGUE.map((def) => [def.slug, def])
);

export function getInducementDefinition(slug: InducementSlug): InducementDefinition | undefined {
  return CATALOGUE_MAP.get(slug);
}

/**
 * A53 — quantité maximum effective pour une équipe : certains Coups de
 * Pouce ont un plafond augmenté avec une règle spéciale (ex: Pots-de-vin
 * 0-6 avec Chantage et Corruption, au lieu de 0-3).
 */
export function getInducementMaxQuantity(
  slug: InducementSlug,
  ctx: InducementContext,
): number {
  const def = CATALOGUE_MAP.get(slug);
  if (!def) return 0;
  if (
    def.ruleMaxQuantity &&
    contextRules(ctx).includes(def.ruleMaxQuantity.rule)
  ) {
    return def.ruleMaxQuantity.max;
  }
  return def.maxQuantity;
}

// ---------------------------------------------------------------------------
// Petty Cash
// ---------------------------------------------------------------------------

/**
 * Calcule le petty cash pour les deux équipes selon les règles BB3 Season 2.
 * L'équipe avec la CTV inférieure reçoit la différence en petty cash.
 * Les deux équipes peuvent dépenser de leur trésorerie en plus.
 */
export function calculatePettyCash(input: PettyCashInput): PettyCashResult {
  const diff = input.ctvTeamA - input.ctvTeamB;
  const bonus = input.underdogBonus ?? 0;
  const leagueMode = bonus > 0;
  const spentA = Math.max(0, input.spentTeamA ?? 0);
  const spentB = Math.max(0, input.spentTeamB ?? 0);

  // La cagnotte gratuite = différence de CTV (équipe au CTV strictement le
  // plus bas). A55 — en mode ligue, la dépense de l'adversaire (plus fort)
  // s'ajoute à la cagnotte de l'underdog.
  const pettyCashA =
    diff < 0 ? Math.abs(diff) + (leagueMode ? spentB : 0) : 0;
  const pettyCashB = diff > 0 ? diff + (leagueMode ? spentA : 0) : 0;

  // A55 — en mode ligue, l'underdog ne peut ajouter que min(bonus,
  // trésorerie dispo) de SA trésorerie (le bonus n'est plus une cagnotte
  // gratuite). L'équipe la plus forte dépense librement sa trésorerie.
  const treasurySpendableA =
    leagueMode && diff < 0
      ? Math.min(bonus, input.treasuryTeamA)
      : input.treasuryTeamA;
  const treasurySpendableB =
    leagueMode && diff > 0
      ? Math.min(bonus, input.treasuryTeamB)
      : input.treasuryTeamB;

  return {
    teamA: {
      pettyCash: pettyCashA,
      maxBudget: pettyCashA + treasurySpendableA,
    },
    teamB: {
      pettyCash: pettyCashB,
      maxBudget: pettyCashB + treasurySpendableB,
    },
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Calcule le coût unitaire d'un inducement pour une équipe donnée.
 */
export function getInducementCost(
  slug: InducementSlug,
  ctx: InducementContext,
  starPlayerSlug?: string
): number {
  if (slug === 'star_player' && starPlayerSlug) {
    const sp = getStarPlayerBySlug(starPlayerSlug);
    if (!sp) return 0;
    // Verify this star player is available to this team
    const available = getAvailableStarPlayers(ctx.rosterSlug, ctx.regionalRules);
    return available.some((s) => s.slug === starPlayerSlug) ? sp.cost : 0;
  }

  const def = CATALOGUE_MAP.get(slug);
  if (!def) return 0;

  // A53 — remise par règle (régionale OU spéciale d'équipe)…
  if (
    def.discountRule &&
    def.discountCost &&
    contextRules(ctx).includes(def.discountRule)
  ) {
    return def.discountCost;
  }
  // …ou par roster (ex: Chef Cuistot Halfling à 100k pour les Halflings).
  if (
    def.discountRoster &&
    def.discountCost &&
    ctx.rosterSlug === def.discountRoster
  ) {
    return def.discountCost;
  }

  return def.baseCost;
}

/**
 * Valide une sélection d'inducements pour une équipe.
 * Vérifie les limites de quantité, les restrictions d'accès et le budget.
 */
export function validateInducementSelection(
  selection: InducementSelection,
  ctx: InducementContext,
  budget: number
): InducementValidationResult {
  const errors: string[] = [];
  const purchasedItems: PurchasedInducement[] = [];
  let totalCost = 0;

  // Track quantities per slug to enforce maxQuantity
  const quantityMap = new Map<InducementSlug, number>();
  // BB2020 : un meme Star Player ne peut pas etre embauche en double par
  // une meme equipe. Track les starPlayerSlug deja utilises.
  const usedStarPlayerSlugs = new Set<string>();

  for (const item of selection.items) {
    const def = CATALOGUE_MAP.get(item.slug);

    if (!def) {
      errors.push(`Inducement inconnu : ${item.slug}`);
      continue;
    }

    if (item.quantity <= 0) {
      errors.push(`Quantité invalide pour ${def.displayName} : ${item.quantity}`);
      continue;
    }

    // Check purchase restriction
    if (def.canPurchase && !def.canPurchase(ctx)) {
      errors.push(`${def.displayName} n'est pas disponible pour cette équipe.`);
      continue;
    }

    // BB2020 : dedup star players. Un meme Star Player ne peut pas etre
    // embauche en double (quantity > 1) ni via deux items separes.
    if (item.slug === 'star_player' && item.starPlayerSlug) {
      if (item.quantity > 1) {
        errors.push(
          `Un Star Player ne peut etre embauche qu'une seule fois (${item.starPlayerSlug}, demandé ${item.quantity}).`,
        );
        continue;
      }
      if (usedStarPlayerSlugs.has(item.starPlayerSlug)) {
        errors.push(
          `Star Player ${item.starPlayerSlug} deja embauche (un meme Star Player ne peut pas etre pris en double).`,
        );
        continue;
      }
      usedStarPlayerSlugs.add(item.starPlayerSlug);
    }

    // Accumulate quantities
    const currentQty = quantityMap.get(item.slug) ?? 0;
    const newQty = currentQty + item.quantity;

    // A53 — plafond effectif (peut être augmenté par une règle spéciale).
    const maxQty = getInducementMaxQuantity(item.slug, ctx);
    if (newQty > maxQty) {
      errors.push(`${def.displayName} : maximum ${maxQty}, demandé ${newQty}.`);
      continue;
    }

    quantityMap.set(item.slug, newQty);

    // Calculate cost
    const unitCost = getInducementCost(item.slug, ctx, item.starPlayerSlug);

    if (item.slug === 'star_player' && unitCost === 0 && item.starPlayerSlug) {
      errors.push(`Star Player inconnu ou non disponible : ${item.starPlayerSlug}`);
      continue;
    }

    const itemTotal = unitCost * item.quantity;
    totalCost += itemTotal;

    purchasedItems.push({
      slug: item.slug,
      displayName: def.displayName,
      cost: unitCost,
      quantity: item.quantity,
      ...(item.starPlayerSlug ? { starPlayerSlug: item.starPlayerSlug } : {}),
    });
  }

  // Check budget
  if (totalCost > budget) {
    errors.push(`Budget insuffisant : coût total ${totalCost}, budget disponible ${budget}.`);
  }

  return {
    valid: errors.length === 0,
    totalCost,
    errors,
    purchasedItems,
  };
}

// ---------------------------------------------------------------------------
// Application des effets pré-match
// ---------------------------------------------------------------------------

/**
 * Applique les effets des inducements achetés au game state.
 * Appelé pendant processInducements() pour modifier l'état de match.
 */
export function applyInducementEffects(
  state: ExtendedGameState,
  teamId: TeamId,
  items: PurchasedInducement[]
): ExtendedGameState {
  let newState = state;

  for (const item of items) {
    switch (item.slug) {
      case 'extra_team_training': {
        const rerollKey = teamId === 'A' ? 'teamA' : 'teamB';
        newState = {
          ...newState,
          teamRerolls: {
            ...newState.teamRerolls,
            [rerollKey]: newState.teamRerolls[rerollKey] + item.quantity,
          },
        };
        break;
      }

      case 'wandering_apothecary':
      case 'igor': {
        // BB2020 : Wandering Apothecary = +1 use (cumulatif avec un
        // apothecary natif). Igor = idem pour les equipes sans apothecary
        // natif. Avant le fix, `apothecaryAvailable` etait boolean :
        // l'achat sur une equipe deja apothecary etait un silent no-op.
        // Maintenant on incremente le compteur par `quantity`.
        const apoKey = teamId === 'A' ? 'teamA' : 'teamB';
        const current = newState.apothecaryAvailable[apoKey] ?? 0;
        newState = {
          ...newState,
          apothecaryAvailable: {
            ...newState.apothecaryAvailable,
            [apoKey]: current + item.quantity,
          },
        };
        break;
      }

      // The following inducements store data for use during the match
      // but don't modify pre-match state directly:
      // - bloodweiser_kegs: +1 to KO recovery (checked in kickoff KO recovery)
      // - bribe: avoid send-off (checked in foul resolution)
      // - halfling_master_chef: steal rerolls (checked at start of each drive)
      // - wizard: cast spell once (new action during match)
      // - riotous_rookies: add players (resolved at match start)
      // - star_player: add player to roster (resolved at match start)
      default:
        break;
    }
  }

  return newState;
}

// ---------------------------------------------------------------------------
// processInducements (remplacement du stub)
// ---------------------------------------------------------------------------

/**
 * Traite les inducements pour les deux équipes.
 * Remplace le stub précédent qui passait toujours items: [].
 */
export function processInducementsWithSelection(
  state: ExtendedGameState,
  pettyCashInput: PettyCashInput,
  selectionA: InducementSelection,
  selectionB: InducementSelection,
  ctxA: InducementContext,
  ctxB: InducementContext
): { state: ExtendedGameState; validationA: InducementValidationResult; validationB: InducementValidationResult } {
  if (state.preMatch.phase !== 'inducements') {
    return {
      state,
      validationA: { valid: false, totalCost: 0, errors: ['Phase incorrecte'], purchasedItems: [] },
      validationB: { valid: false, totalCost: 0, errors: ['Phase incorrecte'], purchasedItems: [] },
    };
  }

  const pettyCash = calculatePettyCash(pettyCashInput);

  const validationA = validateInducementSelection(selectionA, ctxA, pettyCash.teamA.maxBudget);
  const validationB = validateInducementSelection(selectionB, ctxB, pettyCash.teamB.maxBudget);

  if (!validationA.valid || !validationB.valid) {
    return { state, validationA, validationB };
  }

  // Calculate treasury spent (total cost minus petty cash used)
  const treasurySpentA = Math.max(0, validationA.totalCost - pettyCash.teamA.pettyCash);
  const treasurySpentB = Math.max(0, validationB.totalCost - pettyCash.teamB.pettyCash);

  // Apply pre-match effects
  let newState = applyInducementEffects(state, 'A', validationA.purchasedItems);
  newState = applyInducementEffects(newState, 'B', validationB.purchasedItems);

  // Build log entries
  const itemsLogA = validationA.purchasedItems.map((i) => `${i.displayName} x${i.quantity}`).join(', ') || 'aucun';
  const itemsLogB = validationB.purchasedItems.map((i) => `${i.displayName} x${i.quantity}`).join(', ') || 'aucun';

  const logEntry = createLogEntry(
    'action',
    `Inducements — ${newState.teamNames.teamA}: ${itemsLogA} (Petty Cash: ${pettyCash.teamA.pettyCash}, Treasury: ${treasurySpentA}) | ${newState.teamNames.teamB}: ${itemsLogB} (Petty Cash: ${pettyCash.teamB.pettyCash}, Treasury: ${treasurySpentB})`
  );

  newState = {
    ...newState,
    preMatch: {
      ...newState.preMatch,
      phase: 'prayers',
      inducements: {
        teamA: {
          pettyCash: pettyCash.teamA.pettyCash,
          treasurySpent: treasurySpentA,
          items: validationA.purchasedItems,
        },
        teamB: {
          pettyCash: pettyCash.teamB.pettyCash,
          treasurySpent: treasurySpentB,
          items: validationB.purchasedItems,
        },
      },
    },
    gameLog: [...newState.gameLog, logEntry],
  };

  return { state: newState, validationA, validationB };
}
