/**
 * Hybrid driver — sprint Pro League 0.A.2.
 *
 * Implements the high-level match loop documented in the sprint :
 *   kickoff → drive → resolution turn-by-turn of key moments (block,
 *   dodge, pass, turnover) → halftime → second half → end.
 *
 * Why hybrid
 * ----------
 * A full BB simulation (every player movement, every TZ check, every
 * push direction) is overkill for a 16-team round-robin sim that runs
 * 120 matches per season. We model drives at the **yards** level
 * (probabilistic advancement) and only call into the BB rules
 * resolvers (lot 0.A.5) for "key moments" : passes, blocks, dodges
 * that meaningfully shape the drive narrative.
 *
 * The driver is intentionally stateless from the outside : it consumes
 * a `SimInput`, returns a `SimResult`, and performs no I/O. A future
 * "full" driver can be slotted in behind the same interface (sprint
 * note: "garde la possibilite de basculer en `full` driver plus tard
 * sans casser les events").
 */

import type { MatchEvent } from '@bb/shared-types';

import { createRng, type Rng } from '../rng/seeded';
import {
  resolveBlock,
  resolveDodge,
  resolvePass,
  resolvePickup,
  resolveGfi,
  resolveFoul,
  type ResolverPlayer,
  type ResolverState,
} from '../resolvers';
import {
  ENGINE_VER,
  type Casualty,
  type MatchOutcome,
  type MatchScore,
  type MatchSummary,
  type SimInput,
  type SimResult,
} from '../types';

const TURNS_PER_HALF = 8;
const FIELD_YARDS = 26;
const MS_PER_TURN = 30_000;
const MS_HALFTIME = 15_000;

type Side = 'home' | 'away';
type KeyMomentKind = 'block' | 'pass' | 'dodge' | 'pickup' | 'gfi' | 'foul';

interface DriveState {
  drivingTeam: Side;
  ballYardline: number; // 0..FIELD_YARDS, 0 = own goal line
  hasPossession: boolean;
}

interface MatchInternalState {
  half: 1 | 2;
  turn: number;
  scoreHome: number;
  scoreAway: number;
  drive: DriveState;
  clockMs: number;
}

interface DriverRng {
  block: Rng;
  dodge: Rng;
  pass: Rng;
  pickup: Rng;
  gfi: Rng;
  foul: Rng;
  strategic: Rng;
}

function forkRngs(rootSeed: number): DriverRng {
  const root = createRng(rootSeed);
  return {
    block: root.fork('block-resolver'),
    dodge: root.fork('dodge-resolver'),
    pass: root.fork('pass-resolver'),
    pickup: root.fork('pickup-resolver'),
    gfi: root.fork('gfi-resolver'),
    foul: root.fork('foul-resolver'),
    strategic: root.fork('strategic-decisions'),
  };
}

function decideOutcome(score: MatchScore): MatchOutcome {
  if (score.home > score.away) return 'home';
  if (score.away > score.home) return 'away';
  return 'draw';
}

function otherSide(s: Side): Side {
  return s === 'home' ? 'away' : 'home';
}

/**
 * Synthesise a 2-player `ResolverState` for the current line of scrimmage.
 * Real rosters are 11+ players, but the hybrid driver only needs an
 * "attacker vs defender" slice for the 1-2 key moments per turn ; the
 * rest is yards math. The full driver (planned post-MVP) will replace
 * this synthesis with a proper board snapshot.
 */
function buildKeyMomentState(
  state: MatchInternalState,
  weather: ResolverState['weather']
): ResolverState {
  const att: ResolverPlayer = {
    id: `${state.drive.drivingTeam}-LOS`,
    team: state.drive.drivingTeam,
    st: 3,
    ag: 3,
    ma: 6,
    av: 9,
    skills: [],
    state: 'standing',
    position: { x: 12, y: 7 },
    hasBall: state.drive.hasPossession,
  };
  const def: ResolverPlayer = {
    id: `${otherSide(state.drive.drivingTeam)}-LOS`,
    team: otherSide(state.drive.drivingTeam),
    st: 3,
    ag: 3,
    ma: 6,
    av: 9,
    skills: [],
    state: 'standing',
    position: { x: 13, y: 7 },
  };
  return {
    players: [att, def],
    ballAt: state.drive.hasPossession ? { x: 12, y: 7 } : undefined,
    activeTeam: state.drive.drivingTeam,
    weather,
    width: FIELD_YARDS,
    height: 15,
    turn: state.turn,
    engineVer: ENGINE_VER,
  };
}

function pickKeyMoment(rng: Rng, drive: DriveState): KeyMomentKind | null {
  const r = rng.next();
  if (!drive.hasPossession) {
    return r < 0.6 ? 'pickup' : 'block';
  }
  if (drive.ballYardline >= FIELD_YARDS - 4) {
    if (r < 0.55) return 'block';
    if (r < 0.85) return 'dodge';
    return 'gfi';
  }
  if (r < 0.35) return 'block';
  if (r < 0.55) return 'dodge';
  if (r < 0.7) return 'pass';
  if (r < 0.8) return 'gfi';
  if (r < 0.92) return 'foul';
  return null;
}

interface KeyMomentOutcome {
  events: readonly MatchEvent[];
  turnover: boolean;
}

function runKeyMoment(
  state: MatchInternalState,
  kind: KeyMomentKind,
  rngs: DriverRng,
  weather: ResolverState['weather'],
  displayAtMs: number
): KeyMomentOutcome {
  const resolverState = buildKeyMomentState(state, weather);
  const att = resolverState.players[0];
  const def = resolverState.players[1];

  switch (kind) {
    case 'block': {
      const out = resolveBlock(
        resolverState,
        { attackerId: att.id, defenderId: def.id, displayAtMs },
        rngs.block
      );
      return { events: out.events, turnover: out.turnover };
    }
    case 'dodge': {
      const out = resolveDodge(
        resolverState,
        {
          playerId: att.id,
          to: { x: att.position.x + 1, y: att.position.y },
          displayAtMs,
        },
        rngs.dodge
      );
      return { events: out.events, turnover: out.turnover };
    }
    case 'pass': {
      if (!att.hasBall) return { events: [], turnover: false };
      const out = resolvePass(
        resolverState,
        {
          passerId: att.id,
          to: { x: att.position.x + 4, y: att.position.y },
          displayAtMs,
        },
        rngs.pass
      );
      return { events: out.events, turnover: out.turnover };
    }
    case 'pickup': {
      const stateWithBall: ResolverState = {
        ...resolverState,
        ballAt: { ...att.position },
      };
      const out = resolvePickup(
        stateWithBall,
        { playerId: att.id, displayAtMs },
        rngs.pickup
      );
      return { events: out.events, turnover: out.turnover };
    }
    case 'gfi': {
      const out = resolveGfi(resolverState, { playerId: att.id, displayAtMs }, rngs.gfi);
      return { events: out.events, turnover: out.turnover };
    }
    case 'foul': {
      const proneVictim: ResolverPlayer = {
        ...def,
        id: `${def.team}-PRONE`,
        state: 'prone',
        position: { x: att.position.x, y: att.position.y + 1 },
      };
      const stateWithVictim: ResolverState = {
        ...resolverState,
        players: [...resolverState.players, proneVictim],
      };
      const out = resolveFoul(
        stateWithVictim,
        { foulerId: att.id, victimId: proneVictim.id, displayAtMs },
        rngs.foul
      );
      return { events: out.events, turnover: out.turnover };
    }
  }
}

function rollYards(rng: Rng): number {
  // 2d6 yards/turn average ~7 — calibrated by lot 0.E tuning.
  return Math.floor(rng.next() * 6) + Math.floor(rng.next() * 6) + 2;
}

function nextDrive(prev: DriveState): DriveState {
  return {
    drivingTeam: otherSide(prev.drivingTeam),
    ballYardline: 4,
    hasPossession: true,
  };
}

interface MutableMatch {
  state: MatchInternalState;
  events: MatchEvent[];
  casualties: Casualty[];
  turnover: number;
  touchdowns: number;
}

function emitTurnStart(m: MutableMatch): void {
  m.events.push({
    type: 'TURN_START',
    displayAtMs: m.state.clockMs,
    engineVer: ENGINE_VER,
    meta: {
      half: m.state.half,
      turn: m.state.turn,
      drivingTeam: m.state.drive.drivingTeam,
      ballYardline: m.state.drive.ballYardline,
      score: { home: m.state.scoreHome, away: m.state.scoreAway },
    },
  });
}

function emitTd(m: MutableMatch, scoringTeam: Side): void {
  m.events.push({
    type: 'TD',
    displayAtMs: m.state.clockMs,
    engineVer: ENGINE_VER,
    meta: {
      team: scoringTeam,
      half: m.state.half,
      turn: m.state.turn,
      scoreAfter: { home: m.state.scoreHome, away: m.state.scoreAway },
    },
  });
}

function processTurn(
  m: MutableMatch,
  rngs: DriverRng,
  weather: ResolverState['weather']
): void {
  emitTurnStart(m);

  // 1-2 key moments per turn driven by the strategic stream.
  const momentCount = m.state.turn % 3 === 0 ? 2 : 1;
  for (let i = 0; i < momentCount; i += 1) {
    const moment = pickKeyMoment(rngs.strategic, m.state.drive);
    if (moment === null) continue;

    const { events: keyEvents, turnover } = runKeyMoment(
      m.state,
      moment,
      rngs,
      weather,
      m.state.clockMs
    );
    m.events.push(...keyEvents);

    for (const ev of keyEvents) {
      if (ev.type === 'CASUALTY') {
        const meta = ev.meta as { playerId?: string; causedBy?: string } | undefined;
        m.casualties.push({
          playerId: meta?.playerId ?? 'unknown',
          team: m.state.drive.drivingTeam === 'home' ? 'B' : 'A',
          outcome: 'badly_hurt',
          causedById: meta?.causedBy,
        });
      }
    }

    if (turnover) {
      m.turnover += 1;
      m.state = { ...m.state, drive: nextDrive(m.state.drive) };
      break;
    }
  }

  // Yard advancement when still in possession.
  if (m.state.drive.hasPossession) {
    const gained = rollYards(rngs.strategic);
    const newYard = m.state.drive.ballYardline + gained;
    if (newYard >= FIELD_YARDS) {
      const scoring = m.state.drive.drivingTeam;
      if (scoring === 'home') m.state = { ...m.state, scoreHome: m.state.scoreHome + 1 };
      else m.state = { ...m.state, scoreAway: m.state.scoreAway + 1 };
      m.touchdowns += 1;
      emitTd(m, scoring);
      m.state = { ...m.state, drive: nextDrive(m.state.drive) };
    } else {
      m.state = {
        ...m.state,
        drive: { ...m.state.drive, ballYardline: newYard },
      };
    }
  }

  m.state = { ...m.state, turn: m.state.turn + 1, clockMs: m.state.clockMs + MS_PER_TURN };
}

export interface DriverOptions {
  /** Wall-clock offset of the kickoff event (ms since match started). */
  kickoffAtMs?: number;
}

export function runHybridDriver(input: SimInput, options: DriverOptions = {}): SimResult {
  const rngs = forkRngs(input.seed);
  const kickoffAtMs = options.kickoffAtMs ?? 0;
  const weather: ResolverState['weather'] = (input.weather as ResolverState['weather']) ?? 'nice';

  const initialReceiver: Side = rngs.strategic.next() < 0.5 ? 'home' : 'away';

  const m: MutableMatch = {
    state: {
      half: 1,
      turn: 1,
      scoreHome: 0,
      scoreAway: 0,
      drive: { drivingTeam: initialReceiver, ballYardline: 4, hasPossession: true },
      clockMs: kickoffAtMs,
    },
    events: [
      {
        type: 'KICKOFF',
        displayAtMs: kickoffAtMs,
        engineVer: ENGINE_VER,
        seed: input.seed,
        meta: {
          home: input.home.id,
          away: input.away.id,
          weather,
          receivingTeam: initialReceiver,
        },
      },
    ],
    casualties: [],
    turnover: 0,
    touchdowns: 0,
  };

  // First half.
  while (m.state.turn <= TURNS_PER_HALF) {
    processTurn(m, rngs, weather);
  }

  // Halftime.
  m.events.push({
    type: 'HALFTIME',
    displayAtMs: m.state.clockMs,
    engineVer: ENGINE_VER,
    meta: { score: { home: m.state.scoreHome, away: m.state.scoreAway } },
  });
  m.state = {
    ...m.state,
    half: 2,
    turn: 1,
    clockMs: m.state.clockMs + MS_HALFTIME,
    drive: { drivingTeam: otherSide(initialReceiver), ballYardline: 4, hasPossession: true },
  };

  // Second half.
  while (m.state.turn <= TURNS_PER_HALF) {
    processTurn(m, rngs, weather);
  }

  m.events.push({
    type: 'END',
    displayAtMs: m.state.clockMs,
    engineVer: ENGINE_VER,
    meta: { score: { home: m.state.scoreHome, away: m.state.scoreAway } },
  });

  const score: MatchScore = { home: m.state.scoreHome, away: m.state.scoreAway };
  const summary: MatchSummary = {
    outcome: decideOutcome(score),
    score,
    turnoverCount: m.turnover,
    touchdownCount: m.touchdowns,
    durationMs: m.state.clockMs - kickoffAtMs,
  };

  return {
    result: summary.outcome,
    events: m.events,
    summary,
    casualties: m.casualties,
    engineVer: ENGINE_VER,
  };
}
