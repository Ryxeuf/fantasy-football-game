/**
 * Configuration du mode de règles
 * Permet de basculer entre règles complètes et règles allégées
 */

export type RulesMode = 'full' | 'simplified';

export interface RulesConfig {
  mode: RulesMode;

  // Mécaniques activées
  enableSkills: boolean;          // Compétences des joueurs
  enableWeather: boolean;         // Effets météo
  enableKickoffEvents: boolean;   // Événements de kickoff
  enableInducements: boolean;     // Inducements et prières
  enableTackleZones: boolean;     // Zones de tacle (dodge obligatoire)
  enableGFI: boolean;             // Going For It
  enableAssists: boolean;         // Assists offensifs/défensifs
  enableInjuries: boolean;        // Blessures complètes (KO, casualty, death)
  enableFouls: boolean;           // Fautes
  enablePassing: boolean;         // Passes et handoffs
  enableInterceptions: boolean;   // Interceptions

  // Simplifications
  maxGFI: number;                 // Nombre max de GFI (2 en full, 0 en simplified)
  turnsPerHalf: number;           // Nombre de tours par mi-temps (8 en full)
  rerollsPerTeam: number;         // Nombre de relances par défaut

  // Timer de tour (en secondes, 0 = désactivé)
  turnTimerSeconds: number;
}

/**
 * Règles complètes (Blood Bowl standard)
 */
export const FULL_RULES: RulesConfig = {
  mode: 'full',
  enableSkills: true,
  enableWeather: true,
  enableKickoffEvents: true,
  enableInducements: true,
  enableTackleZones: true,
  enableGFI: true,
  enableAssists: true,
  enableInjuries: true,
  enableFouls: true,
  enablePassing: true,
  enableInterceptions: true,
  maxGFI: 2,
  turnsPerHalf: 8,
  rerollsPerTeam: 3,
  turnTimerSeconds: 120,
};

/**
 * Règles allégées pour les débutants
 * - Pas de compétences (skill effects)
 * - Pas de météo
 * - Pas de kickoff events
 * - Pas d'interceptions
 * - Pas de GFI
 * - Blessures simplifiées (stunned ou KO seulement, pas de mort/casualty)
 * - 6 tours par mi-temps (plus court)
 * - 4 relances par équipe
 */
export const SIMPLIFIED_RULES: RulesConfig = {
  mode: 'simplified',
  enableSkills: false,
  enableWeather: false,
  enableKickoffEvents: false,
  enableInducements: false,
  enableTackleZones: true,         // Garder les TZ (essentiel au gameplay)
  enableGFI: false,
  enableAssists: true,              // Garder les assists (important pour les blocs)
  enableInjuries: false,            // Blessures simplifiées
  enableFouls: false,
  enablePassing: true,              // Garder les passes
  enableInterceptions: false,
  maxGFI: 0,
  turnsPerHalf: 6,
  rerollsPerTeam: 4,
  turnTimerSeconds: 90,
};

/**
 * Retourne la configuration de règles selon le mode
 */
export function getRulesConfig(mode: RulesMode): RulesConfig {
  switch (mode) {
    case 'full': return { ...FULL_RULES };
    case 'simplified': return { ...SIMPLIFIED_RULES };
    default: return { ...FULL_RULES };
  }
}

/**
 * Crée une configuration personnalisée à partir d'un mode de base
 */
export function createCustomRules(base: RulesMode, overrides: Partial<RulesConfig>): RulesConfig {
  return { ...getRulesConfig(base), ...overrides };
}
