import { describe, expect, it } from "vitest";

import {
  type DetectStorylinesInput,
  type MatchSnapshot,
  type PriorMatchupCounts,
  type StandingEntry,
  detectStorylines,
  matchupKey,
} from "./pro-storyline-detector";

function match(over: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    id: "m1",
    homeTeamSlug: "home",
    homeTeamName: "Home",
    awayTeamSlug: "away",
    awayTeamName: "Away",
    scoreHome: 2,
    scoreAway: 1,
    outcome: "home",
    touchdownCount: 3,
    casualtyCount: 1,
    nuffleCount: 1,
    playedAt: "2026-09-01T21:00:00Z",
    ...over,
  };
}

function standing(over: Partial<StandingEntry> = {}): StandingEntry {
  return {
    teamSlug: "team_x",
    teamName: "Team X",
    played: 5,
    wins: 3,
    draws: 0,
    losses: 2,
    points: 9,
    rank: 5,
    ...over,
  };
}

function emptyInput(over: Partial<DetectStorylinesInput> = {}): DetectStorylinesInput {
  return { matches: [], standings: [], ...over };
}

describe("matchupKey — sprint 1.E.3", () => {
  it("ordre alphabétique stable", () => {
    expect(matchupKey("buf", "kc")).toBe("buf|kc");
    expect(matchupKey("kc", "buf")).toBe("buf|kc");
  });
});

describe("detectStorylines — sprint 1.E.3", () => {
  it("[] sur input vide", () => {
    expect(detectStorylines(emptyInput())).toEqual([]);
  });

  it("season_top sur leader (rank=1)", () => {
    const out = detectStorylines(
      emptyInput({
        standings: [
          standing({ teamSlug: "buf", teamName: "Buffalo", rank: 1, points: 12 }),
          standing({ teamSlug: "kc", rank: 2, points: 9 }),
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("season_top");
    expect(out[0].refs.teamName).toBe("Buffalo");
  });

  it("blowout sur écart ≥ 4 TDs", () => {
    const out = detectStorylines(
      emptyInput({
        matches: [
          match({ scoreHome: 5, scoreAway: 1, outcome: "home" }),
        ],
      }),
    );
    expect(out.some((s) => s.type === "blowout")).toBe(true);
    const blowout = out.find((s) => s.type === "blowout");
    expect(blowout?.refs.scoreHome).toBe(5);
  });

  it("narrow sur 1 TD d'écart ou nul", () => {
    const out1 = detectStorylines(
      emptyInput({
        matches: [match({ scoreHome: 3, scoreAway: 2, outcome: "home" })],
      }),
    );
    expect(out1.some((s) => s.type === "narrow")).toBe(true);

    const out2 = detectStorylines(
      emptyInput({
        matches: [match({ scoreHome: 2, scoreAway: 2, outcome: "draw" })],
      }),
    );
    expect(out2.some((s) => s.type === "narrow")).toBe(true);
  });

  it("upset : favori (>70% V) perd contre underdog (<50% V)", () => {
    const out = detectStorylines({
      matches: [
        match({
          homeTeamSlug: "buf",
          homeTeamName: "Buffalo",
          awayTeamSlug: "kc",
          awayTeamName: "KC",
          scoreHome: 2,
          scoreAway: 1,
          outcome: "home",
        }),
      ],
      standings: [
        standing({
          teamSlug: "buf",
          teamName: "Buffalo",
          played: 5,
          wins: 1,
          losses: 4, // 20% V
        }),
        standing({
          teamSlug: "kc",
          teamName: "KC",
          played: 5,
          wins: 4,
          losses: 1, // 80% V
        }),
      ],
    });
    expect(out.some((s) => s.type === "upset")).toBe(true);
  });

  it("ne détecte pas upset si écart de standings insuffisant", () => {
    const out = detectStorylines({
      matches: [match({ outcome: "home" })],
      standings: [
        standing({ teamSlug: "home", played: 5, wins: 3, losses: 2 }),
        standing({ teamSlug: "away", played: 5, wins: 3, losses: 2 }),
      ],
    });
    expect(out.some((s) => s.type === "upset")).toBe(false);
  });

  it("record_td sur ≥6 TDs", () => {
    const out = detectStorylines(
      emptyInput({
        matches: [match({ scoreHome: 4, scoreAway: 3 })],
      }),
    );
    expect(out.some((s) => s.type === "record_td")).toBe(true);
  });

  it("bloodbath sur ≥4 casualties", () => {
    const out = detectStorylines(
      emptyInput({
        matches: [match({ casualtyCount: 5 })],
      }),
    );
    expect(out.some((s) => s.type === "bloodbath")).toBe(true);
  });

  it("nuffle_chaos sur ≥3 events Nuffle", () => {
    const out = detectStorylines(
      emptyInput({
        matches: [match({ nuffleCount: 4 })],
      }),
    );
    expect(out.some((s) => s.type === "nuffle_chaos")).toBe(true);
  });

  it("rivalry_buildup sur ≥3 matchups", () => {
    const priorMatchups = new Map();
    priorMatchups.set(matchupKey("home", "away"), {
      count: 3,
      firstAt: "2026-08-01T00:00:00Z",
    });
    const out = detectStorylines(
      emptyInput({
        matches: [match()],
        priorMatchups,
      }),
    );
    expect(out.some((s) => s.type === "rivalry_buildup")).toBe(true);
  });

  it("ne détecte pas rivalry si <3 matchups", () => {
    const priorMatchups = new Map();
    priorMatchups.set(matchupKey("home", "away"), {
      count: 2,
      firstAt: "2026-08-01T00:00:00Z",
    });
    const out = detectStorylines(
      emptyInput({
        matches: [match()],
        priorMatchups,
      }),
    );
    expect(out.some((s) => s.type === "rivalry_buildup")).toBe(false);
  });

  it("trie par weight desc (upset > blowout > narrow)", () => {
    const out = detectStorylines({
      matches: [
        match({
          id: "m_blowout",
          scoreHome: 5,
          scoreAway: 1,
          outcome: "home",
        }),
      ],
      standings: [
        standing({ teamSlug: "home", played: 5, wins: 1, losses: 4 }),
        standing({ teamSlug: "away", played: 5, wins: 4, losses: 1 }),
      ],
    });
    // upset weight=90, blowout weight=80+
    expect(out[0].type).toBe("upset");
    expect(out[1].type).toBe("blowout");
  });

  it("un même match peut générer plusieurs storylines (blowout + bloodbath)", () => {
    const out = detectStorylines(
      emptyInput({
        matches: [
          match({
            scoreHome: 5,
            scoreAway: 1,
            outcome: "home",
            casualtyCount: 5,
          }),
        ],
      }),
    );
    expect(out.some((s) => s.type === "blowout")).toBe(true);
    expect(out.some((s) => s.type === "bloodbath")).toBe(true);
  });
});

// Q.A.4 — Tests enrichissement rivalry_buildup
describe("rivalry_buildup enrichi — Q.A.4", () => {
  it("inclut suggestedPersona statistician dans les refs", () => {
    const matchups = new Map<string, PriorMatchupCounts>([
      [matchupKey("buf", "kc"), { count: 3, firstAt: "2026-08-25" }],
    ]);
    const out = detectStorylines(
      emptyInput({
        matches: [
          match({ homeTeamSlug: "buf", awayTeamSlug: "kc" }),
        ],
        priorMatchups: matchups,
      }),
    );
    const r = out.find((s) => s.type === "rivalry_buildup");
    expect(r).toBeTruthy();
    expect(r?.refs.suggestedPersona).toBe("statistician");
  });

  it("inclut bilan W-D-L quand fourni", () => {
    const matchups = new Map<string, PriorMatchupCounts>([
      [
        matchupKey("buf", "kc"),
        {
          count: 3,
          firstAt: "2026-08-25",
          winsHome: 2,
          winsAway: 0,
          draws: 1,
        },
      ],
    ]);
    const out = detectStorylines(
      emptyInput({
        matches: [
          match({
            homeTeamSlug: "buf",
            homeTeamName: "Buffalo",
            awayTeamSlug: "kc",
            awayTeamName: "KC",
          }),
        ],
        priorMatchups: matchups,
      }),
    );
    const r = out.find((s) => s.type === "rivalry_buildup");
    expect(r?.refs.winsHome).toBe(2);
    expect(r?.refs.winsAway).toBe(0);
    expect(r?.refs.drawsHistorical).toBe(1);
    expect(r?.summary).toMatch(/2-1-0/);
    expect(r?.summary).toMatch(/Buffalo/);
  });

  it("weight=90 quand streak >= 2 (rivalry qui chauffe)", () => {
    const matchups = new Map<string, PriorMatchupCounts>([
      [
        matchupKey("buf", "kc"),
        {
          count: 3,
          firstAt: "2026-08-25",
          streakKind: "win",
          streakLength: 2,
        },
      ],
    ]);
    const out = detectStorylines(
      emptyInput({
        matches: [match({ homeTeamSlug: "buf", awayTeamSlug: "kc" })],
        priorMatchups: matchups,
      }),
    );
    const r = out.find((s) => s.type === "rivalry_buildup");
    expect(r?.weight).toBe(90);
  });

  it("weight=85 quand streak < 2 (rivalry standard)", () => {
    const matchups = new Map<string, PriorMatchupCounts>([
      [
        matchupKey("buf", "kc"),
        {
          count: 3,
          firstAt: "2026-08-25",
          streakKind: "win",
          streakLength: 1,
        },
      ],
    ]);
    const out = detectStorylines(
      emptyInput({
        matches: [match({ homeTeamSlug: "buf", awayTeamSlug: "kc" })],
        priorMatchups: matchups,
      }),
    );
    const r = out.find((s) => s.type === "rivalry_buildup");
    expect(r?.weight).toBe(85);
  });

  it("inclut streak dans les refs", () => {
    const matchups = new Map<string, PriorMatchupCounts>([
      [
        matchupKey("buf", "kc"),
        {
          count: 3,
          firstAt: "2026-08-25",
          streakKind: "loss",
          streakLength: 2,
        },
      ],
    ]);
    const out = detectStorylines(
      emptyInput({
        matches: [match({ homeTeamSlug: "buf", awayTeamSlug: "kc" })],
        priorMatchups: matchups,
      }),
    );
    const r = out.find((s) => s.type === "rivalry_buildup");
    expect(r?.refs.streakKind).toBe("loss");
    expect(r?.refs.streakLength).toBe(2);
  });

  it("retro-compat : marche sans W-D-L ni streak (signature pre-Q.A.4)", () => {
    const matchups = new Map<string, PriorMatchupCounts>([
      [matchupKey("buf", "kc"), { count: 3, firstAt: "2026-08-25" }],
    ]);
    const out = detectStorylines(
      emptyInput({
        matches: [match({ homeTeamSlug: "buf", awayTeamSlug: "kc" })],
        priorMatchups: matchups,
      }),
    );
    const r = out.find((s) => s.type === "rivalry_buildup");
    expect(r).toBeTruthy();
    // Pas de winsHome / streakKind si pas fourni
    expect(r?.refs.winsHome).toBeUndefined();
    expect(r?.refs.streakKind).toBeUndefined();
    expect(r?.weight).toBe(85);
  });
});
