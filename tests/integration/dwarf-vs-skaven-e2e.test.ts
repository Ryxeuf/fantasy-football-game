import { describe, it, expect } from "vitest";
import {
  setupPreMatchWithTeams,
  enterSetupPhase,
  placePlayerInSetup,
  applyMove,
  getLegalMoves,
  makeRNG,
  validateGameState,
  TEAM_ROSTERS,
  type GameState,
  type Position,
  type TeamId,
  type RNG,
} from "../../packages/game-engine/src/index";
import {
  validatePlayerPlacement,
  startKickoffSequence,
  startMatchFromKickoff,
  type ExtendedGameState,
  type TeamPlayerData,
} from "../../packages/game-engine/src/core/game-state";

type RosterKey = "dwarf" | "skaven";

/** Build 11 roster-faithful players (stats + skills) for the requested team. */
function buildRosterPlayers(roster: RosterKey, team: TeamId): TeamPlayerData[] {
  const def = TEAM_ROSTERS[roster];
  // Lineup used per team: 7 linemen + 2 specialists + 2 blitzers/runners
  const lineupByRoster: Record<RosterKey, number[]> = {
    //        idx: 0=lineman, 1=runner/thrower, 2=blitzer/guttrun, 3=specialist, 4=monster
    dwarf: [0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 3],
    skaven: [0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 2],
  };
  const lineup = lineupByRoster[roster];
  return lineup.map((slotIdx, i) => {
    const slot = def.positions[slotIdx];
    const number = i + 1;
    return {
      id: `${team}${number}`,
      name: `${slot.displayName} #${number}`,
      position: slot.displayName,
      number,
      ma: slot.ma,
      st: slot.st,
      ag: slot.ag,
      pa: slot.pa,
      av: slot.av,
      skills: slot.skills ?? "",
    };
  });
}

/** Place 11 players for one team following valid BB setup constraints. */
function placeTeamOnField(
  state: ExtendedGameState,
  team: TeamId,
): ExtendedGameState {
  const losX = team === "A" ? 12 : 13;
  const safeX = team === "A" ? 6 : 18;
  // 3 on LOS, 2 in each wide zone, 4 in middle
  const positions: Position[] = [
    { x: losX, y: 6 },
    { x: losX, y: 7 },
    { x: losX, y: 8 },
    { x: safeX, y: 1 },
    { x: safeX, y: 2 },
    { x: safeX, y: 12 },
    { x: safeX, y: 13 },
    { x: safeX, y: 4 },
    { x: safeX, y: 5 },
    { x: safeX, y: 9 },
    { x: safeX, y: 10 },
  ];
  const teamPlayers = state.players.filter((p) => p.team === team);
  let current = state;
  for (let i = 0; i < 11; i++) {
    const res = placePlayerInSetup(current, teamPlayers[i].id, positions[i]);
    if (!res.success) {
      throw new Error(
        `Impossible de placer ${teamPlayers[i].id} en (${positions[i].x}, ${positions[i].y})`,
      );
    }
    current = res.state;
  }
  return current;
}

/** Traverse pré-match → setup → kickoff → playing, returning a GameState ready for turn 1. */
function bootstrapMatch(preMatch: ExtendedGameState, rng: RNG): GameState {
  let s: ExtendedGameState = enterSetupPhase(preMatch, "A");
  s = placeTeamOnField(s, "A");
  s = validatePlayerPlacement(s); // switches to team B
  s = placeTeamOnField(s, "B");
  s = validatePlayerPlacement(s); // transitions to 'kickoff'
  s = startKickoffSequence(s);
  // Kick lands on the center — bypass dice deviation for a stable starting state.
  s = {
    ...s,
    preMatch: {
      ...s.preMatch,
      finalBallPosition: { x: 13, y: 7 },
      kickingTeam: "B",
      receivingTeam: "A",
    },
  };
  return startMatchFromKickoff(s, rng);
}

/** Resolve every BLOCK / PUSH / FOLLOW_UP popup after a move using deterministic picks. */
function drainPendingPopups(initial: GameState, rng: RNG): GameState {
  let state = initial;
  let guard = 0;
  while (
    state.pendingBlock ||
    state.pendingPushChoice ||
    state.pendingFollowUpChoice
  ) {
    if (++guard > 64) {
      throw new Error("drainPendingPopups: too many iterations (possible loop)");
    }
    if (state.pendingBlock) {
      const opts = state.pendingBlock.options;
      const choice = opts[Math.floor(rng() * opts.length)];
      state = applyMove(
        state,
        {
          type: "BLOCK_CHOOSE",
          playerId: state.pendingBlock.attackerId,
          targetId: state.pendingBlock.targetId,
          result: choice,
        },
        rng,
      );
      continue;
    }
    if (state.pendingPushChoice) {
      const dirs = state.pendingPushChoice.availableDirections;
      const dir = dirs[Math.floor(rng() * dirs.length)];
      state = applyMove(
        state,
        {
          type: "PUSH_CHOOSE",
          playerId: state.pendingPushChoice.attackerId,
          targetId: state.pendingPushChoice.targetId,
          direction: dir,
        },
        rng,
      );
      continue;
    }
    if (state.pendingFollowUpChoice) {
      state = applyMove(
        state,
        {
          type: "FOLLOW_UP_CHOOSE",
          playerId: state.pendingFollowUpChoice.attackerId,
          targetId: state.pendingFollowUpChoice.targetId,
          followUp: rng() > 0.5,
        },
        rng,
      );
      continue;
    }
  }
  return state;
}

describe("Règle: Match complet Nains vs Skaven sans divergence de règles", () => {
  it("devrait construire 11 joueurs Nains + 11 Skavens avec stats et skills du roster officiel", () => {
    const nains = buildRosterPlayers("dwarf", "A");
    const skaven = buildRosterPlayers("skaven", "B");

    expect(nains).toHaveLength(11);
    expect(skaven).toHaveLength(11);

    // Nain Blocker Lineman: AV 10, skills block/tackle/thick-skull
    expect(nains[0].av).toBe(10);
    expect(nains[0].skills).toContain("block");
    expect(nains[0].skills).toContain("thick-skull");

    // Skaven Lineman: MA 7 (rats are fast), AV 8 (fragile)
    expect(skaven[0].ma).toBe(7);
    expect(skaven[0].av).toBe(8);

    // Numéros uniques par équipe
    const nainsNumbers = new Set(nains.map((p) => p.number));
    expect(nainsNumbers.size).toBe(11);
  });

  it("devrait traverser pré-match → setup → kickoff → playing sans erreur d'état", () => {
    const nains = buildRosterPlayers("dwarf", "A");
    const skaven = buildRosterPlayers("skaven", "B");
    const preMatch = setupPreMatchWithTeams(nains, skaven, "Nains", "Skavens", {
      teamARoster: "dwarf",
      teamBRoster: "skaven",
    });
    const rng = makeRNG("bootstrap-nains-vs-skavens");

    const game = bootstrapMatch(preMatch, rng);

    expect(game.gamePhase).toBe("playing");
    expect(game.half).toBe(1);
    expect(game.turn).toBe(1);

    // 22 joueurs placés sur le terrain
    const onField = game.players.filter((p) => p.pos.x >= 0 && p.pos.y >= 0);
    expect(onField).toHaveLength(22);

    // Les stats du roster sont préservées après tout le flux de pré-match
    const nainBlocker = game.players.find(
      (p) => p.team === "A" && p.position.includes("Blocker"),
    );
    expect(nainBlocker?.av).toBe(10);
    expect(nainBlocker?.skills).toContain("block");

    const skavenLineman = game.players.find(
      (p) => p.team === "B" && p.position === "Lineman",
    );
    expect(skavenLineman?.ma).toBe(7);

    const validation = validateGameState(game);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
  });

  it("devrait enchaîner 80 actions légales sans divergence d'état", () => {
    const nains = buildRosterPlayers("dwarf", "A");
    const skaven = buildRosterPlayers("skaven", "B");
    const preMatch = setupPreMatchWithTeams(nains, skaven, "Nains", "Skavens", {
      teamARoster: "dwarf",
      teamBRoster: "skaven",
    });
    const rng = makeRNG("simulation-nains-vs-skavens-42");
    let state: GameState = bootstrapMatch(preMatch, rng);

    const MAX_ACTIONS = 80;
    const divergences: string[] = [];
    let actionsPlayed = 0;

    for (let i = 0; i < MAX_ACTIONS; i++) {
      if (state.gamePhase === "ended") break;

      const legal = getLegalMoves(state);
      if (legal.length === 0) break;

      // Mélange légèrement le choix pour couvrir plusieurs types d'actions
      // (MOVE, BLOCK, END_TURN, etc.) tout en restant déterministe via rng.
      const picked = legal[Math.floor(rng() * legal.length)];

      let next = applyMove(state, picked, rng);
      next = drainPendingPopups(next, rng);

      const validation = validateGameState(next);
      if (!validation.valid) {
        divergences.push(
          `Action #${i} (${picked.type}): ${validation.errors
            .map((e) => `${e.code} — ${e.message}`)
            .join("; ")}`,
        );
        break;
      }
      state = next;
      actionsPlayed++;
    }

    expect(divergences).toEqual([]);
    expect(actionsPlayed).toBeGreaterThan(10);

    // Aucun popup ne doit rester en attente à la fin de la simulation
    expect(state.pendingBlock).toBeUndefined();
    expect(state.pendingPushChoice).toBeUndefined();
    expect(state.pendingFollowUpChoice).toBeUndefined();

    // Les scores doivent rester positifs ou nuls
    expect(state.score.teamA).toBeGreaterThanOrEqual(0);
    expect(state.score.teamB).toBeGreaterThanOrEqual(0);
  });

  it("devrait préserver les skills intrinsèques des deux rosters tout au long de la partie", () => {
    const nains = buildRosterPlayers("dwarf", "A");
    const skaven = buildRosterPlayers("skaven", "B");
    const preMatch = setupPreMatchWithTeams(nains, skaven, "Nains", "Skavens", {
      teamARoster: "dwarf",
      teamBRoster: "skaven",
    });
    const rng = makeRNG("skills-preservation-nains-vs-skavens");
    let state: GameState = bootstrapMatch(preMatch, rng);

    const initialSkillsByPlayer = new Map<string, string[]>(
      state.players.map((p) => [p.id, [...p.skills]] as const),
    );

    for (let i = 0; i < 30; i++) {
      if (state.gamePhase === "ended") break;
      const legal = getLegalMoves(state);
      if (legal.length === 0) break;
      const picked = legal[Math.floor(rng() * legal.length)];
      state = drainPendingPopups(applyMove(state, picked, rng), rng);
    }

    // Aucune compétence de base n'a disparu pendant le jeu
    for (const player of state.players) {
      const before = initialSkillsByPlayer.get(player.id) ?? [];
      for (const skill of before) {
        expect(
          player.skills,
          `${player.id} a perdu le skill ${skill}`,
        ).toContain(skill);
      }
    }
  });
});
