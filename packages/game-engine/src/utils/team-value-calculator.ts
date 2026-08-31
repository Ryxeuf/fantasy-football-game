/**
 * Calculateur de valeurs d'équipe selon les règles Blood Bowl
 */

import { DEFAULT_RULESET, type Ruleset, getPositionBySlug } from '../rosters/positions';
import { DEFAULT_FORMAT, type GameFormat } from '../rosters/formats';
import { defaultStaffConfig, type RosterStaffConfig } from '../rosters/staff-config';

export { getRerollCost, getAllRerollCosts, REROLL_COSTS, DEFAULT_REROLL_COST } from '../rosters/reroll-costs';

/** Sous-ensemble "coûts" de la config staff (po) utilisé pour la VE/VEA. */
export type StaffCosts = Pick<
  RosterStaffConfig,
  'rerollCost' | 'cheerleaderCost' | 'assistantCost' | 'apothecaryCost'
>;

/**
 * Règle spéciale « Trois-quarts à vil prix » (Cheap Linemen) — Ogres,
 * Snotlings. En Jeu en Ligue, le Coût d'Embauche des Trois-quarts compte
 * pour 0 po dans la Valeur d'Équipe ACTUELLE ; leurs augmentations de
 * valeur sont incluses normalement. C'est la seule exception au calcul
 * standard de la VEA.
 */
export const CHEAP_LINEMEN_RULE = 'trois_quarts_a_vil_prix';

export interface TeamValuePlayer {
  /** Valeur totale du joueur : coût d'embauche + augmentations. */
  cost: number;
  available: boolean; // true si le joueur est disponible pour le prochain match
  /**
   * Coût d'embauche seul (po). Défaut : `cost` — c'est-à-dire « aucune
   * augmentation ». Utilisé uniquement par « Trois-quarts à vil prix »,
   * qui n'annule QUE cette part.
   */
  hireCost?: number;
  /** Le joueur occupe un poste de Trois-quart (`isLineman`). */
  lineman?: boolean;
}

export interface TeamValueData {
  players: Array<TeamValuePlayer>;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  roster: string; // Ajout du roster pour calculer le coût des relances
  ruleset?: Ruleset; // Ruleset utilisé pour récupérer les données associées au roster
  /** Format de jeu (sert à résoudre la config staff par défaut). Défaut: bb11. */
  format?: GameFormat;
  /**
   * Coûts staff résolus (po), idéalement issus du modèle DB `RosterStaffConfig`.
   * Si absent, dérivé de `defaultStaffConfig(roster, format ?? bb11)` — qui
   * reproduit à l'identique les coûts historiques codés en dur (rétro-compat).
   */
  staffConfig?: StaffCosts;
  /**
   * Règles spéciales d'équipe (slugs). Seule `trois_quarts_a_vil_prix` est
   * lue ici — elle modifie la VEA. Absent = aucune règle particulière.
   */
  specialRules?: readonly string[];
}

/** Résout les coûts staff : config explicite > défaut dérivé (roster, format). */
function resolveStaffCosts(data: TeamValueData): StaffCosts {
  if (data.staffConfig) return data.staffConfig;
  return defaultStaffConfig(data.roster, data.format ?? DEFAULT_FORMAT);
}

export interface CalculatedValues {
  teamValue: number; // VE - Valeur d'Équipe
  currentValue: number; // VEA - Valeur d'Équipe Actuelle
  treasury: number; // Trésorerie (calculée après chaque match)
}

/**
 * Détail ligne à ligne de la VE / VEA.
 *
 * Sert de source unique aux vues « Résumé du budget » : les consommateurs
 * (fiche d'équipe, feuille de match, exports) affichent ces postes au lieu
 * de les re-dériver chacun de leur côté — c'est cette re-dérivation qui
 * faisait diverger le coût des joueurs affiché de la VE réelle (surcoûts
 * d'avancement et ruleset ignorés côté web).
 *
 * Invariants :
 *  - `teamValue === playersCost + staffCost + rerollsCost`
 *  - `currentValue === availablePlayersCost + staffCost + rerollsCost`
 *  - `playersCost === playersHireCost + advancementsCost`
 *  - `currentValue === teamValue − unavailablePlayersCost − cheapLinemenWaived`
 *
 * Le dernier est celui que l'UI rend lisible : tout écart VE → VEA se lit
 * comme la somme de deux postes nommés, jamais comme un chiffre inexpliqué.
 */
export interface TeamValueBreakdown {
  /** Coût de TOUS les joueurs engagés (base + surcoûts d'avancement). */
  readonly playersCost: number;
  /**
   * Coût d'EMBAUCHE seul de tous les joueurs engagés, hors surcoûts
   * d'avancement (po).
   *
   * C'est la part payée en OR à la construction. Les améliorations, elles,
   * se paient en PSP (pool de construction ou SPP gagnés en match) : les
   * compter au budget d'or affichait un « Budget restant » négatif sur une
   * équipe pourtant construite au budget exact — et faisait tomber sa
   * trésorerie à 0 via `syncDraftTreasury`.
   */
  readonly playersHireCost: number;
  /**
   * Surcoûts d'avancement de tous les joueurs engagés (po) :
   * `playersCost − playersHireCost`. Entre dans la VE, jamais dans le
   * budget de construction.
   */
  readonly advancementsCost: number;
  /** Idem `playersCost`, restreint aux joueurs disponibles pour le prochain match. */
  readonly availablePlayersCost: number;
  /**
   * Valeur des joueurs qui ratent le prochain match (`available: false`) :
   * la part de la VE que la VEA laisse de côté.
   */
  readonly unavailablePlayersCost: number;
  /**
   * Coût d'embauche annulé dans la VEA par « Trois-quarts à vil prix »
   * (Ogres, Snotlings). 0 sans la règle.
   *
   * Exposé pour que l'UI puisse JUSTIFIER un écart VE/VEA sur une équipe
   * qui n'a joué aucun match : sans cette ligne, une VEA inférieure à la VE
   * passe pour un bug de calcul.
   */
  readonly cheapLinemenWaived: number;
  /** Cheerleaders + assistants + apothicaire (hors relances, hors fans). */
  readonly staffCost: number;
  /** Relances d'équipe. */
  readonly rerollsCost: number;
  /** VE — Valeur d'Équipe. */
  readonly teamValue: number;
  /** VEA — Valeur d'Équipe Actuelle. */
  readonly currentValue: number;
}

/**
 * Calcule le détail complet VE/VEA en un seul passage.
 *
 * `calculateTeamValue` / `calculateCurrentValue` en sont de simples
 * projections : toute règle de valorisation ne s'écrit qu'ici.
 */
export function calculateTeamValueBreakdown(
  data: TeamValueData,
): TeamValueBreakdown {
  // « Trois-quarts à vil prix » : le coût d'embauche des Trois-quarts compte
  // pour 0 dans la VEA seulement — la VE, elle, reste au tarif plein.
  const cheapLinemen = (data.specialRules ?? []).includes(CHEAP_LINEMEN_RULE);

  let playersCost = 0;
  let playersHireCost = 0;
  let availablePlayersCost = 0;
  let unavailablePlayersCost = 0;
  let cheapLinemenWaived = 0;
  for (const player of data.players) {
    playersCost += player.cost;
    // `hireCost` absent = « aucune augmentation » (cf. `TeamValuePlayer`) :
    // le coût d'embauche vaut alors la valeur totale du joueur.
    playersHireCost += Math.min(player.hireCost ?? player.cost, player.cost);
    if (!player.available) {
      unavailablePlayersCost += player.cost;
      continue;
    }
    const waived =
      cheapLinemen && player.lineman
        ? Math.min(player.hireCost ?? player.cost, player.cost)
        : 0;
    cheapLinemenWaived += waived;
    availablePlayersCost += Math.max(0, player.cost - waived);
  }
  const staffCost = calculateStaffCost(data);
  const rerollsCost = data.rerolls * resolveStaffCosts(data).rerollCost;

  return {
    playersCost,
    playersHireCost,
    advancementsCost: playersCost - playersHireCost,
    availablePlayersCost,
    unavailablePlayersCost,
    cheapLinemenWaived,
    staffCost,
    rerollsCost,
    teamValue: playersCost + staffCost + rerollsCost,
    currentValue: availablePlayersCost + staffCost + rerollsCost,
  };
}

/**
 * Calcule la VE (Valeur d'Équipe) selon les règles Blood Bowl
 * VE = Coût de tous les joueurs engagés + Coût du Staff + Relances
 */
export function calculateTeamValue(data: TeamValueData): number {
  return calculateTeamValueBreakdown(data).teamValue;
}

/**
 * Calcule la VEA (Valeur d'Équipe Actuelle) selon les règles Blood Bowl
 * VEA = Coûts des joueurs disponibles + Coût du Staff + Relances
 */
export function calculateCurrentValue(data: TeamValueData): number {
  return calculateTeamValueBreakdown(data).currentValue;
}

/**
 * Calcule le coût du staff de banc de touche, à partir des coûts résolus
 * (config DB ou défaut format-aware). Pour bb11 sans config explicite, les
 * coûts dérivés valent 10k/10k/50k — identiques à l'historique.
 *
 * Les Fans Dévoués ne comptent NI dans la VE NI dans la VEA : leur achat
 * coûte de la trésorerie mais leur valeur n'entre pas dans la valeur
 * d'équipe.
 */
function calculateStaffCost(data: TeamValueData): number {
  const s = resolveStaffCosts(data);
  let cost = 0;

  cost += data.cheerleaders * s.cheerleaderCost;
  cost += data.assistants * s.assistantCost;
  if (data.apothecary) {
    cost += s.apothecaryCost;
  }

  return cost;
}

/**
 * Calcule les gains après un match selon les règles Blood Bowl
 * Gains = (Fan Attendance / 2 + Touchdowns marqués) × 10,000 po
 */
export function calculateMatchWinnings(
  fanAttendance: number,
  touchdownsScored: number,
  conceded: boolean = false
): number {
  if (conceded) {
    // Si l'équipe a concédé, elle ne gagne rien
    return 0;
  }
  
  const baseWinnings = Math.floor(fanAttendance / 2) + touchdownsScored;
  return baseWinnings * 10000;
}

/**
 * Calcule la trésorerie après un match
 */
export function calculateTreasury(
  currentTreasury: number,
  winnings: number,
  expenses: number = 0
): number {
  return currentTreasury + winnings - expenses;
}

/**
 * Calcule toutes les valeurs d'équipe
 */
export function calculateAllValues(data: TeamValueData): CalculatedValues {
  const breakdown = calculateTeamValueBreakdown(data);
  return {
    teamValue: breakdown.teamValue,
    currentValue: breakdown.currentValue,
    treasury: 0 // La trésorerie sera calculée après chaque match
  };
}

/**
 * Obtient le coût d'un joueur selon sa position et le roster
 */
export function getPlayerCost(
  position: string,
  roster: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): number {
  // Utiliser le nouveau système de slugs
  const positionData = getPositionBySlug(position, ruleset);
  if (positionData) {
    return positionData.cost * 1000; // Convertir de kpo en po
  }

  // Fallback vers l'ancien système pour compatibilité
  const costs: Record<string, Record<string, number>> = {
    skaven: {
      'Lineman': 50000,
      'Thrower': 85000,
      'Blitzer': 90000,
      'Gutter Runner': 85000,
      'Rat Ogre': 150000
    },
    lizardmen: {
      'Skink': 60000,
      'Chaméléon Skink': 70000,
      'Saurus': 85000,
      'Kroxigor': 140000
    },
    amazon: {
      'Linewoman': 50000,
      'Thrower': 80000,
      'Blitzer': 90000,
      'Bloker': 110000
    },
    underworld: {
      'Lineman': 50000,
      'Thrower': 70000,
      'Blitzer': 90000,
      'Mutant Rat Ogre': 150000
    },
    darkelf: {
      'Lineman': 70000,
      'Runner': 80000,
      'Blitzer': 100000,
      'Assassin': 85000,
      'Witch Elf': 110000
    },
    woodelf: {
      'Lineman': 70000,
      'Thrower': 95000,
      'Catcher': 90000,
      'Wardancer': 125000,
      'Treeman': 120000
    },
    chaos: {
      'Lineman': 50000,
      'Beastman': 60000,
      'Chaos Warrior': 100000,
      'Minotaur': 150000
    },
    gnome: {
      'Lineman': 40000,
      'Thrower': 60000,
      'Catcher': 50000,
      'Blitzer': 70000,
      'Treeman': 120000
    },
    goblin: {
      'Lineman': 40000,
      'Bomma': 45000,
      'Pogoer': 80000,
      'Fanatic': 70000,
      'Looney': 40000,
      'Trained Troll': 115000
    },
    halfling: {
      'Lineman': 30000,
      'Catcher': 35000,
      'Treeman': 120000
    },
    highelf: {
      'Lineman': 70000,
      'Thrower': 100000,
      'Catcher': 90000,
      'Blitzer': 100000
    },
    necromantic: {
      'Lineman': 40000,
      'Runner': 75000,
      'Wraith': 95000,
      'Werewolf': 125000,
      'Flesh Golem': 115000
    },
    human: {
      'Lineman': 50000,
      'Thrower': 70000,
      'Catcher': 65000,
      'Blitzer': 85000,
      'Ogre': 140000
    },
    khorne: {
      'Lineman': 50000,
      'Khorngor': 70000,
      'Bloodseeker': 110000,
      'Bloodspawn': 160000
    },
    undead: {
      'Skeleton': 40000,
      'Zombie': 40000,
      'Runner': 75000,
      'Blitzer': 90000,
      'Mummy': 125000
    },
    dwarf: {
      'Lineman': 70000,
      'Runner': 80000,
      'Blitzer': 80000,
      'Longbeard': 90000,
      'Deathroller': 170000
    },
    chaosdwarf: {
      'Lineman': 50000,
      'Blocker': 70000,
      'Blitzer': 130000,
      'Minotaur': 150000
    },
    imperial: {
      'Lineman': 45000,
      'Thrower': 75000,
      'Blitzer': 105000,
      'Bodyguard': 90000,
      'Ogre': 140000
    },
    norse: {
      'Lineman': 50000,
      'Runner': 70000,
      'Blitzer': 90000,
      'Ulfwerener': 105000,
      'Yhetee': 140000
    },
    ogre: {
      'Lineman': 50000,
      'Runt': 30000,
      'Ogre': 140000
    },
    orc: {
      'Lineman': 50000,
      'Thrower': 70000,
      'Blitzer': 80000,
      'Black Orc': 80000,
      'Troll': 110000
    },
    blackorc: {
      'Lineman': 60000,
      'Blitzer': 80000,
      'Troll': 110000
    },
    snotling: {
      'Lineman': 15000,
      'Pump Wagon': 120000,
      'Fungus': 200000
    },
    tombkings: {
      'Lineman': 40000,
      'Thrower': 70000,
      'Blitzer': 90000,
      'Mummy': 125000
    },
    vampire: {
      'Lineman': 40000,
      'Thrall': 40000,
      'Vampire': 110000
    },
    elvenunion: {
      'Lineman': 50000,
      'Thrower': 70000,
      'Catcher': 80000,
      'Blitzer': 100000
    },
    oldworldalliance: {
      'Lineman': 50000,
      'Thrower': 70000,
      'Catcher': 65000,
      'Blitzer': 85000
    },
    nurgle: {
      'Lineman': 50000,
      'Rotter': 40000,
      'Pestigor': 80000,
      'Beast': 140000
    },
    chaosrenegades: {
      'Lineman': 50000,
      'Marauder': 50000,
      'Renegade': 70000,
      'Mutant': 100000
    }
  };

  return costs[roster]?.[position] || 50000; // Coût par défaut
}
