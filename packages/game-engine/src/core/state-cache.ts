/**
 * Sprint Perf (audit 2026-05-19 §11-12) — caches WeakMap pour eliminer
 * la duplication des scans `state.players.filter/find` dans les hot
 * paths IA (`evaluator.ts` × `pickBestMove`) et les helpers de regles
 * (`legal-moves.ts`).
 *
 * Le moteur cree un nouvel array `players` a chaque mutation
 * immutable (cf. patterns du repo : `state.players.map(...)`). On
 * peut donc indexer les caches par la reference de l'array, qui est
 * stable tant que le state ne change pas. Une WeakMap permet au GC
 * de liberer les entrees lorsqu'un state intermediaire est mis au
 * rebut.
 *
 * Tous les accesseurs sont **purs** et **lazy** : le calcul n'a lieu
 * qu'a la premiere requete d'un champ donne, puis le resultat est
 * memoise. Les entrees deja chaudes n'ajoutent qu'un lookup WeakMap +
 * lecture de propriete (≈ Map.get).
 *
 * Invariant : les valeurs retournees sont des copies defensives (les
 * arrays sont nouveaux a chaque init mais on retourne la meme ref a
 * chaque hit). Les callers ne doivent **pas** muter les arrays
 * retournes — c'est une convention « readonly » non type-checked
 * pour preserver l'API existante.
 */

import type { GameState, Player, TeamId } from './types';

interface PlayersCacheEntry {
  playerById?: Map<string, Player>;
  teamPlayers?: { readonly A: readonly Player[]; readonly B: readonly Player[] };
  activeTeamPlayers?: { readonly A: readonly Player[]; readonly B: readonly Player[] };
  // `null` = scan effectue, aucun porteur ; `undefined` = scan non
  // effectue. Permet de cacher l'absence de porteur (cas frequent en
  // debut/fin de drive) sans re-scan.
  ballCarrier?: Player | null;
}

const cache: WeakMap<readonly Player[], PlayersCacheEntry> = new WeakMap();

function getOrCreateEntry(players: readonly Player[]): PlayersCacheEntry {
  let entry = cache.get(players);
  if (!entry) {
    entry = {};
    cache.set(players, entry);
  }
  return entry;
}

/**
 * `isActive` cf. evaluator.ts — joueur non sonne, non KO, non
 * blesse, non expulse. Copie locale pour eviter une dep circulaire
 * core <- ai.
 */
function isActivePlayer(player: Player): boolean {
  return (
    !player.stunned &&
    player.state !== 'casualty' &&
    player.state !== 'knocked_out' &&
    player.state !== 'sent_off'
  );
}

/**
 * Map id -> Player pour O(1) lookup. Remplace les `state.players.find(p => p.id === id)`
 * qui sont O(n) — pour les hot paths qui en font plusieurs par scoring.
 */
export function getPlayerMap(state: GameState): Map<string, Player> {
  const entry = getOrCreateEntry(state.players);
  if (!entry.playerById) {
    const map = new Map<string, Player>();
    for (const p of state.players) {
      map.set(p.id, p);
    }
    entry.playerById = map;
  }
  return entry.playerById;
}

/**
 * Lookup O(1) d'un joueur par id. Drop-in pour
 * `state.players.find(p => p.id === playerId)`.
 */
export function findPlayerById(state: GameState, playerId: string): Player | undefined {
  return getPlayerMap(state).get(playerId);
}

/**
 * Joueurs d'une equipe (tous les etats confondus). Lazy : ne calcule
 * que lorsqu'au moins une equipe est demandee, et calcule les deux
 * cotes en un seul scan.
 */
export function getTeamPlayers(state: GameState, team: TeamId): readonly Player[] {
  const entry = getOrCreateEntry(state.players);
  if (!entry.teamPlayers) {
    const a: Player[] = [];
    const b: Player[] = [];
    for (const p of state.players) {
      if (p.team === 'A') a.push(p);
      else if (p.team === 'B') b.push(p);
    }
    entry.teamPlayers = { A: a, B: b };
  }
  return entry.teamPlayers[team];
}

/**
 * Joueurs actifs d'une equipe (sur le terrain et capables d'agir).
 * Filtre commun reapplique 30+ fois dans le scoring IA — pre-calcule
 * une fois pour les deux equipes.
 */
export function getActiveTeamPlayers(state: GameState, team: TeamId): readonly Player[] {
  const entry = getOrCreateEntry(state.players);
  if (!entry.activeTeamPlayers) {
    const a: Player[] = [];
    const b: Player[] = [];
    for (const p of state.players) {
      if (!isActivePlayer(p)) continue;
      if (p.team === 'A') a.push(p);
      else if (p.team === 'B') b.push(p);
    }
    entry.activeTeamPlayers = { A: a, B: b };
  }
  return entry.activeTeamPlayers[team];
}

/**
 * Porteur du ballon courant. Cache l'absence (null) aussi pour eviter
 * de re-scanner quand la balle est libre.
 */
export function getBallCarrier(state: GameState): Player | undefined {
  const entry = getOrCreateEntry(state.players);
  if (entry.ballCarrier === undefined) {
    const found = state.players.find(p => p.hasBall);
    entry.ballCarrier = found ?? null;
  }
  return entry.ballCarrier ?? undefined;
}

/**
 * Helper exporte pour les tests : invalide une entree de cache. Pas
 * d'usage prod (le GC libere automatiquement les entrees mortes).
 */
export function __resetStateCache(state: GameState): void {
  cache.delete(state.players);
}
