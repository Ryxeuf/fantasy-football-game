/**
 * Calendrier nflverse (`games.csv`) : conversion des coups d'envoi en UTC
 * et creation des matchs programmes, base du verrouillage des lineups au
 * coup d'envoi.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflGame: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    nflWeek: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  backfillScoresFromSchedules,
  easternUtcOffset,
  parseScheduleDate,
  parseSchedulesCsv,
} from "./nfl-ingest";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("easternUtcOffset", () => {
  it("heure d'ete du 2e dimanche de mars au 1er dimanche de novembre", () => {
    // 2026 : DST du dim. 08/03 au dim. 01/11.
    expect(easternUtcOffset("2026-03-07")).toBe("-05:00");
    expect(easternUtcOffset("2026-03-08")).toBe("-04:00");
    expect(easternUtcOffset("2026-09-10")).toBe("-04:00");
    expect(easternUtcOffset("2026-10-31")).toBe("-04:00");
    expect(easternUtcOffset("2026-11-01")).toBe("-05:00");
    expect(easternUtcOffset("2026-12-25")).toBe("-05:00");
    expect(easternUtcOffset("2027-02-14")).toBe("-05:00");
  });
});

describe("parseScheduleDate", () => {
  it("convertit l'heure de New York en UTC selon la saison", () => {
    // Opener 2026 NE @ SEA, mer. 09/09 20:20 ET (EDT) -> 00:20Z le 10/09.
    expect(parseScheduleDate("2026-09-09", "20:20")?.toISOString()).toBe(
      "2026-09-10T00:20:00.000Z",
    );
    // Christmas 2026 20:15 ET (EST) -> 01:15Z.
    expect(parseScheduleDate("2026-12-25", "20:15")?.toISOString()).toBe(
      "2026-12-26T01:15:00.000Z",
    );
  });

  it("13h ET par defaut sans heure, null sans date", () => {
    expect(parseScheduleDate("2026-10-11", "")?.toISOString()).toBe(
      "2026-10-11T17:00:00.000Z",
    );
    expect(parseScheduleDate("2026-10-11", "9:30")?.toISOString()).toBe(
      "2026-10-11T13:30:00.000Z",
    );
    expect(parseScheduleDate("", "13:00")).toBeNull();
  });
});

const CSV = [
  "game_id,season,game_type,week,gameday,gametime,away_team,away_score,home_team,home_score",
  "2026_04_ATL_NO,2026,REG,4,2026-10-05,20:15,ATL,,NO,",
  "2026_04_NE_BUF,2026,REG,4,2026-10-04,13:00,NE,20,BUF,24",
  "2026_23_X_Y,2026,REG,23,2026-10-04,13:00,KC,,LV,",
].join("\n");

describe("backfillScoresFromSchedules — createMissing", () => {
  it("cree les matchs absents (scheduled ou final), seulement sur une week seedee", async () => {
    vi.mocked(prisma.nflGame.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.nflWeek.findMany).mockResolvedValue([
      { id: "2026:W4" },
    ] as never);

    const out = await backfillScoresFromSchedules({
      seasonId: "2026",
      createMissing: true,
      fetchSchedulesCsv: async () => CSV,
    });

    expect(out.gamesCreated).toBe(2);
    expect(out.notInDb).toBe(1); // week 23 non seedee
    const created = vi.mocked(prisma.nflGame.create).mock.calls.map((c) => c[0].data);
    expect(created[0]).toMatchObject({
      id: "2026_04_ATL_NO",
      weekId: "2026:W4",
      homeTeam: "NO",
      awayTeam: "ATL",
      status: "scheduled",
      kickoffAt: new Date("2026-10-06T00:15:00Z"),
    });
    expect(created[1]).toMatchObject({
      id: "2026_04_NE_BUF",
      status: "final",
      homeScore: 24,
      awayScore: 20,
    });
  });

  it("sans createMissing, ne cree rien (comportement historique)", async () => {
    vi.mocked(prisma.nflGame.findUnique).mockResolvedValue(null);

    const out = await backfillScoresFromSchedules({
      seasonId: "2026",
      fetchSchedulesCsv: async () => CSV,
    });

    expect(out.gamesCreated).toBe(0);
    expect(out.notInDb).toBe(3);
    expect(prisma.nflGame.create).not.toHaveBeenCalled();
    expect(prisma.nflWeek.findMany).not.toHaveBeenCalled();
  });

  it("recale le coup d'envoi d'un match existant enregistre avec l'ancien offset", async () => {
    vi.mocked(prisma.nflGame.findUnique).mockImplementation((async (args: {
      where: { id: string };
    }) =>
      args.where.id === "2026_04_ATL_NO"
        ? {
            homeScore: null,
            awayScore: null,
            kickoffAt: new Date("2026-10-06T01:15:00Z"), // -05:00 errone
          }
        : null) as never);

    await backfillScoresFromSchedules({
      seasonId: "2026",
      fetchSchedulesCsv: async () => CSV,
    });

    expect(prisma.nflGame.update).toHaveBeenCalledWith({
      where: { id: "2026_04_ATL_NO" },
      data: { kickoffAt: new Date("2026-10-06T00:15:00Z") },
    });
  });
});

describe("parseSchedulesCsv", () => {
  it("filtre la saison et normalise les codes", () => {
    const rows = parseSchedulesCsv(CSV, "2026");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ week: 4, homeTeam: "NO", awayTeam: "ATL" });
    expect(parseSchedulesCsv(CSV, "2025")).toHaveLength(0);
  });
});
