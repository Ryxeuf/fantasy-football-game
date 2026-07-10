/**
 * Évolutions stagées sur la feuille de match : parse tolérant,
 * application à la validation (délégation applyAdvancementChoice) et
 * reversal à l'invalidation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    teamPlayer: { findUnique: vi.fn(), update: vi.fn() },
    team: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./post-match-league-sequence", () => ({
  applyAdvancementChoice: vi.fn(),
}));

import { prisma } from "../prisma";
import { applyAdvancementChoice } from "./post-match-league-sequence";
import {
  parseStagedAdvancements,
  applyStagedAdvancements,
  reverseAppliedAdvancements,
} from "./league-sheet-advancements";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockApply = applyAdvancementChoice as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  // $transaction exécute le callback avec un tx = prisma mocké.
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
  );
});

describe("parseStagedAdvancements", () => {
  it("accepte un array natif (PG) et une string JSON (sqlite)", () => {
    const entries = [
      { playerId: "p1", type: "primary", skillSlug: "block" },
      { playerId: "p2", type: "characteristic", stat: "ma", d8: 4 },
    ];
    expect(parseStagedAdvancements(entries)).toHaveLength(2);
    expect(parseStagedAdvancements(JSON.stringify(entries))).toHaveLength(2);
  });

  it("ignore null, garbage et entrées invalides", () => {
    expect(parseStagedAdvancements(null)).toEqual([]);
    expect(parseStagedAdvancements("not-json{")).toEqual([]);
    expect(
      parseStagedAdvancements([
        { playerId: "", type: "primary" },
        { playerId: "p1", type: "unknown-type" },
        "junk",
        { playerId: "ok", type: "secondary", skillSlug: "dodge" },
      ]),
    ).toEqual([
      expect.objectContaining({ playerId: "ok", type: "secondary" }),
    ]);
  });

  it("conserve les marqueurs applied/cost/skipReason", () => {
    const [e] = parseStagedAdvancements([
      { playerId: "p1", type: "primary", skillSlug: "block", applied: true, cost: 6 },
    ]);
    expect(e.applied).toBe(true);
    expect(e.cost).toBe(6);
  });
});

describe("applyStagedAdvancements", () => {
  it("applique chaque entrée et l'enrichit du coût PSP débité", async () => {
    mockApply.mockResolvedValue({
      applied: true,
      playerId: "p1",
      newSpp: 2,
      newAdvancementCount: 1, // 0 avancement avant → coût primary rang 1 = 6
      addedSkill: "block",
      currentValue: 1_000_000,
    });
    const out = await applyStagedAdvancements({
      teamId: "T1",
      entries: [{ playerId: "p1", type: "primary", skillSlug: "block" }],
    });
    expect(mockApply).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "T1",
        playerId: "p1",
        type: "primary",
        skillSlug: "block",
      }),
    );
    expect(out[0]).toMatchObject({ applied: true, cost: 6 });
  });

  it("marque skipReason sans bloquer quand le service refuse", async () => {
    mockApply
      .mockResolvedValueOnce({
        skipped: true,
        reason: "insufficient-spp",
        required: 6,
        available: 3,
      })
      .mockResolvedValueOnce({
        applied: true,
        playerId: "p2",
        newSpp: 0,
        newAdvancementCount: 2, // 1 avancement avant → random-primary rang 2 = 4
        addedSkill: "dodge",
        currentValue: 1,
      });
    const out = await applyStagedAdvancements({
      teamId: "T1",
      entries: [
        { playerId: "p1", type: "primary", skillSlug: "block" },
        {
          playerId: "p2",
          type: "random-primary",
          skillSlug: "dodge",
          category: "A",
        },
      ],
    });
    expect(out[0]).toMatchObject({
      applied: false,
      skipReason: "insufficient-spp",
    });
    expect(out[1]).toMatchObject({ applied: true, cost: 4 });
  });

  it("ne ré-applique pas une entrée déjà appliquée (idempotence)", async () => {
    const out = await applyStagedAdvancements({
      teamId: "T1",
      entries: [
        { playerId: "p1", type: "primary", skillSlug: "block", applied: true, cost: 6 },
      ],
    });
    expect(mockApply).not.toHaveBeenCalled();
    expect(out[0]).toMatchObject({ applied: true, cost: 6 });
  });
});

describe("reverseAppliedAdvancements", () => {
  const basePlayer = {
    id: "p1",
    teamId: "T1",
    spp: 2,
    skills: "dodge,block",
    advancements: JSON.stringify([
      { skillSlug: "block", type: "primary", isRandom: false, at: 1 },
    ]),
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
  };

  it("rembourse le PSP, retire la compétence et décrémente la VE", async () => {
    mockPrisma.teamPlayer.findUnique.mockResolvedValue(basePlayer);
    const out = await reverseAppliedAdvancements({
      teamId: "T1",
      entries: [
        { playerId: "p1", type: "primary", skillSlug: "block", applied: true, cost: 6 },
      ],
    });
    expect(mockPrisma.teamPlayer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1" },
        data: expect.objectContaining({
          spp: { increment: 6 },
          skills: "dodge",
          advancements: "[]",
        }),
      }),
    );
    expect(mockPrisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { currentValue: { decrement: expect.any(Number) } },
      }),
    );
    // Marqueurs nettoyés pour permettre une re-validation propre.
    expect(out[0].applied).toBeUndefined();
    expect(out[0].cost).toBeUndefined();
  });

  it("reverse une amélioration de caractéristique (ag : cible +1)", async () => {
    mockPrisma.teamPlayer.findUnique.mockResolvedValue({
      ...basePlayer,
      skills: "dodge",
      ag: 2, // améliorée 3+ → 2+
      advancements: JSON.stringify([
        { type: "characteristic", stat: "ag", d8: 6, isRandom: false, at: 1 },
      ]),
    });
    await reverseAppliedAdvancements({
      teamId: "T1",
      entries: [
        {
          playerId: "p1",
          type: "characteristic",
          stat: "ag",
          d8: 6,
          applied: true,
          cost: 14,
        },
      ],
    });
    expect(mockPrisma.teamPlayer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ spp: { increment: 14 }, ag: 3 }),
      }),
    );
  });

  it("ignore les entrées non appliquées et les joueurs introuvables", async () => {
    mockPrisma.teamPlayer.findUnique.mockResolvedValue(null);
    const out = await reverseAppliedAdvancements({
      teamId: "T1",
      entries: [
        { playerId: "p1", type: "primary", skillSlug: "block" }, // pas applied
        { playerId: "ghost", type: "primary", skillSlug: "block", applied: true },
      ],
    });
    expect(mockPrisma.teamPlayer.update).not.toHaveBeenCalled();
    expect(out).toHaveLength(2);
  });
});
