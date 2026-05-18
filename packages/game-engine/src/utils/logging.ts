/**
 * Système de logging pour le jeu Blood Bowl
 * Gère la création et l'ajout d'entrées de log, et fournit des helpers
 * pour séparer le `gameLog` du reste du `GameState` (optimisation taille
 * GameState — voir TODO Sprint 22+ tâche O.5).
 */

import { GameState, GameLogEntry, TeamId } from '../core/types';

/**
 * Représentation d'un GameState sans son `gameLog`. Utile pour la
 * sérialisation (broadcasts WebSocket, persistance) afin d'éviter d'envoyer
 * le journal complet du match à chaque mise à jour incrémentale.
 */
export type GameStateWithoutLog = Omit<GameState, 'gameLog'>;

/**
 * FNV-1a 32-bit hash, deterministe et rapide. Utilise pour generer un
 * `id` deterministe pour chaque GameLogEntry a partir de son contenu
 * (audit determinisme replay : avant, `id` utilisait `Date.now()` +
 * `Math.random()` ce qui rendait deux replays identiques non-egaux,
 * cassant tout test `expect(state).toEqual(replay)`).
 */
function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Crée une nouvelle entrée de log
 * @param type - Type de l'entrée de log
 * @param message - Message à logger
 * @param playerId - ID du joueur concerné (optionnel)
 * @param team - Équipe concernée (optionnel)
 * @param details - Détails supplémentaires (optionnel)
 * @returns Une nouvelle entrée de log
 */
export function createLogEntry(
  type: GameLogEntry['type'],
  message: string,
  playerId?: string,
  team?: TeamId,
  details?: Record<string, unknown>
): GameLogEntry {
  // BUG fix audit round 4 : id et timestamp sont desormais derives de
  // maniere deterministe du contenu de l'entree. Avant, `Date.now()` +
  // `Math.random()` cassaient la determinisme du `gameLog` entre deux
  // replays avec la meme seed. Le hash FNV-1a sur le contenu suffit a
  // l'unicite pratique (deux entrees distinctes ont quasi toujours un
  // contenu different). timestamp=0 — UI accepte le perte cosmetique
  // (formatTime affiche epoch mais c'est tolere en mode replay).
  let detailsKey = '';
  if (details !== undefined) {
    try {
      detailsKey = JSON.stringify(details);
    } catch {
      detailsKey = '[unserializable]';
    }
  }
  const seed = `${type}|${message}|${playerId ?? ''}|${team ?? ''}|${detailsKey}`;
  return {
    id: `log-${fnv1a32(seed)}`,
    timestamp: 0,
    type,
    message,
    playerId,
    team,
    details,
  };
}

/**
 * Ajoute une entrée de log à l'état du jeu
 * @param state - État actuel du jeu
 * @param entry - Entrée de log à ajouter
 * @returns Nouvel état du jeu avec l'entrée de log ajoutée
 */
export function addLogEntry(state: GameState, entry: GameLogEntry): GameState {
  return {
    ...state,
    gameLog: [...state.gameLog, entry],
  };
}

/**
 * Retourne une copie du `GameState` sans son `gameLog`.
 * Utilisé pour réduire la taille des payloads WebSocket / persistés
 * lorsque le journal est transmis séparément.
 */
export function stripGameLog(state: GameState): GameStateWithoutLog {
  // Destructuring pour exclure proprement gameLog du nouvel objet.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { gameLog, ...rest } = state;
  return rest;
}

/**
 * Réattache un `gameLog` à un état préalablement strippé.
 * Inverse de {@link stripGameLog}.
 */
export function attachGameLog(
  state: GameStateWithoutLog,
  log: GameLogEntry[],
): GameState {
  return {
    ...state,
    gameLog: log,
  };
}

/**
 * Retourne une copie du `GameState` dont le `gameLog` est tronqué aux
 * `maxEntries` plus récentes. Permet de limiter la taille des broadcasts
 * sans casser les clients qui consomment toujours `state.gameLog`.
 *
 * @throws si `maxEntries` est négatif
 */
export function truncateGameLog(state: GameState, maxEntries: number): GameState {
  if (maxEntries < 0) {
    throw new Error(
      `truncateGameLog: maxEntries must be >= 0 (got ${maxEntries})`,
    );
  }
  if (state.gameLog.length <= maxEntries) {
    return state;
  }
  return {
    ...state,
    gameLog: state.gameLog.slice(state.gameLog.length - maxEntries),
  };
}

/**
 * Retourne les `count` dernières entrées du `gameLog`. Si `count` est
 * supérieur à la taille du log, retourne toutes les entrées. Si `count`
 * vaut 0, retourne un tableau vide.
 *
 * @throws si `count` est négatif
 */
export function getRecentLogEntries(
  state: GameState,
  count: number,
): GameLogEntry[] {
  if (count < 0) {
    throw new Error(
      `getRecentLogEntries: count must be >= 0 (got ${count})`,
    );
  }
  if (count === 0) return [];
  if (state.gameLog.length <= count) return [...state.gameLog];
  return state.gameLog.slice(state.gameLog.length - count);
}
