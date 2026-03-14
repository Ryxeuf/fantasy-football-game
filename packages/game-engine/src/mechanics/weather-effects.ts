/**
 * Effets mécaniques de la météo sur le gameplay
 * Raccorde les conditions météo aux modificateurs de dés et restrictions de jeu
 */

import { GameState, RNG } from '../core/types';
import { WeatherCondition } from '../core/weather-types';

/**
 * Modificateurs météo applicables aux différentes mécaniques
 */
export interface WeatherModifiers {
  passingModifier: number;       // Modif sur jets de passe (PA)
  agilityModifier: number;       // Modif sur jets d'agilité (catch, pickup)
  gfiModifier: number;           // Modif sur jets GFI (Rush)
  maxPassRange: 'quick' | 'short' | 'long' | 'bomb' | null; // Restriction de portée de passe
  playersToReserves: number;     // D3 joueurs à placer en réserves (0 = pas d'effet)
}

const DEFAULT_MODIFIERS: WeatherModifiers = {
  passingModifier: 0,
  agilityModifier: 0,
  gfiModifier: 0,
  maxPassRange: null,
  playersToReserves: 0,
};

/**
 * Détermine les modificateurs météo à partir d'une condition
 */
export function getWeatherModifiers(condition: WeatherCondition | undefined): WeatherModifiers {
  if (!condition) return { ...DEFAULT_MODIFIERS };

  const c = condition.condition.toLowerCase();

  // --- Conditions de passe ---
  if (c.includes('très ensoleillé') || c.includes('bourrasque') || c.includes('brouillard') ||
      c.includes('tempête de feuilles') || c.includes('vent violent') || c.includes('vent à décorner') ||
      c.includes('ambiance lugubre') || c.includes('nuée d\'insectes') || c.includes('attaque de moustiques') ||
      c.includes('tempête de sable') || c.includes('mirage')) {
    return { ...DEFAULT_MODIFIERS, passingModifier: -1 };
  }

  // --- Conditions d'agilité ---
  if (c.includes('verglas') || c.includes('givre') || c.includes('pluie verglaçante') ||
      c.includes('averse') || c.includes('giboulée') || c.includes('éboulement') ||
      c.includes('attaque des arbres') || c.includes('tempête de neige') || c.includes('avalanche') ||
      c.includes('tempête') || c.includes('pluie radioactive')) {
    return { ...DEFAULT_MODIFIERS, agilityModifier: -1 };
  }

  // --- Pluie battante (agilité catch/pickup seulement) ---
  if (c.includes('pluie battante') || c.includes('pluie fine') || c.includes('pluie torrentielle')) {
    return { ...DEFAULT_MODIFIERS, agilityModifier: -1 };
  }

  // --- Neige forte (agilité + mouvement) ---
  if (c.includes('neige forte') || c.includes('froid glacial')) {
    return { ...DEFAULT_MODIFIERS, agilityModifier: -1, gfiModifier: -1 };
  }

  // --- Blizzard (GFI -1 + restriction de passe) ---
  if (c.includes('blizzard') || c.includes('tempête de glace')) {
    return {
      ...DEFAULT_MODIFIERS,
      gfiModifier: -1,
      maxPassRange: 'short',
    };
  }

  // --- Chaleur écrasante / Canicule (joueurs en réserves) ---
  if (c.includes('chaleur écrasante') || c.includes('canicule') || c.includes('sécheresse')) {
    return { ...DEFAULT_MODIFIERS, playersToReserves: 1 }; // D3 géré à l'appel
  }

  // --- Catastrophes (joueurs en réserves) ---
  if (c.includes('affaissement') || c.includes('gaz toxiques') || c.includes('raz-de-marée') ||
      c.includes('le cri des banshees') || c.includes('marais toxique') || c.includes('désolation') ||
      c.includes('âmes errantes') || c.includes('pluie de scorpions')) {
    return { ...DEFAULT_MODIFIERS, playersToReserves: 1 };
  }

  // --- Conditions parfaites ---
  return { ...DEFAULT_MODIFIERS };
}

/**
 * Applique les effets météo de début de drive (joueurs en réserves)
 */
export function applyWeatherDriveEffects(
  state: GameState,
  weatherModifiers: WeatherModifiers,
  rng: RNG
): GameState {
  if (weatherModifiers.playersToReserves <= 0) return state;

  // D3 joueurs aléatoires de chaque équipe en réserves
  const d3 = Math.floor(rng() * 3) + 1;
  let newState = { ...state, players: [...state.players] };

  for (const team of ['A', 'B'] as const) {
    const activePlayers = newState.players.filter(
      p => p.team === team && !p.stunned && p.state === 'active'
    );
    const toReserve = Math.min(d3, activePlayers.length);

    // Choisir aléatoirement
    const shuffled = [...activePlayers].sort(() => rng() - 0.5);
    for (let i = 0; i < toReserve; i++) {
      const player = shuffled[i];
      const idx = newState.players.findIndex(p => p.id === player.id);
      if (idx !== -1) {
        // Déplacer le joueur hors du terrain (sera en réserves au prochain setup)
        newState.players[idx] = {
          ...newState.players[idx],
          pos: { x: -1, y: -1 },
        };
      }
    }
  }

  return newState;
}

/**
 * Vérifie si une portée de passe est autorisée par la météo
 */
export function isPassRangeAllowed(
  range: 'quick' | 'short' | 'long' | 'bomb',
  weatherModifiers: WeatherModifiers
): boolean {
  if (!weatherModifiers.maxPassRange) return true;

  const rangeOrder = ['quick', 'short', 'long', 'bomb'];
  const maxIdx = rangeOrder.indexOf(weatherModifiers.maxPassRange);
  const currentIdx = rangeOrder.indexOf(range);

  return currentIdx <= maxIdx;
}
