import { describe, expect, it } from "vitest";

import { DEFAULT_TACTICAL_PROFILE, PRO_LEAGUE_TEAM_BY_ID } from "@bb/sim-engine";

import {
  coachNameFor,
  describePhilosophy,
  parseStoredChanges,
  parseStoredMemory,
  parseStoredProfile,
  summarizeEvolution,
} from "./pro-coach-profile";

describe("coachNameFor", () => {
  it("est déterministe et distingue deux équipes", () => {
    expect(coachNameFor("pit-smashers")).toBe(coachNameFor("pit-smashers"));
    expect(coachNameFor("pit-smashers")).not.toBe(coachNameFor("kc-soaring-hawks"));
    expect(coachNameFor("pit-smashers")).toMatch(/^\S+ \S+$/);
  });
});

describe("describePhilosophy", () => {
  it("« Équilibré » pour le profil neutre, deux traits sinon", () => {
    expect(describePhilosophy(DEFAULT_TACTICAL_PROFILE)).toBe("Équilibré");
    const orc = describePhilosophy(PRO_LEAGUE_TEAM_BY_ID["pit-smashers"].tactics);
    expect(orc.split(", ")).toHaveLength(2);
    expect(describePhilosophy({ ...DEFAULT_TACTICAL_PROFILE, bashIndex: 90 })).toBe("Cogneur");
    expect(describePhilosophy({ ...DEFAULT_TACTICAL_PROFILE, bashIndex: 90, pace: 20 })).toBe("Cogneur, posé");
  });
});

describe("parseStored*", () => {
  it("relit un profil en objet natif (PG) ou en chaîne (SQLite), repli sinon", () => {
    const p = { ...DEFAULT_TACTICAL_PROFILE, bashIndex: 70 };
    expect(parseStoredProfile(p)).toEqual(p);
    expect(parseStoredProfile(JSON.stringify(p))).toEqual(p);
    expect(parseStoredProfile({ bashIndex: 70 })).toEqual(p);
    expect(parseStoredProfile(null)).toEqual(DEFAULT_TACTICAL_PROFILE);
    expect(parseStoredProfile("{oops")).toEqual(DEFAULT_TACTICAL_PROFILE);
    expect(parseStoredProfile({ bashIndex: 999 }, p)).toEqual(p);
  });

  it("relit une mémoire et ignore les entrées malformées", () => {
    const m = parseStoredMemory(JSON.stringify({ strategies: { stall: { ema: 0.4, samples: 3 }, bad: { ema: "x" } } }));
    expect(m.strategies).toEqual({ stall: { ema: 0.4, samples: 3 } });
    expect(parseStoredMemory(null).strategies).toEqual({});
    expect(parseStoredMemory("[]").strategies).toEqual({});
  });

  it("relit les changements et saute ceux sans nombre", () => {
    const raw = [
      { parameter: "pace", before: 50, after: 52, reason: "r" },
      { parameter: "pace", before: "x", after: 52 },
    ];
    expect(parseStoredChanges(raw)).toEqual([{ parameter: "pace", before: 50, after: 52, reason: "r" }]);
    expect(parseStoredChanges(JSON.stringify(raw))).toHaveLength(1);
    expect(parseStoredChanges(null)).toEqual([]);
  });
});

describe("summarizeEvolution", () => {
  const drives = [
    { team: "A" as const, half: 1, strategy: "stall" as const, possession: true, outcome: "td" as const, turnovers: 1, turns: 5 },
    { team: "A" as const, half: 2, strategy: "cage-build" as const, possession: false, outcome: "conceded" as const, turnovers: 0, turns: 4 },
  ];

  it("compte drives, TD, encaissés, turnovers et cite les plus gros ajustements", () => {
    const s = summarizeEvolution(drives, [
      { parameter: "stallTendency", before: 60, after: 62, reason: "« stall » rapporte" },
      { parameter: "pace", before: 50, after: 49, reason: "rappel vers l'ancre" },
    ]);
    expect(s).toContain("2 drives, 1 TD marqué, 1 encaissé, 1 turnover.");
    expect(s).toContain("stallTendency +2");
    expect(s).not.toContain("pace");
  });

  it("dit quand rien n'est retenu", () => {
    expect(summarizeEvolution(drives, [])).toContain("ne retient rien de nouveau");
  });
});
