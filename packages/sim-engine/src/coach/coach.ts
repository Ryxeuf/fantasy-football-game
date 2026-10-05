/**
 * Lot 3 « cerveau du coach » — ORCHESTRATEUR.
 *
 * Un coach par match (deux équipes) qui, à chaque pas du driver, rend le
 * prochain coup :
 *  1. un CHOIX en attente (dé de blocage, poussée, suivi, relance,
 *     apothicaire, remise) est résolu — la relance selon le plan, le reste
 *     par l'évaluateur du moteur ;
 *  2. une activation en cours continue (chaque coup est revérifié contre les
 *     coups légaux : un échec en route ferme l'activation) ;
 *  3. sinon le plan de drive est (re)choisi si besoin, les activations
 *     candidates sont générées, ordonnées par classe de risque (actions sans
 *     dés d'abord), puis tirées par softmax sur les meilleures — température
 *     du profil, du momentum et du score ;
 *  4. aucune activation utile ⇒ `END_TURN`.
 *
 * Le RNG du coach (`${seed}:ai`) est distinct des flux de dés des coups : le
 * journal reste rejouable sans lui.
 */

import { getLegalMoves, makeRNG, pickBestMove } from '@bb/game-engine';
import type { EvalWeights, GameState, Move, Position, RNG, TeamId } from '@bb/game-engine';

import { weightsFromProfile } from '../tactics/ai-weights';
import {
  applyDecay,
  confidenceBoostFor,
  createMomentumTracker,
  recordBlock,
  recordFailure,
  recordTouchdown,
  type MomentumTracker,
  type PlayerMomentum,
} from '../tactics/momentum';
import { DEFAULT_TACTICAL_PROFILE, type TacticalProfile } from '../tactics/tactical-profile';
import { riskAppetiteToTemperature, softmaxSample } from '../tactics/temperature';

import { carrierIntent, planActivations, wantsTeamReroll, type ActivationCandidate } from './activation-planner';
import type { CoachMatchReport, DriveOutcome, DriveRecord } from './adaptation';
import { choosePlan, shouldReplan, type CoachStrategyId, type DrivePlan } from './drive-plan';
import { personalityFor } from './personality';

export interface CoachTeamInput {
  readonly profile?: TacticalProfile;
  /**
   * Lot 4 — forme persistée des joueurs (0..100, 50 = neutre), par id.
   * Un joueur en méforme voit ses actions risquées repoussées dans
   * l'ordre du tour ; un joueur en forme les tente plus volontiers.
   */
  readonly forms?: Readonly<Record<string, number>>;
}

export interface CoachTrace {
  readonly state: GameState;
  readonly team: TeamId;
  readonly plan: DrivePlan;
  readonly chosen: ActivationCandidate;
  readonly candidates: readonly ActivationCandidate[];
  readonly planningMs: number;
}

export interface CoachOptions {
  readonly seed: number;
  readonly home: CoachTeamInput;
  readonly away: CoachTeamInput;
  /** Diagnostic : appelé à chaque activation démarrée. */
  readonly trace?: (t: CoachTrace) => void;
}

export interface CoachDecision {
  readonly move: Move;
  /** Candidat retenu quand une nouvelle activation démarre. */
  readonly activation?: ActivationCandidate;
}

export interface Coach {
  nextMove(state: GameState): Move | null;
  /** À appeler après chaque coup appliqué par le driver (momentum, file). */
  onApplied(prev: GameState, move: Move, next: GameState): void;
  planFor(team: TeamId): DrivePlan | null;
  momentumSnapshot(): readonly PlayerMomentum[];
  /** Lot 4 — drives joués par chaque équipe, pour l'adaptation d'après-match. */
  report(): CoachMatchReport;
}

/** Drive en cours d'une équipe (lot 4) : tours par stratégie, turnovers, possession. */
interface OpenDrive {
  half: number;
  turns: number;
  turnovers: number;
  possessionTurns: number;
  strategyTurns: Map<CoachStrategyId, number>;
  /** L'équipe a-t-elle tenu le ballon pendant le tour en cours ? */
  hadBallThisTurn: boolean;
}

function newDrive(half: number): OpenDrive {
  return { half, turns: 0, turnovers: 0, possessionTurns: 0, strategyTurns: new Map(), hadBallThisTurn: false };
}

function dominantStrategy(drive: OpenDrive): CoachStrategyId {
  let best: CoachStrategyId = 'cage-build';
  let bestTurns = -1;
  for (const [strategy, turns] of drive.strategyTurns) {
    if (turns > bestTurns) {
      best = strategy;
      bestTurns = turns;
    }
  }
  return best;
}

interface TeamState {
  readonly profile: TacticalProfile;
  readonly weights: Partial<EvalWeights>;
  plan: DrivePlan | null;
  queue: Move[];
  activePlayerId: string | null;
  /** Case visée par le porteur, figée pour le tour (`half:turn`). */
  carrierTarget: { key: string; pos: Position | undefined } | null;
  readonly forms: Readonly<Record<string, number>>;
  drive: OpenDrive;
}

const PENDING_KEYS = [
  'pendingBlock',
  'pendingPushChoice',
  'pendingFollowUpChoice',
  'pendingReroll',
  'pendingApothecary',
  'pendingDumpOff',
  'pendingOnTheBall',
  'pendingFrenzyBlock',
] as const;

function hasPending(state: GameState): boolean {
  const s = state as unknown as Record<string, unknown>;
  return PENDING_KEYS.some((k) => s[k] !== undefined && s[k] !== null);
}

function sameMove(a: Move, b: Move): boolean {
  if (a.type !== b.type) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  for (const k of ['playerId', 'targetId']) if (ra[k] !== rb[k]) return false;
  const ta = ra.to as { x: number; y: number } | undefined;
  const tb = rb.to as { x: number; y: number } | undefined;
  if (!!ta !== !!tb) return false;
  if (ta && tb && (ta.x !== tb.x || ta.y !== tb.y)) return false;
  return true;
}

/** Joueurs qu'un coup légal de début d'activation concerne. */
function eligiblePlayers(legal: readonly Move[]): Set<string> {
  const set = new Set<string>();
  for (const m of legal) {
    if ('playerId' in m && typeof m.playerId === 'string' && m.type !== 'END_PLAYER_TURN') set.add(m.playerId);
  }
  return set;
}

/**
 * Poids d'ordonnancement : l'ordre canonique d'un tour de BB (actions sans
 * dés, puis blocages à deux dés, blitz, ballon, esquives) est quasi strict —
 * une action risquée ne passe avant une action sûre que si elle rapporte
 * BEAUCOUP plus, sinon un turnover précoce prive le porteur de son
 * déplacement.
 */
function orderPenalty(riskClass: number, profile: TacticalProfile): number {
  return riskClass * (15 + profile.patience / 5);
}

/**
 * Lot 4 — la forme module l'appétit pour le risque d'un joueur : en méforme
 * (< 35) ses actions à dés reculent dans l'ordre du tour, en forme (> 65)
 * elles avancent un peu. Neutre entre les deux.
 */
export function formPenalty(riskClass: number, form: number | undefined): number {
  if (form === undefined || riskClass === 0) return 0;
  if (form < 35) return riskClass * ((35 - form) / 35) * 8;
  if (form > 65) return -riskClass * ((form - 65) / 35) * 4;
  return 0;
}

export function createCoach(options: CoachOptions): Coach {
  const rng: RNG = makeRNG(`${options.seed}:ai`);
  const momentum: MomentumTracker = createMomentumTracker();
  const teams: Record<TeamId, TeamState> = {
    A: makeTeam(options.home),
    B: makeTeam(options.away),
  };
  const drives: DriveRecord[] = [];

  function makeTeam(input: CoachTeamInput): TeamState {
    const p = input.profile ?? DEFAULT_TACTICAL_PROFILE;
    return {
      profile: p,
      weights: weightsFromProfile(p),
      plan: null,
      queue: [],
      activePlayerId: null,
      carrierTarget: null,
      forms: input.forms ?? {},
      drive: newDrive(1),
    };
  }

  function closeDrive(team: TeamId, outcome: DriveOutcome, nextHalf: number): void {
    const t = teams[team];
    const d = t.drive;
    if (d.turns > 0) {
      drives.push({
        team,
        half: d.half,
        strategy: dominantStrategy(d),
        possession: d.possessionTurns * 2 >= d.turns,
        outcome,
        turnovers: d.turnovers,
        turns: d.turns,
      });
    }
    t.drive = newDrive(nextHalf);
  }

  /** Fin du tour de `team` : un tour de plus au drive, sous la stratégie du plan. */
  function recordTurn(team: TeamId): void {
    const t = teams[team];
    const d = t.drive;
    d.turns += 1;
    if (d.hadBallThisTurn) d.possessionTurns += 1;
    d.hadBallThisTurn = false;
    const strategy = t.plan?.strategy ?? 'cage-build';
    d.strategyTurns.set(strategy, (d.strategyTurns.get(strategy) ?? 0) + 1);
  }

  function ensurePlan(state: GameState, team: TeamId): DrivePlan {
    const t = teams[team];
    if (!t.plan || shouldReplan(t.plan, state, team)) {
      t.plan = choosePlan(state, team, t.profile, rng);
    }
    return t.plan;
  }

  function resolveChoice(state: GameState, team: TeamId, legal: readonly Move[]): Move | null {
    const t = teams[team];
    const reroll = legal.filter((m) => m.type === 'REROLL_CHOOSE');
    if (reroll.length > 0) {
      const plan = ensurePlan(state, team);
      const use = wantsTeamReroll(state, team, plan);
      return reroll.find((m) => m.type === 'REROLL_CHOOSE' && m.useReroll === use) ?? reroll[0];
    }
    return pickBestMove(state, team, t.weights) ?? legal[0] ?? null;
  }

  function temperatureFor(state: GameState, team: TeamId, playerId: string): number {
    const t = teams[team];
    let temp = riskAppetiteToTemperature(t.profile.riskAppetite);
    const boost = confidenceBoostFor(momentum.get(playerId).state);
    temp *= 1 + boost * 0.25;
    const own = team === 'A' ? state.score.teamA : state.score.teamB;
    const opp = team === 'A' ? state.score.teamB : state.score.teamA;
    if (own < opp && state.turn >= 6) temp *= 1.4;
    if (state.turn >= 7) temp *= 1 - (personalityFor(playerId).clutch - 50) / 200;
    const form = t.forms[playerId];
    if (form !== undefined) temp *= form < 35 ? 0.85 : form > 65 ? 1.1 : 1;
    // Les EV sont de l'ordre de la dizaine : la température est mise à l'échelle.
    return Math.max(0, temp * 10);
  }

  function startActivation(state: GameState, team: TeamId, legal: readonly Move[]): Move | null {
    const t = teams[team];
    const plan = ensurePlan(state, team);
    const t0 = performance.now();
    const eligible = eligiblePlayers(legal);
    const maxGfi = t.profile.gfiTolerance >= 60 ? 2 : t.profile.gfiTolerance >= 25 ? 1 : 0;
    // La cage se forme là où le porteur VA : sa destination est décidée une
    // fois par tour, avant les activations de ses coéquipiers.
    const turnKey = `${state.half}:${state.turn}`;
    if (!t.carrierTarget || t.carrierTarget.key !== turnKey) {
      t.carrierTarget = { key: turnKey, pos: carrierIntent({ state, team, plan, eligible, maxGfi }) };
    }
    const candidates = planActivations({
      state,
      team,
      plan,
      eligible,
      maxGfi,
      carrierTarget: t.carrierTarget.pos,
    }).filter((c) => c.ev > 0);
    if (candidates.length === 0) return null;
    const scored = candidates
      .map((c) => ({
        value: c,
        score: c.ev - orderPenalty(c.riskClass, t.profile) - formPenalty(c.riskClass, t.forms[c.playerId]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    const chosen = softmaxSample({ next: () => rng() }, scored, temperatureFor(state, team, scored[0].value.playerId));
    options.trace?.({ state, team, plan, chosen, candidates, planningMs: performance.now() - t0 });
    t.queue = [...chosen.moves];
    t.activePlayerId = chosen.playerId;
    const first = t.queue.shift() as Move;
    if (!legal.some((m) => sameMove(m, first))) {
      // Le planificateur a proposé un coup que le moteur n'offre pas : on
      // retombe sur le meilleur coup légal du joueur, sans file.
      t.queue = [];
      t.activePlayerId = null;
      return null;
    }
    return first;
  }

  return {
    nextMove(state: GameState): Move | null {
      if (state.gamePhase !== 'playing') return { type: 'END_TURN' };
      const team = state.currentPlayer;
      const t = teams[team];
      const legal = getLegalMoves(state);
      if (legal.length === 0) return null;
      if (hasPending(state)) return resolveChoice(state, team, legal);

      // Activation en cours : le prochain coup de la file s'il est légal.
      while (t.queue.length > 0) {
        const next = t.queue.shift() as Move;
        if (legal.some((m) => sameMove(m, next))) return next;
        // La séquence a dévié (jet raté, poussée, cible déplacée) : on clôt.
        t.queue = [];
        const close = legal.find((m) => m.type === 'END_PLAYER_TURN' && m.playerId === t.activePlayerId);
        t.activePlayerId = null;
        if (close) return close;
      }
      // Activation ouverte sans file (coup refusé plus tôt) : la fermer.
      const open = legal.find((m) => m.type === 'END_PLAYER_TURN');
      if (open && legal.every((m) => m.type === 'END_PLAYER_TURN' || m.type === 'END_TURN' || ('playerId' in m && m.playerId === open.playerId))) {
        // Seul ce joueur peut agir : son activation est ouverte. On tente
        // de la prolonger par une activation planifiée pour lui seul.
        const started = startActivation(state, team, legal);
        if (started) return started;
        return open;
      }

      const started = startActivation(state, team, legal);
      if (started) return started;
      if (state.isTurnover) return { type: 'END_TURN' };
      return legal.find((m) => m.type === 'END_TURN') ?? legal[0];
    },

    onApplied(prev: GameState, move: Move, next: GameState): void {
      const team = prev.currentPlayer;
      const t = teams[team];
      // Lot 4 — suivi des drives : possession, tours, turnovers, issue.
      if (prev.players.some((p) => p.team === team && p.hasBall)) t.drive.hadBallThisTurn = true;
      if (next.isTurnover && !prev.isTurnover) t.drive.turnovers += 1;
      const turnEnded = next.currentPlayer !== prev.currentPlayer || next.turn !== prev.turn || next.half !== prev.half;
      const scored = next.score.teamA + next.score.teamB > prev.score.teamA + prev.score.teamB;
      const ended = next.gamePhase !== 'playing' && prev.gamePhase === 'playing';
      if (turnEnded || scored || ended) recordTurn(team);
      if (scored) {
        const scorer: TeamId = next.score.teamA > prev.score.teamA ? 'A' : 'B';
        closeDrive(scorer, 'td', next.half);
        closeDrive(scorer === 'A' ? 'B' : 'A', 'conceded', next.half);
      } else if (next.half !== prev.half || ended) {
        closeDrive('A', 'half-end', next.half);
        closeDrive('B', 'half-end', next.half);
      }
      if (next.currentPlayer !== prev.currentPlayer || next.gamePhase !== 'playing') {
        t.queue = [];
        t.activePlayerId = null;
      }
      if (next.half !== prev.half) {
        applyDecay(momentum);
        teams.A.plan = null;
        teams.B.plan = null;
      }
      // Momentum : blocages, touchdowns, échecs.
      if ((move.type === 'BLOCK' || move.type === 'BLITZ') && 'targetId' in move) {
        const before = prev.players.find((p) => p.id === move.targetId);
        const after = next.players.find((p) => p.id === move.targetId);
        if (before && after && !before.stunned && (after.stunned || after.state !== before.state)) {
          recordBlock(momentum, move.playerId, { success: true });
        } else if (next.isTurnover && !prev.isTurnover) {
          recordBlock(momentum, move.playerId, { success: false });
        }
      } else if (next.isTurnover && !prev.isTurnover && 'playerId' in move && typeof move.playerId === 'string') {
        recordFailure(momentum, move.playerId);
      }
      if (next.score.teamA + next.score.teamB > prev.score.teamA + prev.score.teamB) {
        const scorer = prev.players.find((p) => p.hasBall);
        if (scorer) recordTouchdown(momentum, scorer.id);
        t.queue = [];
        t.activePlayerId = null;
      }
      if (next.isTurnover && !prev.isTurnover) {
        t.queue = [];
        t.activePlayerId = null;
      }
    },

    planFor(team: TeamId): DrivePlan | null {
      return teams[team].plan;
    },

    momentumSnapshot(): readonly PlayerMomentum[] {
      return momentum.snapshot();
    },

    report(): CoachMatchReport {
      // Les drives encore ouverts (match arrêté par le driver) comptent
      // comme terminés sans score.
      const open: DriveRecord[] = [];
      for (const team of ['A', 'B'] as const) {
        const d = teams[team].drive;
        if (d.turns > 0) {
          open.push({
            team,
            half: d.half,
            strategy: dominantStrategy(d),
            possession: d.possessionTurns * 2 >= d.turns,
            outcome: 'half-end',
            turnovers: d.turnovers,
            turns: d.turns,
          });
        }
      }
      return { drives: [...drives, ...open] };
    },
  };
}
