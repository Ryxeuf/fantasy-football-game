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
  'rerollCost' | 'cheerleaderCost' | 'assistantCost' | 'apothecaryCost' | 'dedicatedFanCost'
>;

export interface TeamValueData {
  players: Array<{
    cost: number;
    available: boolean; // true si le joueur est disponible pour le prochain match
  }>;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number; // Ajout des fans dévoués
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
 * Calcule la VE (Valeur d'Équipe) selon les règles Blood Bowl
 * VE = Coût de tous les joueurs engagés + Coût du Staff + Relances
 */
export function calculateTeamValue(data: TeamValueData): number {
  const playersCost = data.players.reduce((total, player) => total + player.cost, 0);
  const staffCost = calculateStaffCost(data);
  const rerollsCost = data.rerolls * resolveStaffCosts(data).rerollCost;

  return playersCost + staffCost + rerollsCost;
}

/**
 * Calcule la VEA (Valeur d'Équipe Actuelle) selon les règles Blood Bowl
 * VEA = Coûts des joueurs disponibles + Coût du Staff + Relances
 */
export function calculateCurrentValue(data: TeamValueData): number {
  const availablePlayersCost = data.players
    .filter(player => player.available)
    .reduce((total, player) => total + player.cost, 0);
  const staffCost = calculateStaffCost(data);
  const rerollsCost = data.rerolls * resolveStaffCosts(data).rerollCost;

  return availablePlayersCost + staffCost + rerollsCost;
}

/**
 * Calcule le coût du staff de banc de touche, à partir des coûts résolus
 * (config DB ou défaut format-aware). Pour bb11 sans config explicite, les
 * coûts dérivés valent 10k/10k/50k/10k — identiques à l'historique.
 */
function calculateStaffCost(data: TeamValueData): number {
  const s = resolveStaffCosts(data);
  let cost = 0;

  cost += data.cheerleaders * s.cheerleaderCost;
  cost += data.assistants * s.assistantCost;
  if (data.apothecary) {
    cost += s.apothecaryCost;
  }

  // Fans Dévoués : payants au-dessus du premier (gratuit).
  // Clamp : si `dedicatedFans` = 0 (équipe nouvelle pas encore loggée),
  // (0 - 1) * coût = négatif → total négatif. Math.max(0) protège.
  cost += Math.max(0, data.dedicatedFans - 1) * s.dedicatedFanCost;

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
  return {
    teamValue: calculateTeamValue(data),
    currentValue: calculateCurrentValue(data),
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
