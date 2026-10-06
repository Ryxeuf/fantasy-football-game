import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeamRoster: { findMany: vi.fn(), update: vi.fn((args: unknown) => args) },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

import { prisma } from "../prisma";

import {
  applyMatchFormToRosters,
  computeRosterFormUpdates,
  nextRosterForm,
} from "./pro-roster-form";

const mocked = prisma as unknown as {
  proTeamRoster: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("nextRosterForm (pur)", () => {
  it("hot +15, cold −15, bornés à [0, 100]", () => {
    expect(nextRosterForm(50, "hot")).toBe(65);
    expect(nextRosterForm(50, "cold")).toBe(35);
    expect(nextRosterForm(95, "hot")).toBe(100);
    expect(nextRosterForm(5, "cold")).toBe(0);
  });

  it("sans signal, revient vers 50 de 5 points sans le dépasser", () => {
    expect(nextRosterForm(80, "normal")).toBe(75);
    expect(nextRosterForm(20, undefined)).toBe(25);
    expect(nextRosterForm(52, undefined)).toBe(50);
    expect(nextRosterForm(50, "normal")).toBe(50);
  });
});

describe("computeRosterFormUpdates (pur)", () => {
  it("ne rend que les joueurs dont la forme change", () => {
    const out = computeRosterFormUpdates(
      [
        { id: "p1", form: 50 },
        { id: "p2", form: 50 },
        { id: "p3", form: 70 },
      ],
      [
        { playerId: "p1", state: "hot", touchdowns: 1, successfulBlocks: 0, failureStreak: 0 },
        { playerId: "p2", state: "normal", touchdowns: 0, successfulBlocks: 0, failureStreak: 0 },
      ],
    );
    expect(out).toEqual([
      { id: "p1", before: 50, after: 65 },
      { id: "p3", before: 70, after: 65 },
    ]);
  });
});

describe("applyMatchFormToRosters", () => {
  it("charge les actifs des deux équipes et écrit les formes en une transaction", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([
      { id: "p1", form: 50 },
      { id: "p2", form: null },
    ]);
    const n = await applyMatchFormToRosters({
      teamIds: ["t1", "t2"],
      momentum: [{ playerId: "p1", state: "cold", touchdowns: 0, successfulBlocks: 0, failureStreak: 3 }],
    });
    expect(n).toBe(1);
    expect(mocked.proTeamRoster.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teamId: { in: ["t1", "t2"] }, status: "active" } }),
    );
    expect(mocked.proTeamRoster.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { form: 35 } });
    expect(mocked.$transaction).toHaveBeenCalledTimes(1);
  });

  it("n'ouvre pas de transaction quand rien ne change", async () => {
    mocked.proTeamRoster.findMany.mockResolvedValue([{ id: "p1", form: 50 }]);
    const n = await applyMatchFormToRosters({ teamIds: ["t1"], momentum: [] });
    expect(n).toBe(0);
    expect(mocked.$transaction).not.toHaveBeenCalled();
  });
});
