/**
 * L.4 — Tests du generateur de calendrier round-robin (Sprint 17).
 *
 * Fonction pure, aucune dependance Prisma.
 */

import { describe, it, expect } from "vitest";
import {
  generateRoundRobin,
  generateMultiPoolRoundRobin,
  type RoundRobinRound,
} from "./league-schedule";

function pairSignature(home: string, away: string): string {
  return [home, away].sort().join("|");
}

function allPairs(rounds: readonly RoundRobinRound[]): string[] {
  return rounds.flatMap((r) =>
    r.pairings.map((p) => pairSignature(p.home, p.away)),
  );
}

function countAppearancesPerTeam(
  rounds: readonly RoundRobinRound[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const round of rounds) {
    for (const pairing of round.pairings) {
      counts.set(pairing.home, (counts.get(pairing.home) ?? 0) + 1);
      counts.set(pairing.away, (counts.get(pairing.away) ?? 0) + 1);
    }
  }
  return counts;
}

describe("Rule: League round-robin schedule", () => {
  describe("input validation", () => {
    it("rejects fewer than 2 participants", () => {
      expect(() =>
        generateRoundRobin({ participantIds: [] }),
      ).toThrow(/deux|two|participants/i);
      expect(() =>
        generateRoundRobin({ participantIds: ["solo"] }),
      ).toThrow(/deux|two|participants/i);
    });

    it("rejects duplicate participant ids", () => {
      expect(() =>
        generateRoundRobin({ participantIds: ["a", "b", "a"] }),
      ).toThrow(/unique|duplicate|doublon/i);
    });
  });

  describe("even participant count (single round-robin)", () => {
    it("produces N-1 rounds with N/2 pairings each for 2 teams", () => {
      const rounds = generateRoundRobin({ participantIds: ["a", "b"] });

      expect(rounds).toHaveLength(1);
      expect(rounds[0].roundNumber).toBe(1);
      expect(rounds[0].pairings).toHaveLength(1);
      expect(rounds[0].bye).toBeNull();
      expect(pairSignature(rounds[0].pairings[0].home, rounds[0].pairings[0].away))
        .toBe("a|b");
    });

    it("produces 3 rounds of 2 pairings for 4 teams", () => {
      const rounds = generateRoundRobin({
        participantIds: ["a", "b", "c", "d"],
      });

      expect(rounds).toHaveLength(3);
      for (const round of rounds) {
        expect(round.pairings).toHaveLength(2);
        expect(round.bye).toBeNull();
      }
      expect(rounds.map((r) => r.roundNumber)).toEqual([1, 2, 3]);
    });

    it("has every pair of teams meet exactly once for 6 teams", () => {
      const teams = ["a", "b", "c", "d", "e", "f"];
      const rounds = generateRoundRobin({ participantIds: teams });

      expect(rounds).toHaveLength(5);

      const pairs = allPairs(rounds);
      const expectedPairCount = (teams.length * (teams.length - 1)) / 2;
      expect(pairs).toHaveLength(expectedPairCount);
      expect(new Set(pairs).size).toBe(expectedPairCount);
    });

    it("each team plays exactly once per round", () => {
      const teams = ["a", "b", "c", "d", "e", "f"];
      const rounds = generateRoundRobin({ participantIds: teams });

      for (const round of rounds) {
        const teamsThisRound = new Set<string>();
        for (const pairing of round.pairings) {
          expect(teamsThisRound.has(pairing.home)).toBe(false);
          expect(teamsThisRound.has(pairing.away)).toBe(false);
          teamsThisRound.add(pairing.home);
          teamsThisRound.add(pairing.away);
        }
        expect(teamsThisRound.size).toBe(teams.length);
      }
    });
  });

  describe("odd participant count (bye handling)", () => {
    it("produces N rounds with one bye per round for 3 teams", () => {
      const rounds = generateRoundRobin({
        participantIds: ["a", "b", "c"],
      });

      expect(rounds).toHaveLength(3);
      for (const round of rounds) {
        expect(round.pairings).toHaveLength(1);
        expect(round.bye).not.toBeNull();
      }

      const byes = rounds.map((r) => r.bye).sort();
      expect(byes).toEqual(["a", "b", "c"]);
    });

    it("each team plays N-1 matches and has exactly 1 bye for 5 teams", () => {
      const teams = ["a", "b", "c", "d", "e"];
      const rounds = generateRoundRobin({ participantIds: teams });

      expect(rounds).toHaveLength(5);

      const counts = countAppearancesPerTeam(rounds);
      for (const team of teams) {
        expect(counts.get(team)).toBe(teams.length - 1);
      }

      const byes = rounds.map((r) => r.bye);
      expect(byes.filter((b) => b !== null)).toHaveLength(teams.length);
      expect(new Set(byes)).toEqual(new Set(teams));
    });

    it("every pair of teams meets exactly once for 5 teams", () => {
      const teams = ["a", "b", "c", "d", "e"];
      const rounds = generateRoundRobin({ participantIds: teams });
      const pairs = allPairs(rounds);
      const expected = (teams.length * (teams.length - 1)) / 2;
      expect(pairs).toHaveLength(expected);
      expect(new Set(pairs).size).toBe(expected);
    });
  });

  describe("determinism", () => {
    it("returns the same schedule for the same input", () => {
      const input = { participantIds: ["a", "b", "c", "d"] };
      const first = generateRoundRobin(input);
      const second = generateRoundRobin(input);
      expect(first).toEqual(second);
    });

    it("input order influences home/away assignment", () => {
      const a = generateRoundRobin({ participantIds: ["a", "b"] });
      const b = generateRoundRobin({ participantIds: ["b", "a"] });
      // same pair, but the canonical pair signature must match
      expect(pairSignature(a[0].pairings[0].home, a[0].pairings[0].away)).toBe(
        pairSignature(b[0].pairings[0].home, b[0].pairings[0].away),
      );
    });
  });

  describe("home/away balance", () => {
    it("double round-robin gives each team exactly (N-1) home and (N-1) away games", () => {
      const teams = ["a", "b", "c", "d"];
      const rounds = generateRoundRobin({
        participantIds: teams,
        doubleRoundRobin: true,
      });
      const homeCounts = new Map<string, number>();
      const awayCounts = new Map<string, number>();
      for (const round of rounds) {
        for (const pairing of round.pairings) {
          homeCounts.set(
            pairing.home,
            (homeCounts.get(pairing.home) ?? 0) + 1,
          );
          awayCounts.set(
            pairing.away,
            (awayCounts.get(pairing.away) ?? 0) + 1,
          );
        }
      }
      for (const team of teams) {
        expect(homeCounts.get(team) ?? 0).toBe(teams.length - 1);
        expect(awayCounts.get(team) ?? 0).toBe(teams.length - 1);
      }
    });
  });

  describe("double round-robin (home and away)", () => {
    it("produces 2*(N-1) rounds and meets every pair exactly twice", () => {
      const teams = ["a", "b", "c", "d"];
      const rounds = generateRoundRobin({
        participantIds: teams,
        doubleRoundRobin: true,
      });

      expect(rounds).toHaveLength(2 * (teams.length - 1));

      const pairSignatures = rounds.flatMap((r) =>
        r.pairings.map((p) => pairSignature(p.home, p.away)),
      );
      const expected = teams.length * (teams.length - 1);
      expect(pairSignatures).toHaveLength(expected);

      const perPair = new Map<string, number>();
      for (const sig of pairSignatures) {
        perPair.set(sig, (perPair.get(sig) ?? 0) + 1);
      }
      for (const count of perPair.values()) {
        expect(count).toBe(2);
      }
    });

    it("reverses home/away in the second half", () => {
      const teams = ["a", "b", "c", "d"];
      const rounds = generateRoundRobin({
        participantIds: teams,
        doubleRoundRobin: true,
      });

      const firstLeg = rounds.slice(0, teams.length - 1);
      const secondLeg = rounds.slice(teams.length - 1);

      for (let i = 0; i < firstLeg.length; i += 1) {
        const firstPairs = firstLeg[i].pairings.map((p) => `${p.home}-${p.away}`);
        const secondPairs = secondLeg[i].pairings.map(
          (p) => `${p.away}-${p.home}`,
        );
        expect(new Set(firstPairs)).toEqual(new Set(secondPairs));
      }
    });

    it("continues round numbers past the first leg", () => {
      const teams = ["a", "b", "c", "d"];
      const rounds = generateRoundRobin({
        participantIds: teams,
        doubleRoundRobin: true,
      });
      expect(rounds.map((r) => r.roundNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe("priority teams (use case: Open 5 Teams league)", () => {
    it("schedules 5 priority teams with exactly one bye per team", () => {
      const priorityRosters = [
        "skaven",
        "gnome",
        "lizardmen",
        "dwarf",
        "imperial_nobility",
      ];
      const rounds = generateRoundRobin({ participantIds: priorityRosters });

      expect(rounds).toHaveLength(priorityRosters.length);
      const byes = rounds.map((r) => r.bye).filter((b): b is string => b !== null);
      expect(byes).toHaveLength(priorityRosters.length);
      expect(new Set(byes)).toEqual(new Set(priorityRosters));

      const totalPairings = rounds.reduce(
        (acc, r) => acc + r.pairings.length,
        0,
      );
      // 5 teams: 10 unique pairs to play
      expect(totalPairings).toBe(10);
    });
  });
});

// ─── Lot C.2 — multi-poules ───────────────────────────────────────────

describe("generateMultiPoolRoundRobin (Lot C.2)", () => {
  it("throws when no pools", () => {
    expect(() =>
      generateMultiPoolRoundRobin({ pools: [] }),
    ).toThrow(/au moins une poule/i);
  });

  it("throws when a participant is in two pools", () => {
    expect(() =>
      generateMultiPoolRoundRobin({
        pools: [
          { poolId: "A", participantIds: ["p1", "p2"] },
          { poolId: "B", participantIds: ["p2", "p3"] },
        ],
      }),
    ).toThrow(/plusieurs poules/i);
  });

  it("merges two equal pools into shared matchdays", () => {
    const rounds = generateMultiPoolRoundRobin({
      pools: [
        { poolId: "A", participantIds: ["a1", "a2", "a3", "a4"] },
        { poolId: "B", participantIds: ["b1", "b2", "b3", "b4"] },
      ],
    });
    // 4 teams per pool -> 3 rounds each -> 3 shared matchdays.
    expect(rounds).toHaveLength(3);
    // Each matchday: 2 pairings from A + 2 from B = 4 pairings.
    for (const r of rounds) {
      expect(r.pairings).toHaveLength(4);
    }
    // Total unique pairs: 6 per pool * 2 = 12.
    const total = rounds.reduce((acc, r) => acc + r.pairings.length, 0);
    expect(total).toBe(12);
  });

  it("never crosses pools (a pairing always stays intra-pool)", () => {
    const rounds = generateMultiPoolRoundRobin({
      pools: [
        { poolId: "A", participantIds: ["a1", "a2", "a3", "a4"] },
        { poolId: "B", participantIds: ["b1", "b2", "b3", "b4"] },
      ],
    });
    for (const r of rounds) {
      for (const p of r.pairings) {
        const homePool = p.home.startsWith("a") ? "A" : "B";
        const awayPool = p.away.startsWith("a") ? "A" : "B";
        expect(homePool).toBe(awayPool);
      }
    }
  });

  it("handles uneven pool sizes (matchday count = max over pools)", () => {
    const rounds = generateMultiPoolRoundRobin({
      pools: [
        { poolId: "A", participantIds: ["a1", "a2", "a3", "a4"] }, // 3 rounds
        { poolId: "B", participantIds: ["b1", "b2"] }, // 1 round
      ],
    });
    expect(rounds).toHaveLength(3);
    // Matchday 1 has A(2) + B(1) = 3 pairings ; matchday 2,3 only A(2).
    expect(rounds[0].pairings).toHaveLength(3);
    expect(rounds[1].pairings).toHaveLength(2);
    expect(rounds[2].pairings).toHaveLength(2);
  });

  it("ignores pools with fewer than 2 participants", () => {
    const rounds = generateMultiPoolRoundRobin({
      pools: [
        { poolId: "A", participantIds: ["a1", "a2"] },
        { poolId: "B", participantIds: ["solo"] },
      ],
    });
    expect(rounds).toHaveLength(1);
    expect(rounds[0].pairings).toHaveLength(1);
    expect(rounds[0].pairings[0]).toEqual(
      expect.objectContaining({}),
    );
  });

  it("supports doubleRoundRobin per pool", () => {
    const rounds = generateMultiPoolRoundRobin({
      pools: [
        { poolId: "A", participantIds: ["a1", "a2", "a3", "a4"] },
        { poolId: "B", participantIds: ["b1", "b2", "b3", "b4"] },
      ],
      doubleRoundRobin: true,
    });
    // 4 teams -> 6 rounds (double) per pool -> 6 matchdays.
    expect(rounds).toHaveLength(6);
    const total = rounds.reduce((acc, r) => acc + r.pairings.length, 0);
    // 12 pairs per pool * 2 pools = 24.
    expect(total).toBe(24);
  });

  it("is deterministic (same input -> same output)", () => {
    const input = {
      pools: [
        { poolId: "A", participantIds: ["a1", "a2", "a3", "a4"] },
        { poolId: "B", participantIds: ["b1", "b2", "b3"] },
      ],
    };
    const a = generateMultiPoolRoundRobin(input);
    const b = generateMultiPoolRoundRobin(input);
    expect(a).toEqual(b);
  });
});
