import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proCoach: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn((args: unknown) => args) },
    proCoachMemory: { findMany: vi.fn(), create: vi.fn((args: unknown) => args) },
    proTeam: { findUnique: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { PRO_LEAGUE_TEAM_BY_ID, type DriveRecord } from "@bb/sim-engine";

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

import {
  ProCoachError,
  applyPostMatchAdaptation,
  applyPostMatchEvolution,
  ensureProCoach,
  getCoachProfile,
  resetCoach,
  updateCoachByAdmin,
} from "./pro-coach";

const mocked = prisma as unknown as {
  proCoach: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  proCoachMemory: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  proTeam: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const ORC = PRO_LEAGUE_TEAM_BY_ID["pit-smashers"].tactics;

function coachRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "coach-1",
    teamId: "team-1",
    name: "Grishnak Ironjaw",
    philosophy: "Cogneur, patient",
    profile: ORC,
    anchorProfile: ORC,
    memory: { strategies: {} },
    experience: 0,
    createdAt: new Date("2026-10-01"),
    updatedAt: new Date("2026-10-01"),
    ...overrides,
  };
}

function drive(overrides: Partial<DriveRecord> = {}): DriveRecord {
  return { team: "A", half: 1, strategy: "stall", possession: true, outcome: "td", turnovers: 0, turns: 5, ...overrides };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.proCoach.update.mockImplementation((args: unknown) => args);
  mocked.proCoachMemory.create.mockImplementation((args: unknown) => args);
  mocked.$transaction.mockImplementation(async (ops: unknown[]) => ops);
});

describe("ensureProCoach", () => {
  it("rend le coach existant sans le recréer", async () => {
    mocked.proCoach.findUnique.mockResolvedValue(coachRow({ profile: JSON.stringify({ ...ORC, pace: 70 }) }));
    const coach = await ensureProCoach("team-1");
    expect(coach.profile.pace).toBe(70);
    expect(coach.anchorProfile).toEqual(ORC);
    expect(mocked.proCoach.create).not.toHaveBeenCalled();
  });

  it("crée le coach depuis le profil de race, ancre = profil", async () => {
    mocked.proCoach.findUnique.mockResolvedValue(null);
    mocked.proTeam.findUnique.mockResolvedValue({ id: "team-1", slug: "pit-smashers" });
    mocked.proCoach.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      coachRow({ ...data }),
    );
    const coach = await ensureProCoach("team-1");
    expect(mocked.proCoach.create).toHaveBeenCalledTimes(1);
    const data = mocked.proCoach.create.mock.calls[0][0].data;
    expect(data.profile).toEqual(ORC);
    expect(data.anchorProfile).toEqual(ORC);
    expect(data.experience).toBe(0);
    expect(typeof data.name).toBe("string");
    expect(coach.philosophy.length).toBeGreaterThan(0);
    expect(await getCoachProfile("team-1")).toEqual(ORC);
  });

  it("équipe inconnue → ProCoachError team-not-found", async () => {
    mocked.proCoach.findUnique.mockResolvedValue(null);
    mocked.proTeam.findUnique.mockResolvedValue(null);
    await expect(ensureProCoach("nope")).rejects.toBeInstanceOf(ProCoachError);
  });
});

describe("applyPostMatchAdaptation", () => {
  it("persiste le profil adapté, la mémoire, l'expérience et une ligne append-only", async () => {
    mocked.proCoach.findUnique.mockResolvedValue(
      coachRow({ memory: { strategies: { stall: { ema: 0.9, samples: 4 } } } }),
    );
    const out = await applyPostMatchAdaptation({
      teamId: "team-1",
      matchId: "match-1",
      drives: [drive({ strategy: "stall", outcome: "td" })],
    });
    expect(out.changes.some((c) => c.parameter === "stallTendency" && c.after > c.before)).toBe(true);
    expect(out.summary).toContain("1 drive");
    const update = mocked.proCoach.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "coach-1" });
    expect(update.data.experience).toEqual({ increment: 1 });
    expect(update.data.memory.strategies.stall.samples).toBe(5);
    expect(update.data.profile.stallTendency).toBe(ORC.stallTendency + 2);
    const memory = mocked.proCoachMemory.create.mock.calls[0][0];
    expect(memory.data).toMatchObject({ coachId: "coach-1", matchId: "match-1", profileBefore: ORC });
    expect(memory.data.profileAfter.stallTendency).toBe(ORC.stallTendency + 2);
    expect(mocked.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("applyPostMatchEvolution", () => {
  it("isole chaque côté : un échec est journalisé, l'autre côté passe", async () => {
    mocked.proCoach.findUnique
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(coachRow({ id: "coach-2", teamId: "team-2" }));
    await applyPostMatchEvolution({
      matchId: "match-1",
      homeTeamId: "team-1",
      awayTeamId: "team-2",
      drives: [drive({ team: "A" }), drive({ team: "B", outcome: "conceded", possession: false })],
    });
    expect(vi.mocked(serverLog.error)).toHaveBeenCalledTimes(1);
    expect(mocked.proCoachMemory.create).toHaveBeenCalledTimes(1);
    const memory = mocked.proCoachMemory.create.mock.calls[0][0];
    expect(memory.data.coachId).toBe("coach-2");
    expect(memory.data.drives).toHaveLength(1);
    expect(memory.data.drives[0].team).toBe("B");
  });
});

describe("updateCoachByAdmin / resetCoach", () => {
  it("un profil partiel redéfinit l'ancre ET le profil vivant, et redérive la philosophie", async () => {
    mocked.proCoach.findUnique.mockResolvedValue(coachRow({ profile: { ...ORC, pace: 70 } }));
    mocked.proCoach.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      coachRow({ ...data }),
    );
    const coach = await updateCoachByAdmin("team-1", { profile: { bashIndex: 95 }, name: "Ugluk" });
    const data = mocked.proCoach.update.mock.calls[0][0].data;
    expect(data.anchorProfile.bashIndex).toBe(95);
    expect(data.profile).toEqual(data.anchorProfile);
    expect(data.profile.pace).toBe(ORC.pace);
    expect(data.name).toBe("Ugluk");
    expect(typeof data.philosophy).toBe("string");
    expect(coach.name).toBe("Ugluk");
  });

  it("reset : retour au profil de race, mémoire vidée, ligne de journal", async () => {
    mocked.proCoach.findUnique.mockResolvedValue(
      coachRow({ profile: { ...ORC, pace: 70 }, anchorProfile: { ...ORC, pace: 65 }, experience: 12 }),
    );
    mocked.proTeam.findUnique.mockResolvedValue({ slug: "pit-smashers" });
    mocked.proCoach.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => coachRow({ ...data }));
    mocked.$transaction.mockImplementation(async (ops: unknown[]) => ops);
    const coach = await resetCoach("team-1");
    const data = mocked.proCoach.update.mock.calls[0][0].data;
    expect(data.profile).toEqual(ORC);
    expect(data.anchorProfile).toEqual(ORC);
    expect(data.experience).toBe(0);
    expect(data.memory).toEqual({ strategies: {} });
    expect(mocked.proCoachMemory.create.mock.calls[0][0].data.matchId).toBeNull();
    expect(coach.experience).toBe(0);
  });
});
