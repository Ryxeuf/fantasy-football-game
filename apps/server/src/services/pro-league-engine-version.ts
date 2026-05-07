/**
 * Pro League — engine version policy (sprint Pro League lot 1.A.5).
 *
 * Garantit la cohérence entre :
 *  - `ProLeagueSeason.engineVer` : version pinnée à la création de la
 *    saison (lot 1.A.1, set par le service qui crée la saison).
 *  - `ProLeagueMatch.engineVer` : version utilisée au moment de la sim
 *    (lot 1.A.4, écrit par `simulateProMatch`).
 *  - `ENGINE_VER` (sim-engine) : version courante du package.
 *
 * Règles :
 *
 *  1. **Pinning saison** : on ne peut simuler un match d'une saison que
 *     si `season.engineVer === ENGINE_VER`. Si l'engine évolue en
 *     cours de saison, les nouveaux matchs sont bloqués → lever une
 *     `EngineVersionMismatchError`. L'admin doit alors soit créer une
 *     nouvelle saison, soit déployer le pinned engine en production.
 *
 *  2. **Replay read-only** : un Replay produit avec `engineVer = X`
 *     reste read-only pour `ENGINE_VER ≠ X`. Permet de re-jouer le
 *     replay (consommation de payload) mais bloque la re-simulation
 *     (qui produirait un payload différent).
 *
 *  3. **Fallback simulation fail** (spec sprint) : si la sim throw
 *     pour des raisons non liées à la version (bug runtime, OOM...),
 *     l'erreur est propagée mais le match est marqué `failed` ; un
 *     replay "pinned" peut être reconstruit côté admin via
 *     `regenerateReplay` (à implémenter côté admin tools — exposé via
 *     l'interface `simulateProMatch` qui upsert le Replay).
 *
 * Ce service ne fait aucun I/O direct : il opère sur des records DB
 * passés en argument. Le sim-runner (1.A.4) consomme
 * `assertSimulationAllowed` avant chaque sim.
 */

import { ENGINE_VER as CURRENT_ENGINE_VER } from "@bb/sim-engine";

export { CURRENT_ENGINE_VER };

/**
 * Levée quand on tente de simuler / re-simuler un match alors que
 * l'engine courant ne match pas la version pinnée. Le code consommateur
 * doit attraper cette erreur explicitement (ne pas marquer le match
 * `failed` car ce n'est pas une erreur de simulation à proprement parler).
 */
export class EngineVersionMismatchError extends Error {
  readonly code = "ENGINE_VERSION_MISMATCH";
  constructor(
    readonly pinnedVersion: string,
    readonly currentVersion: string,
    readonly context: string,
  ) {
    super(
      `Engine version mismatch (${context}) : pinned='${pinnedVersion}', current='${currentVersion}'. ` +
        `Replay/sim refused to avoid producing inconsistent payloads.`,
    );
    this.name = "EngineVersionMismatchError";
  }
}

export interface SeasonVersionRef {
  readonly id: string;
  readonly engineVer: string;
}

export interface MatchVersionRef {
  /** `null` si le match n'a jamais été simulé (status `scheduled`). */
  readonly engineVer: string | null;
  readonly season: SeasonVersionRef;
}

export interface ReplayVersionRef {
  /** `engineVer` de la version qui a produit ce replay. */
  readonly engineVer: string;
}

/**
 * Vérifie qu'on peut simuler ce match avec l'engine courant.
 * - Si `season.engineVer ≠ ENGINE_VER` : refuse (saison pinnée à une
 *   autre version, on ne peut pas garantir la cohérence du replay).
 * - Si `match.engineVer ≠ null` ET `≠ ENGINE_VER` : refuse aussi
 *   (re-simulation avec une autre version produirait un replay
 *   incohérent avec l'engineVer stocké).
 *
 * Utilisé par `simulateProMatch` (sim-runner 1.A.4) avant chaque sim.
 */
export function assertSimulationAllowed(match: MatchVersionRef): void {
  if (match.season.engineVer !== CURRENT_ENGINE_VER) {
    throw new EngineVersionMismatchError(
      match.season.engineVer,
      CURRENT_ENGINE_VER,
      `season ${match.season.id}`,
    );
  }
  if (match.engineVer !== null && match.engineVer !== CURRENT_ENGINE_VER) {
    throw new EngineVersionMismatchError(
      match.engineVer,
      CURRENT_ENGINE_VER,
      `match (already simulated with a different engine)`,
    );
  }
}

/**
 * Vrai si le replay est en mode read-only pour l'engine courant.
 * Le payload reste consommable (broadcaster pour spectate / replay UI)
 * mais on ne doit pas tenter de le re-simuler. Tout flux qui veut
 * "rebuild" un replay doit d'abord vérifier ce flag.
 */
export function isReplayReadOnly(replay: ReplayVersionRef): boolean {
  return replay.engineVer !== CURRENT_ENGINE_VER;
}

/**
 * Helper pour les routes admin qui exposent l'état de versioning d'un
 * match : renvoie un descripteur lisible avec le statut versioning.
 */
export interface VersionStatus {
  readonly currentEngine: string;
  readonly pinnedSeasonEngine: string;
  readonly matchEngine: string | null;
  readonly canSimulate: boolean;
  readonly isReplayReadOnly: boolean;
}

export function describeVersionStatus(match: MatchVersionRef): VersionStatus {
  let canSimulate = true;
  try {
    assertSimulationAllowed(match);
  } catch (err) {
    if (err instanceof EngineVersionMismatchError) {
      canSimulate = false;
    } else {
      throw err;
    }
  }
  return {
    currentEngine: CURRENT_ENGINE_VER,
    pinnedSeasonEngine: match.season.engineVer,
    matchEngine: match.engineVer,
    canSimulate,
    isReplayReadOnly:
      match.engineVer !== null && match.engineVer !== CURRENT_ENGINE_VER,
  };
}
