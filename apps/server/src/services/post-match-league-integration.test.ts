/**
 * L2.B.9 — Integration test : flux post-match Jeu en Ligue end-to-end
 * (Sprint Ligues v2 PR6).
 *
 * Different des unit tests `post-match-league-sequence.test.ts` (qui
 * isolent chaque service avec un mock prisma vierge), ce spec
 * partage *un seul* etat mock entre tous les services pour verifier
 * leurs interactions sequentielles :
 *
 *   runPostMatchLeagueSequence (cree la sequence + identifie 1 choice)
 *     -> applyAdvancementChoice (decremente SPP, push advancement)
 *     -> markSequenceCompletedIfDone (ferme la sequence)
 *
 * Et verifie l'idempotence :
 *   runPostMatchLeagueSequence rejoue -> already-exists.
 *
 * Et le cas Bagarreurs Brutaux :
 *   un joueur de roster ayant la regle qui marque 2 TD + 0 cas
 *   gagne 4 PSP (au lieu de 6 en vanilla) — cf. spp-tracking.test.ts.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Shared mock state across all the services under test.
interface PlayerRow {
  id: string;
  teamId: string;
  name: string;
  spp: number;
  skills: string;
  advancements: string;
  dead: boolean;
}

interface SequenceRow {
  id: string;
  matchId: string;
  seasonId: string;
  status: string;
  pendingChoices: string;
  winningsApplied: boolean;
  lastingInjuriesApplied: boolean;
  advancementsResolved: boolean;
  treasuryDeltaA: number;
  treasuryDeltaB: number;
  fanFactorDeltaA: number;
  fanFactorDeltaB: number;
  completedAt: Date | null;
}

interface MatchRow {
  id: string;
  leagueSeasonId: string | null;
  leagueScoredAt: Date | null;
  leaguePostMatchSequence: { id: string; status: string } | null;
  teamSelections: Array<{ teamId: string }>;
}

interface TeamRow {
  id: string;
  currentValue: number;
}

const state: {
  players: PlayerRow[];
  sequences: SequenceRow[];
  matches: MatchRow[];
  teams: TeamRow[];
  nextSeqId: number;
} = {
  players: [],
  sequences: [],
  matches: [],
  teams: [],
  nextSeqId: 1,
};

vi.mock("../prisma", () => ({
  prisma: {
    teamPlayer: {
      findMany: vi.fn(async (args: { where: { teamId: string; dead?: boolean } }) =>
        state.players.filter(
          (p) =>
            p.teamId === args.where.teamId &&
            (args.where.dead === undefined || p.dead === args.where.dead),
        ),
      ),
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        state.players.find((p) => p.id === args.where.id) ?? null,
      ),
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const idx = state.players.findIndex((p) => p.id === args.where.id);
          if (idx < 0) throw new Error("player not found");
          const player = state.players[idx];
          const data = args.data as Record<string, any>;
          const next = { ...player };
          if (data.spp?.decrement) next.spp -= data.spp.decrement;
          if (typeof data.advancements === "string") {
            next.advancements = data.advancements;
          }
          if (typeof data.skills === "string") next.skills = data.skills;
          state.players[idx] = next;
          return next;
        },
      ),
    },
    // Accès primaire/secondaire (C2) : non renseigné dans ce scénario ->
    // findFirst -> null -> validation skippée (comportement historique).
    position: { findFirst: vi.fn(async () => null) },
    skill: { findFirst: vi.fn(async () => null) },
    team: {
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: { currentValue: { increment: number } };
        }) => {
          const idx = state.teams.findIndex((t) => t.id === args.where.id);
          if (idx >= 0) {
            state.teams[idx] = {
              ...state.teams[idx],
              currentValue:
                state.teams[idx].currentValue +
                (args.data.currentValue?.increment ?? 0),
            };
          }
        },
      ),
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        state.teams.find((t) => t.id === args.where.id) ?? null,
      ),
    },
    match: {
      findUnique: vi.fn(
        async (args: {
          where: { id: string };
          select?: Record<string, unknown>;
        }) => {
          const m = state.matches.find((mr) => mr.id === args.where.id);
          if (!m) return null;
          // Return everything we have; the service ignores fields it
          // didn't ask for.
          return m;
        },
      ),
    },
    leaguePostMatchSequence: {
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        state.sequences.find((s) => s.id === args.where.id) ?? null,
      ),
      findFirst: vi.fn(async () =>
        state.sequences.find((s) => s.status === "awaiting_choices") ?? null,
      ),
      create: vi.fn(
        async (args: {
          data: Record<string, unknown>;
          select?: unknown;
        }) => {
          const id = `seq-${state.nextSeqId++}`;
          const data = args.data as any;
          const row: SequenceRow = {
            id,
            matchId: data.matchId,
            seasonId: data.seasonId,
            status: data.status,
            pendingChoices: data.pendingChoices,
            winningsApplied: data.winningsApplied ?? false,
            lastingInjuriesApplied: data.lastingInjuriesApplied ?? false,
            advancementsResolved: data.advancementsResolved ?? false,
            treasuryDeltaA: data.treasuryDeltaA ?? 0,
            treasuryDeltaB: data.treasuryDeltaB ?? 0,
            fanFactorDeltaA: data.fanFactorDeltaA ?? 0,
            fanFactorDeltaB: data.fanFactorDeltaB ?? 0,
            completedAt: data.completedAt ?? null,
          };
          state.sequences.push(row);
          // Update the linked match so subsequent runPostMatchLeagueSequence
          // sees `leaguePostMatchSequence: {id, status}` and skips.
          const matchIdx = state.matches.findIndex(
            (m) => m.id === row.matchId,
          );
          if (matchIdx >= 0) {
            state.matches[matchIdx] = {
              ...state.matches[matchIdx],
              leaguePostMatchSequence: { id: row.id, status: row.status },
            };
          }
          return { id: row.id, status: row.status };
        },
      ),
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const idx = state.sequences.findIndex(
            (s) => s.id === args.where.id,
          );
          if (idx >= 0) {
            const data = args.data as any;
            state.sequences[idx] = {
              ...state.sequences[idx],
              ...(typeof data.status === "string"
                ? { status: data.status }
                : {}),
              ...(typeof data.advancementsResolved === "boolean"
                ? { advancementsResolved: data.advancementsResolved }
                : {}),
              ...(data.completedAt instanceof Date
                ? { completedAt: data.completedAt }
                : {}),
            };
          }
        },
      ),
    },
    // Audit round 5 : `applyAdvancementChoice` wrap les 2 updates dans
    // une $transaction. Le mock execute simplement le callback en
    // passant `this` (le meme stub stateful) — `tx.teamPlayer.update`
    // resout vers la meme fonction que `prisma.teamPlayer.update`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn(async function (this: any, cb: any) {
      // `this` est le stub prisma au moment de l'appel — on le repasse.
      return cb(this);
    }),
  },
}));

import {
  runPostMatchLeagueSequence,
  applyAdvancementChoice,
  markSequenceCompletedIfDone,
} from "./post-match-league-sequence";

function resetState() {
  state.players = [];
  state.sequences = [];
  state.matches = [];
  state.teams = [];
  state.nextSeqId = 1;
}

beforeEach(() => {
  resetState();
  vi.clearAllMocks();
});

describe("L2.B.9 — Integration : runPostMatchLeagueSequence -> applyAdvancement -> markCompleted", () => {
  it("happy path : creates sequence, applies advancement, closes sequence", async () => {
    state.players = [
      {
        id: "player-A1",
        teamId: "team-A",
        name: "Alice's Star",
        spp: 8, // suffit pour primary (6) ou random-primary (3)
        skills: "block",
        advancements: "[]",
        dead: false,
      },
    ];
    state.teams = [
      { id: "team-A", currentValue: 1000000 },
      { id: "team-B", currentValue: 1000000 },
    ];
    state.matches = [
      {
        id: "match-1",
        leagueSeasonId: "season-1",
        leagueScoredAt: new Date(),
        leaguePostMatchSequence: null,
        teamSelections: [{ teamId: "team-A" }, { teamId: "team-B" }],
      },
    ];

    // Step 1 : run sequence -> 1 pendingChoice (Alice's Star).
    const seqOut = await runPostMatchLeagueSequence({ matchId: "match-1" });
    if (!("created" in seqOut)) throw new Error("expected created");
    expect(seqOut.status).toBe("awaiting_choices");
    expect(seqOut.pendingChoices).toHaveLength(1);
    expect(seqOut.pendingChoices[0].playerName).toBe("Alice's Star");

    // Step 2 : apply primary advancement (cost 6). Pas le moins cher,
    // mais on choisit explicitement.
    const applyOut = await applyAdvancementChoice({
      teamId: "team-A",
      playerId: "player-A1",
      type: "primary",
      skillSlug: "dodge",
    });
    if (!("applied" in applyOut)) throw new Error("expected applied");
    expect(applyOut.applied).toBe(true);
    expect(applyOut.newSpp).toBe(2); // 8 - 6 = 2
    expect(applyOut.newAdvancementCount).toBe(1);
    expect(applyOut.addedSkill).toBe("dodge");
    // currentValue : 1_000_000 + 20_000 (surcharge primary) = 1_020_000
    expect(applyOut.currentValue).toBe(1020000);

    // Verifie l'etat partage.
    expect(state.players[0].spp).toBe(2);
    expect(state.players[0].skills).toBe("block,dodge");
    expect(JSON.parse(state.players[0].advancements)).toHaveLength(1);

    // Step 3 : ferme la sequence (le seul pendingChoice est resolu).
    const closure = await markSequenceCompletedIfDone(seqOut.sequenceId);
    expect(closure.closed).toBe(true);
    expect(closure.status).toBe("completed");
    expect(state.sequences[0].status).toBe("completed");
  });

  it("idempotence : re-running runPostMatchLeagueSequence on the same match returns already-exists", async () => {
    state.players = [
      {
        id: "p1",
        teamId: "team-A",
        name: "Solo",
        spp: 0,
        skills: "",
        advancements: "[]",
        dead: false,
      },
    ];
    state.matches = [
      {
        id: "match-2",
        leagueSeasonId: "season-2",
        leagueScoredAt: new Date(),
        leaguePostMatchSequence: null,
        teamSelections: [{ teamId: "team-A" }, { teamId: "team-B" }],
      },
    ];

    const first = await runPostMatchLeagueSequence({ matchId: "match-2" });
    if (!("created" in first)) throw new Error("expected created");
    expect(first.status).toBe("completed"); // 0 SPP -> aucun choice

    // Re-run : le mock match a maintenant un leaguePostMatchSequence
    // attache (cf. `create` ci-dessus). Le service skip.
    const second = await runPostMatchLeagueSequence({ matchId: "match-2" });
    if (!("skipped" in second)) throw new Error("expected skipped");
    expect(second.reason).toBe("already-exists");
    expect(second.sequenceId).toBe(first.sequenceId);
    // Aucune nouvelle sequence creee.
    expect(state.sequences).toHaveLength(1);
  });

  it("dead players are excluded from pendingChoices even with high SPP", async () => {
    state.players = [
      {
        id: "ghost",
        teamId: "team-A",
        name: "Ghost",
        spp: 99, // largement assez
        skills: "",
        advancements: "[]",
        dead: true,
      },
    ];
    state.matches = [
      {
        id: "match-3",
        leagueSeasonId: "season-3",
        leagueScoredAt: new Date(),
        leaguePostMatchSequence: null,
        teamSelections: [{ teamId: "team-A" }, { teamId: "team-B" }],
      },
    ];

    const out = await runPostMatchLeagueSequence({ matchId: "match-3" });
    if (!("created" in out)) throw new Error("expected created");
    expect(out.pendingChoices).toHaveLength(0);
    expect(out.status).toBe("completed");
  });

  it("markSequenceCompletedIfDone keeps sequence open when at least one player has not advanced", async () => {
    state.players = [
      {
        id: "alpha",
        teamId: "team-A",
        name: "Alpha",
        spp: 6,
        skills: "",
        advancements: "[]",
        dead: false,
      },
      {
        id: "beta",
        teamId: "team-A",
        name: "Beta",
        spp: 6,
        skills: "",
        advancements: "[]",
        dead: false,
      },
    ];
    state.teams = [
      { id: "team-A", currentValue: 1000000 },
      { id: "team-B", currentValue: 1000000 },
    ];
    state.matches = [
      {
        id: "match-4",
        leagueSeasonId: "season-4",
        leagueScoredAt: new Date(),
        leaguePostMatchSequence: null,
        teamSelections: [{ teamId: "team-A" }, { teamId: "team-B" }],
      },
    ];

    const out = await runPostMatchLeagueSequence({ matchId: "match-4" });
    if (!("created" in out)) throw new Error("expected created");
    expect(out.pendingChoices).toHaveLength(2);

    // Apply advancement to only Alpha.
    await applyAdvancementChoice({
      teamId: "team-A",
      playerId: "alpha",
      type: "primary",
      skillSlug: "block",
    });

    // Sequence not yet closeable : Beta has not advanced.
    const closureAttempt = await markSequenceCompletedIfDone(out.sequenceId);
    expect(closureAttempt.closed).toBe(false);
    expect(closureAttempt.status).toBe("awaiting_choices");

    // Apply Beta -> sequence becomes closeable.
    await applyAdvancementChoice({
      teamId: "team-A",
      playerId: "beta",
      type: "primary",
      skillSlug: "dodge",
    });
    const closureFinal = await markSequenceCompletedIfDone(out.sequenceId);
    expect(closureFinal.closed).toBe(true);
    expect(closureFinal.status).toBe("completed");
  });
});
