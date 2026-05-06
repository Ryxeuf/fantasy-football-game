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
  createMomentumTracker,
  recordBlock,
  recordFailure,
  recordTouchdown,
  type MomentumTracker,
} from '../tactics/momentum';
import {
  DEFAULT_TACTICAL_PROFILE,
  type TacticalProfile,
} from '../tactics/tactical-profile';
import {
  UNDERDOG_BOOST_PROBABILITY,
  computeUnderdog,
  type UnderdogContext,
} from '../tactics/underdog';
import { aiPlay, type DriveSnapshot } from '../ai';
import { emitNuffleEvent, rollNuffleEvent } from '../nuffle/events';
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
  /** Dedicated stream for the Eye-of-Nuffle hook (lot 0.C.2) — kept
   *  independent so adding/removing Nuffle events doesn't shift the
   *  resolver streams. */
  nuffle: Rng;
  /** Underdog luck stream (lot 0.C.3). Decides whether a turnover
   *  triggers the silent retry. Independent so toggling the boost
   *  on/off doesn't shift any other stream. */
  luck: Rng;
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
    nuffle: root.fork('nuffle-events'),
    luck: root.fork('underdog-luck'),
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
/**
 * Derives a synthetic LOS player stat sheet from the tactical profile.
 * Sprint 0.E.1 tuning : the synthetic match was racially homogenous
 * (every team got st=3, ag=3) so winrates clustered around 33-40%
 * regardless of race. We now project the profile onto BB-flavored stats
 * so Halflings/Ogres feel different from Wood Elves/Dwarves.
 *
 * Mapping (clamped to BB-realistic ranges) :
 *   st = 2 + round(bashIndex / 25)              ∈ [2, 6]
 *   ag = 1 + round(breakawayInstinct / 33)      ∈ [1, 4]   (BB3 PA proxy)
 *   av = 7 + round((100 - foulFrequency*0) / ...) — left at 9 for simplicity ;
 *        future iteration can derive AV from race archetype.
 *   ma = 4 + round(pace / 25)                   ∈ [4, 8]
 *
 * Skill grants : team profiles >=70 on a dimension imply iconic skills
 *  (e.g. Wood Elves get `dodge`, Orcs get `block`, etc.). Kept
 *  deliberately small so the resolver behaviour stays predictable.
 */
function deriveLosStats(profile: TacticalProfile): {
  st: number;
  ag: number;
  ma: number;
  av: number;
  skills: string[];
} {
  const st = Math.max(2, Math.min(6, 2 + Math.round(profile.bashIndex / 25)));
  const ag = Math.max(1, Math.min(4, 1 + Math.round(profile.breakawayInstinct / 33)));
  const ma = Math.max(4, Math.min(8, 4 + Math.round(profile.pace / 25)));
  const skills: string[] = [];
  if (profile.bashIndex >= 80) skills.push('block');
  if (profile.breakawayInstinct >= 75) skills.push('dodge');
  if (profile.passingFrequency >= 75) skills.push('pass');
  if (profile.foulFrequency >= 75) skills.push('dirty_player');
  return { st, ag, ma, av: 9, skills };
}

function buildKeyMomentState(
  state: MatchInternalState,
  weather: ResolverState['weather'],
  attProfile: TacticalProfile,
  defProfile: TacticalProfile
): ResolverState {
  const attStats = deriveLosStats(attProfile);
  const defStats = deriveLosStats(defProfile);
  const att: ResolverPlayer = {
    id: `${state.drive.drivingTeam}-LOS`,
    team: state.drive.drivingTeam,
    ...attStats,
    state: 'standing',
    position: { x: 12, y: 7 },
    hasBall: state.drive.hasPossession,
  };
  const def: ResolverPlayer = {
    id: `${otherSide(state.drive.drivingTeam)}-LOS`,
    team: otherSide(state.drive.drivingTeam),
    ...defStats,
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

/**
 * Picks the key-moment kind for the current turn via the 3-pass
 * behavior tree (lot 0.B.1) :
 *   evaluate situation → choose strategy → execute pattern.
 *
 * The narrative coherence guarantee (drives stay on-strategy across
 * the consecutive moments of a turn) is delegated to `aiPlay` ; the
 * driver only consumes its `moment` output here.
 */
function pickKeyMoment(
  rng: Rng,
  state: MatchInternalState,
  profile: TacticalProfile
): KeyMomentKind | null {
  const snap: DriveSnapshot = {
    hasPossession: state.drive.hasPossession,
    ballYardline: state.drive.ballYardline,
    turn: state.turn,
    half: state.half,
    scoreSelf: state.drive.drivingTeam === 'home' ? state.scoreHome : state.scoreAway,
    scoreOpp: state.drive.drivingTeam === 'home' ? state.scoreAway : state.scoreHome,
  };
  const { moment } = aiPlay(rng, snap, profile);
  return moment;
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
  displayAtMs: number,
  attProfile: TacticalProfile,
  defProfile: TacticalProfile
): KeyMomentOutcome {
  const resolverState = buildKeyMomentState(state, weather, attProfile, defProfile);
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

function rollYards(
  rng: Rng,
  profile: TacticalProfile,
  defenseProfile: TacticalProfile,
  tvDelta = 0
): number {
  // Sprint 0.E.1 tuning iter #11 (engineVer 0.12.0) :
  //
  // - Base : 2d6+2 (mean 7).
  // - bash counter / disruption / pace offset : unchanged.
  // - Breakthrough proba : 16% → 18%. Magnitudes unchanged.
  // - TV delta bonus : +1 yard / 100 TV de différence (cap ±3) — favori
  //   gagne un peu plus consistamment, ce qui pousse l'upset rate vers
  //   la cible 12-18% (C2).
  const dice = Math.floor(rng.next() * 6) + Math.floor(rng.next() * 6) + 2;
  const paceOffset = Math.round(profile.pace / 25) - 2;
  const bashCounter = -Math.round(defenseProfile.bashIndex / 28);
  const defensiveDisruption = -Math.min(
    3,
    Math.round((defenseProfile.stallTendency * defenseProfile.bashIndex) / 2000)
  );
  const tvBonus = Math.max(-3, Math.min(3, Math.round(tvDelta / 100)));
  const fatTail = rng.next();
  let breakthrough = 0;
  if (fatTail < 0.18) {
    if (defenseProfile.bashIndex < 50) breakthrough = 40;
    else if (defenseProfile.bashIndex < 70) breakthrough = 35;
    else breakthrough = 30;
  } else if (fatTail < 0.34) {
    breakthrough = -10;
  }
  return Math.max(0, dice + paceOffset + bashCounter + defensiveDisruption + tvBonus + breakthrough);
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
  /** Number of Eye-of-Nuffle events triggered during the match (lot 0.C.2). */
  nuffleEvents: number;
  /** Number of times the underdog variance boost saved a turnover
   *  (lot 0.C.3). Surfaced in `MatchSummary` for bench analytics. */
  underdogBoosts: number;
  /** Per-player momentum tracker (lot 0.B.4). The MVP synthesises LOS
   *  player IDs ; the full driver (post-MVP) will plug real roster IDs. */
  momentum: MomentumTracker;
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
  weather: ResolverState['weather'],
  homeProfile: TacticalProfile,
  awayProfile: TacticalProfile,
  underdog: UnderdogContext,
  tvHome: number | undefined,
  tvAway: number | undefined
): void {
  emitTurnStart(m);

  // Eye of Nuffle (lot 0.C.2). Rolls a scripted NUFFLE event ~30% of
  // turns and emits it on the wire timeline. The actual gameplay
  // effects of each event are layered on by the tuning loop (lot 0.E)
  // ; this hook only injects the narrative beat.
  const nuffleEvent = rollNuffleEvent(rngs.nuffle);
  if (nuffleEvent) {
    m.events.push(
      emitNuffleEvent(nuffleEvent, {
        displayAtMs: m.state.clockMs,
        engineVer: ENGINE_VER,
        context: {
          half: m.state.half,
          turn: m.state.turn,
          drivingTeam: m.state.drive.drivingTeam,
        },
      })
    );
    m.nuffleEvents += 1;
    // Sprint 0.E.1 iter #10 (engineVer 0.11.0) : encore élargi la
    // casualty injection. 8 events injectent maintenant des casualties.
    if (
      nuffleEvent.id === 'bombardier_gone_wild' ||
      (nuffleEvent.id === 'banana_skin' && rngs.luck.next() < 0.5) ||
      (nuffleEvent.id === 'crowd_riot' && rngs.luck.next() < 0.6) ||
      (nuffleEvent.id === 'nemesis_clash' && rngs.luck.next() < 0.25) ||
      (nuffleEvent.id === 'tantrum_star' && rngs.luck.next() < 0.5) ||
      (nuffleEvent.id === 'cocky_drop' && rngs.luck.next() < 0.3) ||
      (nuffleEvent.id === 'equipment_failure' && rngs.luck.next() < 0.3) ||
      (nuffleEvent.id === 'wardrobe_malfunction' && rngs.luck.next() < 0.2)
    ) {
      const victimSide: Side = otherSide(m.state.drive.drivingTeam);
      const victimId = `${victimSide}-NUFFLE-${m.state.half}-${m.state.turn}`;
      m.casualties.push({
        playerId: victimId,
        team: victimSide === 'home' ? 'A' : 'B',
        outcome: 'badly_hurt',
        causedById: `nuffle:${nuffleEvent.id}`,
      });
      m.events.push({
        type: 'CASUALTY',
        displayAtMs: m.state.clockMs,
        engineVer: ENGINE_VER,
        meta: {
          playerId: victimId,
          causedBy: nuffleEvent.id,
          via: 'nuffle',
        },
      });
    }
  }

  // 1-2 key moments per turn driven by the strategic stream. Iter #4
  // (engineVer 0.5.0) : threshold lowered from 70 to 60 — broader set
  // of bash teams (Pittsburgh, Norse, Iron Bears, etc.) get the extra
  // moment, pushing casualty rate further toward FUMBBL ~1.0 / match.
  const activeProfile = m.state.drive.drivingTeam === 'home' ? homeProfile : awayProfile;
  const opposingProfile = m.state.drive.drivingTeam === 'home' ? awayProfile : homeProfile;
  const isBashy =
    activeProfile.bashIndex >= 60 || activeProfile.foulFrequency >= 60;
  const baseCount = m.state.turn % 3 === 0 ? 2 : 1;
  const momentCount = isBashy && m.state.turn % 2 === 0 ? baseCount + 1 : baseCount;
  for (let i = 0; i < momentCount; i += 1) {
    const moment = pickKeyMoment(rngs.strategic, m.state, activeProfile);
    if (moment === null) continue;

    let attempt = runKeyMoment(
      m.state,
      moment,
      rngs,
      weather,
      m.state.clockMs,
      activeProfile,
      opposingProfile
    );

    // Underdog variance boost (lot 0.C.3) — silently re-run a turnover
    // if the active team is the underdog and a 10% luck check triggers.
    // Invisible to the user : the failed attempt's events are discarded
    // and only the retry events surface on the timeline.
    if (
      attempt.turnover &&
      underdog.side !== null &&
      m.state.drive.drivingTeam === underdog.side &&
      rngs.luck.next() < UNDERDOG_BOOST_PROBABILITY
    ) {
      const retry = runKeyMoment(
        m.state,
        moment,
        rngs,
        weather,
        m.state.clockMs,
        activeProfile,
        opposingProfile
      );
      if (!retry.turnover) {
        attempt = retry;
        m.underdogBoosts += 1;
      }
    }

    const { events: keyEvents, turnover } = attempt;
    m.events.push(...keyEvents);

    // Synthetic LOS player ids — the full driver (post-MVP) will pass
    // real roster ids ; for now we use the same ids the resolvers see.
    const drivingPlayerId = `${m.state.drive.drivingTeam}-LOS`;

    for (const ev of keyEvents) {
      if (ev.type === 'CASUALTY') {
        const meta = ev.meta as { playerId?: string; causedBy?: string } | undefined;
        m.casualties.push({
          playerId: meta?.playerId ?? 'unknown',
          team: m.state.drive.drivingTeam === 'home' ? 'B' : 'A',
          outcome: 'badly_hurt',
          causedById: meta?.causedBy,
        });
      } else if (ev.type === 'BLOCK') {
        const meta = ev.meta as { resolution?: string } | undefined;
        const success = meta?.resolution === 'defender_down';
        recordBlock(m.momentum, drivingPlayerId, { success });
      }
    }

    if (turnover) {
      m.turnover += 1;
      recordFailure(m.momentum, drivingPlayerId);
      m.state = { ...m.state, drive: nextDrive(m.state.drive) };
      break;
    }
  }

  // Yard advancement when still in possession. Re-derive profiles at
  // this point because a turnover during the for-loop above may have
  // swapped `drivingTeam`.
  if (m.state.drive.hasPossession) {
    const yardsActive = m.state.drive.drivingTeam === 'home' ? homeProfile : awayProfile;
    const yardsOpposing = m.state.drive.drivingTeam === 'home' ? awayProfile : homeProfile;
    const tvActive = m.state.drive.drivingTeam === 'home' ? tvHome : tvAway;
    const tvOpposing = m.state.drive.drivingTeam === 'home' ? tvAway : tvHome;
    const tvDelta =
      typeof tvActive === 'number' && typeof tvOpposing === 'number' ? tvActive - tvOpposing : 0;
    const gained = rollYards(rngs.strategic, yardsActive, yardsOpposing, tvDelta);
    const newYard = m.state.drive.ballYardline + gained;
    if (newYard >= FIELD_YARDS) {
      const scoring = m.state.drive.drivingTeam;
      if (scoring === 'home') m.state = { ...m.state, scoreHome: m.state.scoreHome + 1 };
      else m.state = { ...m.state, scoreAway: m.state.scoreAway + 1 };
      m.touchdowns += 1;
      recordTouchdown(m.momentum, `${scoring}-LOS`);
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

  // Tactical fingerprints. Default to the neutral baseline when a team
  // input does not provide one (e.g. ad-hoc test seeds).
  const homeProfile: TacticalProfile = input.home.tactics ?? DEFAULT_TACTICAL_PROFILE;
  const awayProfile: TacticalProfile = input.away.tactics ?? DEFAULT_TACTICAL_PROFILE;
  const underdog: UnderdogContext = computeUnderdog(input.home, input.away);

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
          homeName: input.home.name,
          awayName: input.away.name,
          weather,
          receivingTeam: initialReceiver,
        },
      },
    ],
    casualties: [],
    turnover: 0,
    touchdowns: 0,
    nuffleEvents: 0,
    underdogBoosts: 0,
    momentum: createMomentumTracker(),
  };

  // First half.
  while (m.state.turn <= TURNS_PER_HALF) {
    processTurn(m, rngs, weather, homeProfile, awayProfile, underdog, input.home.tv, input.away.tv);
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
    processTurn(m, rngs, weather, homeProfile, awayProfile, underdog, input.home.tv, input.away.tv);
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
    nuffleCount: m.nuffleEvents,
    underdogBoostCount: m.underdogBoosts,
    durationMs: m.state.clockMs - kickoffAtMs,
    momentum: m.momentum.snapshot(),
  };

  return {
    result: summary.outcome,
    events: m.events,
    summary,
    casualties: m.casualties,
    engineVer: ENGINE_VER,
  };
}
