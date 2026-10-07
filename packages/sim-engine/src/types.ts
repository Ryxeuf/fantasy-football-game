/**
 * Public types for @bb/sim-engine.
 *
 * Sprint Pro League — task 0.A.1 (workspace + public interface).
 * The wire-level `MatchEvent` enum + `displayAtMs` channel was promoted
 * to `@bb/shared-types` in task 0.A.3 so that the broadcaster (lot 1.B)
 * and the spectate UI can consume it without pulling the whole engine.
 */

import type { CasualtyOutcome, GameState, Move, TeamId } from '@bb/game-engine';
import type { MatchEvent } from '@bb/shared-types';

import type { CoachMatchReport } from './coach/adaptation';
import type { PlayerMomentum } from './tactics/momentum';
import type { TacticalProfile } from './tactics/tactical-profile';
import type { ReplayJournal } from './replay/journal';

/** Identifies the package version that produced a SimResult. Used for replay
 *  freezing and bench regression baselines (cf. lots 0.D / 1.A.5).
 *
 *  0.30.0 — Lot 4 « évolution persistée » : la forme des joueurs module
 *           l'ordre des actions à dés, le journal fige les profils des deux
 *           coachs, le résultat porte le rapport des drives. Les issues
 *           changent à graine constante dès qu'une forme est fournie.
 *  0.29.0 — Lot 3 « cerveau du coach » : plan de drive collant, activations
 *           entières scorées en espérance, choix selon le plan, corrections
 *           du moteur (ballon sous un joueur au sol, ramassage du porteur,
 *           soutiens sans PM, compteur de rounds après un TD). Le bench CI
 *           mesure désormais le full driver (20 matchs par duel).
 *  0.28.0 — Lot 2 « journal d'actions rejouable » : chaque coup du full
 *  driver reçoit son propre flux de dés (`seed:move:n`), le replay persiste
 *  un journal (état initial + coups + dés) au lieu des snapshots, et les
 *  états se re-dérivent bit à bit. Les issues changent à graine constante.
 *
 *  0.27.0 — Lot 1 « match complet » : remise en jeu après chaque touchdown,
 *  joueurs à terre qui se relèvent (STAND_UP), choix en attente obligatoires
 *  et décidés par l'IA (dé de blocage, poussée, suivi, relance, apothicaire,
 *  remise), évènements de coup d'envoi interactifs, `kickingTeam` posé,
 *  activation contiguë. Les issues de match changent à graine constante.
 *
 *  0.26.0 — le resolver de blocage consomme desormais `BLOCK_DIE_FACES` du
 *  `@bb/game-engine` au lieu de sa propre table, qui placait STUMBLE en 5 et
 *  POW en 6 la ou le moteur place STUMBLE en 4, POW en 5 et le second
 *  PUSH_BACK en 6. A seed constant les issues de match changent donc, d'ou
 *  le re-snapshot de `bench/bench-baseline.json`. */
export const ENGINE_VER = '0.30.0';
export type EngineVersion = string;

/** Match outcome at score level. */
export type MatchOutcome = 'home' | 'away' | 'draw';

export interface MatchScore {
  home: number;
  away: number;
}

/**
 * Minimal description of a team passed to the simulator. The tactical
 * profile (lot 0.B.2) is optional — when omitted, the driver behaves as
 * if the team used `DEFAULT_TACTICAL_PROFILE` (every parameter at 50).
 */
/**
 * Snapshot d'un joueur du roster passé au full driver pour produire
 * des MatchEvent[] roster-aware (Lot 3.A.2.c).
 *
 * Le hybrid driver n'utilise pas ce champ — il génère ses propres
 * `home-LOS` / `away-LOS` synthétiques. Le full driver, lui, mappe
 * cette snapshot vers les `Player` de game-engine pour que les
 * events portent les vrais playerId / playerName.
 */
export interface SimRosterPlayer {
  /** ID stable (ex: cuid Prisma `proTeamRoster.id`). */
  id: string;
  /** Nom complet (lisible par le narrator). */
  name: string;
  /** Numéro du jersey (1-16). */
  number: number;
  /** Poste BB ('Lineman', 'Blitzer', 'Thrower', ...). */
  position: string;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  /** Liste de skills (slugs). */
  skills?: readonly string[];
  /**
   * Lot 4 — forme persistée (0..100, 50 = neutre), lue par le coach pour
   * moduler l'appétit pour le risque du joueur. Absente = neutre.
   */
  form?: number;
}

export interface SimTeamInput {
  id: string;
  name: string;
  side: 'home' | 'away';
  /** Roster id list — actual roster lookup is consumer-side for now. */
  rosterIds?: readonly string[];
  /**
   * Lot 3.A.2.c — snapshot du roster passé au full driver pour
   * piloter le sim avec les vrais joueurs. Optionnel : si absent,
   * le full driver retombe sur `setup()` minimal (~6 joueurs
   * synthétiques) ; si présent, les events MatchEvent[] portent
   * les vrais ids/names du roster.
   */
  roster?: readonly SimRosterPlayer[];
  /** Validated tactical fingerprint — see `tactical-profile.ts` (0.B.2).
   *  Apps/server validates the JSON via `tacticalProfileSchema` before
   *  reaching the sim-engine. */
  tactics?: Readonly<TacticalProfile>;
  /** Team Value (gold pieces). Used by the underdog variance boost
   *  (lot 0.C.3) — the team with the lower TV gets a subtle reroll
   *  bonus on critical failures when the gap exceeds 200. */
  tv?: number;
}

export interface SimInput {
  /** Stable seed for the PRNG (xoroshiro injection arrives in 0.A.4). */
  seed: number;
  home: SimTeamInput;
  away: SimTeamInput;
  /** Optional weather hint ; resolved by game-engine pre-match in 0.A.5. */
  weather?: string;
  /** Free metadata propagated to the result for traceability. */
  meta?: Readonly<Record<string, unknown>>;
}

/** Re-export the wire-level event type so existing consumers keep working
 *  through `@bb/sim-engine`. New code should import from `@bb/shared-types`
 *  directly to break the runtime dependency on the engine bundle. */
export type { MatchEvent, EventType } from '@bb/shared-types';

/**
 * Casualty record persisted post-match (lot 1.E.4 expands it with niggling
 * stacking + stat reductions that survive across seasons).
 */
export interface Casualty {
  playerId: string;
  team: TeamId;
  outcome: CasualtyOutcome;
  causedById?: string;
}

/** High-level match summary. Detailed stats arrive with the bench harness
 *  (lot 0.D.3). */
export interface MatchSummary {
  outcome: MatchOutcome;
  score: MatchScore;
  turnoverCount: number;
  touchdownCount: number;
  /** Eye-of-Nuffle events triggered during the match (lot 0.C.2) —
   *  consume by Nuffle Gazette (1.E.1) for storyline mining. */
  nuffleCount: number;
  /** Times the underdog boost (lot 0.C.3) silently saved a turnover.
   *  Audit metric for the bench harness ; not exposed in the user UI. */
  underdogBoostCount: number;
  durationMs: number;
  /** Per-player momentum snapshots (lot 0.B.4) — alimente la Gazette
   *  (1.E.1) et l'odds calculator (1.D.3). Vide quand aucun joueur n'a
   *  declenche d'event marquant durant le match. */
  momentum: readonly PlayerMomentum[];
}

/**
 * Output contract of `simulateMatch`. Order of fields kept stable to make
 * downstream consumers (broadcaster 1.B, replay storage 1.A.2, bench 0.D)
 * version-tolerant.
 */
export interface SimResult {
  result: MatchOutcome;
  events: readonly MatchEvent[];
  summary: MatchSummary;
  casualties: readonly Casualty[];
  engineVer: EngineVersion;
  /**
   * Lot 3.D.1 — re-jeu visuel pas-à-pas. Quand le driver utilisé est le
   * full driver, on capture la séquence (initialState, states post-move,
   * moves appliqués) pour que le client puisse rendre le terrain Pixi
   * pas-à-pas comme dans `/play`. Vide pour le hybrid driver (synthèse
   * archétype, pas de GameState BB précis).
   *
   * `states[i]` est le `GameState` produit par `applyMove(prev, moves[i],
   * rng)`. `states.length === moves.length` ; `states[states.length - 1]`
   * est l'état final du match. On persiste les states (vs les recalculer
   * côté client) pour éviter d'avoir à exposer le seed RNG et garantir
   * un déterminisme strict (`applyMove` consomme du RNG pour les dés).
   * Tradeoff : payload plus gros mais re-jeu instantané sans dépendance
   * sur le sim-engine côté browser.
   */
  fullReplay?: {
    readonly initialState: GameState;
    readonly moves: readonly Move[];
    readonly states: readonly GameState[];
  };
  /**
   * Lot 2 « journal d'actions rejouable » — la forme PERSISTÉE du re-jeu :
   * état initial (sans log) + coups + dés. `replayJournal` en re-dérive
   * `fullReplay.states` bit à bit. ~4 Ko compressés contre ~2 Mo pour
   * les snapshots. Présent uniquement en full driver.
   */
  journal?: ReplayJournal;
  /**
   * Lot 4 « évolution persistée » — drives joués par chaque coach
   * (stratégie dominante, possession, issue, turnovers). Le serveur s'en
   * sert pour faire évoluer le profil du coach entre deux matchs
   * (`adaptCoachProfile`). Présent uniquement en full driver.
   */
  coachReport?: CoachMatchReport;
}
