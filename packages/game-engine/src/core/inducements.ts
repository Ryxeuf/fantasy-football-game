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
  | 'extra_team_training'
  | 'bloodweiser_kegs'
  | 'bribe'
  | 'wandering_apothecary'
  | 'halfling_master_chef'
  | 'wizard'
  | 'igor'
  | 'riotous_rookies'
  | 'star_player';

/** Définition d'un inducement dans le catalogue */
export interface InducementDefinition {
  slug: InducementSlug;
  displayName: string;
  displayNameFr: string;
  baseCost: number;
  maxQuantity: number;
  /** Règle régionale qui donne un prix réduit (ex: badlands_brawl pour Bribe) */
  discountRule?: string;
  /** Coût réduit si l'équipe a la règle régionale */
  discountCost?: number;
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
}

/** Résultat du calcul de petty cash */
export interface PettyCashResult {
  teamA: { pettyCash: number; maxBudget: number };
  teamB: { pettyCash: number; maxBudget: number };
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const INDUCEMENT_CATALOGUE: readonly InducementDefinition[] = [
  {
    slug: 'extra_team_training',
    displayName: 'Extra Team Training',
    displayNameFr: 'Entraînement supplémentaire',
    baseCost: 100_000,
    maxQuantity: 4,
    description: '+1 Team Re-roll for the match per purchase.',
  },
  {
    slug: 'bloodweiser_kegs',
    displayName: 'Bloodweiser Kegs',
    displayNameFr: 'Fûts de Bloodweiser',
    baseCost: 50_000,
    maxQuantity: 2,
    description: '+1 to KO recovery rolls for each keg purchased.',
  },
  {
    slug: 'bribe',
    displayName: 'Bribe',
    displayNameFr: 'Pot-de-vin',
    baseCost: 100_000,
    maxQuantity: 3,
    discountRule: 'badlands_brawl',
    discountCost: 50_000,
    description: 'May be used once per bribe to avoid a send-off after committing a foul.',
  },
  {
    slug: 'wandering_apothecary',
    displayName: 'Wandering Apothecary',
    displayNameFr: 'Apothicaire itinérant',
    baseCost: 100_000,
    maxQuantity: 1,
    canPurchase: (ctx) => ctx.hasApothecary,
    description: 'Grants one additional apothecary use during the match.',
  },
  {
    slug: 'halfling_master_chef',
    displayName: 'Halfling Master Chef',
    displayNameFr: 'Maître-queux halfling',
    baseCost: 300_000,
    maxQuantity: 1,
    discountRule: 'halfling_thimble_cup',
    discountCost: 100_000,
    description: 'At the start of each drive, roll 3D6. For each 4+, steal one reroll from the opponent.',
  },
  {
    slug: 'wizard',
    displayName: 'Wizard',
    displayNameFr: 'Magicien',
    baseCost: 150_000,
    maxQuantity: 1,
    description: 'Once per match, cast Fireball or Lightning Bolt.',
  },
  {
    slug: 'igor',
    displayName: 'Igor',
    displayNameFr: 'Igor',
    baseCost: 100_000,
    maxQuantity: 1,
    canPurchase: (ctx) => !ctx.hasApothecary,
    description: 'Works like an apothecary for teams that normally cannot hire one.',
  },
  {
    slug: 'riotous_rookies',
    displayName: 'Riotous Rookies',
    displayNameFr: 'Recrues indisciplinées',
    baseCost: 100_000,
    maxQuantity: 1,
    description: 'D3+3 additional Rookie players (Loner 4+) for the match.',
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

  const pettyCashA = diff < 0 ? Math.abs(diff) : 0;
  const pettyCashB = diff > 0 ? diff : 0;

  return {
    teamA: {
      pettyCash: pettyCashA,
      maxBudget: pettyCashA + input.treasuryTeamA,
    },
    teamB: {
      pettyCash: pettyCashB,
      maxBudget: pettyCashB + input.treasuryTeamB,
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

  if (def.discountRule && def.discountCost && ctx.regionalRules.includes(def.discountRule)) {
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

    // Accumulate quantities
    const currentQty = quantityMap.get(item.slug) ?? 0;
    const newQty = currentQty + item.quantity;

    if (newQty > def.maxQuantity) {
      errors.push(`${def.displayName} : maximum ${def.maxQuantity}, demandé ${newQty}.`);
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
        // Grant apothecary availability (or extra use for wandering apothecary)
        const apoKey = teamId === 'A' ? 'teamA' : 'teamB';
        newState = {
          ...newState,
          apothecaryAvailable: {
            ...newState.apothecaryAvailable,
            [apoKey]: true,
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
