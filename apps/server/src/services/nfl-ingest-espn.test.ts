/**
 * Tests unitaires du service nfl-ingest-espn (Phase 2.B).
 *
 * Couvre :
 *   - Helpers purs (normalizeEspnTeamCode, toEspnTeamCode,
 *     mapEspnStatusToNflGameStatus, mapEspnWeekToNflverseWeek,
 *     parseEspnEvent, parseEspnRoster)
 *   - ingestEspnGameday : success / skip Pro Bowl / week absente /
 *     fetch failure / audit log
 *   - ingestEspnRosters : success / season missing / per-team errors /
 *     audit log
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflSeason: { findUnique: vi.fn() },
    nflWeek: { findUnique: vi.fn() },
    nflGame: { upsert: vi.fn() },
    nflRosterSnapshot: { create: vi.fn() },
    nflIngestRun: { create: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import { NflIngestError } from "./nfl-ingest";
import {
  type EspnEvent,
  type EspnRosterResponse,
  type EspnScoreboard,
  ingestEspnGameday,
  ingestEspnRosters,
  mapEspnStatusToNflGameStatus,
  mapEspnWeekToNflverseWeek,
  normalizeEspnTeamCode,
  parseEspnEvent,
  parseEspnRoster,
  toEspnTeamCode,
} from "./nfl-ingest-espn";

beforeEach(() => {
  vi.resetAllMocks();
});

// ────────────────────────────────────────────────────────────────────
// normalizeEspnTeamCode
// ────────────────────────────────────────────────────────────────────

describe("normalizeEspnTeamCode", () => {
  it("accepte les codes alignes (KC, LAR, LAC, LV)", () => {
    expect(normalizeEspnTeamCode("KC")).toBe("KC");
    expect(normalizeEspnTeamCode("LAR")).toBe("LAR");
    expect(normalizeEspnTeamCode("LAC")).toBe("LAC");
    expect(normalizeEspnTeamCode("LV")).toBe("LV");
  });

  it("mappe WSH (ESPN) -> WAS (interne)", () => {
    expect(normalizeEspnTeamCode("WSH")).toBe("WAS");
    expect(normalizeEspnTeamCode(" wsh ")).toBe("WAS");
  });

  it("retourne null pour code inconnu ou vide", () => {
    expect(normalizeEspnTeamCode("ZZZ")).toBeNull();
    expect(normalizeEspnTeamCode("")).toBeNull();
    expect(normalizeEspnTeamCode("   ")).toBeNull();
  });
});

describe("toEspnTeamCode", () => {
  it("convertit WAS -> WSH pour les endpoints ESPN", () => {
    expect(toEspnTeamCode("WAS")).toBe("WSH");
  });

  it("laisse les autres codes tels quels", () => {
    expect(toEspnTeamCode("KC")).toBe("KC");
    expect(toEspnTeamCode("LAR")).toBe("LAR");
  });
});

// ────────────────────────────────────────────────────────────────────
// mapEspnStatusToNflGameStatus
// ────────────────────────────────────────────────────────────────────

describe("mapEspnStatusToNflGameStatus", () => {
  it("mappe STATUS_FINAL -> final", () => {
    expect(mapEspnStatusToNflGameStatus("STATUS_FINAL")).toBe("final");
  });

  it("mappe STATUS_SCHEDULED -> scheduled", () => {
    expect(mapEspnStatusToNflGameStatus("STATUS_SCHEDULED")).toBe("scheduled");
  });

  it("mappe STATUS_POSTPONED -> scheduled", () => {
    expect(mapEspnStatusToNflGameStatus("STATUS_POSTPONED")).toBe("scheduled");
  });

  it("mappe les etats in-game -> in_progress", () => {
    expect(mapEspnStatusToNflGameStatus("STATUS_IN_PROGRESS")).toBe("in_progress");
    expect(mapEspnStatusToNflGameStatus("STATUS_HALFTIME")).toBe("in_progress");
    expect(mapEspnStatusToNflGameStatus("STATUS_END_PERIOD")).toBe("in_progress");
  });

  it("fallback -> scheduled si undefined", () => {
    expect(mapEspnStatusToNflGameStatus(undefined)).toBe("scheduled");
  });
});

// ────────────────────────────────────────────────────────────────────
// mapEspnWeekToNflverseWeek
// ────────────────────────────────────────────────────────────────────

describe("mapEspnWeekToNflverseWeek", () => {
  it("regular season : pass-through", () => {
    expect(mapEspnWeekToNflverseWeek("regular-season", 1)).toBe(1);
    expect(mapEspnWeekToNflverseWeek("regular-season", 18)).toBe(18);
  });

  it("post-season : Wildcard(1)->19, Div(2)->20, Conf(3)->21, SB(5)->22", () => {
    expect(mapEspnWeekToNflverseWeek("post-season", 1)).toBe(19);
    expect(mapEspnWeekToNflverseWeek("post-season", 2)).toBe(20);
    expect(mapEspnWeekToNflverseWeek("post-season", 3)).toBe(21);
    expect(mapEspnWeekToNflverseWeek("post-season", 5)).toBe(22);
  });

  it("post-season Pro Bowl(4) -> -1 (skip)", () => {
    expect(mapEspnWeekToNflverseWeek("post-season", 4)).toBe(-1);
  });

  it("slug undefined : traite comme regular season", () => {
    expect(mapEspnWeekToNflverseWeek(undefined, 10)).toBe(10);
  });

  it("post-season weekNumber inconnu -> -1", () => {
    expect(mapEspnWeekToNflverseWeek("post-season", 99)).toBe(-1);
  });
});

// ────────────────────────────────────────────────────────────────────
// parseEspnEvent
// ────────────────────────────────────────────────────────────────────

function buildEvent(overrides: Partial<EspnEvent> = {}): EspnEvent {
  return {
    id: "401772636",
    date: "2025-11-09T18:00:00Z",
    status: { type: { name: "STATUS_FINAL", state: "post", completed: true } },
    season: { year: 2025, type: 2, slug: "regular-season" },
    week: { number: 10 },
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: { abbreviation: "IND" }, score: "31" },
          { homeAway: "away", team: { abbreviation: "ATL" }, score: "25" },
        ],
      },
    ],
    ...overrides,
  };
}

describe("parseEspnEvent", () => {
  it("parse un event regular season complet (ATL @ IND W10)", () => {
    const parsed = parseEspnEvent(buildEvent());
    expect(parsed).not.toBeNull();
    expect(parsed?.nflverseGameId).toBe("2025_10_ATL_IND");
    expect(parsed?.seasonId).toBe("2025");
    expect(parsed?.weekId).toBe("2025:W10");
    expect(parsed?.weekNumber).toBe(10);
    expect(parsed?.homeTeam).toBe("IND");
    expect(parsed?.awayTeam).toBe("ATL");
    expect(parsed?.homeScore).toBe(31);
    expect(parsed?.awayScore).toBe(25);
    expect(parsed?.status).toBe("final");
    expect(parsed?.kickoffAt.toISOString()).toBe("2025-11-09T18:00:00.000Z");
  });

  it("zero-pad la semaine sur 2 digits (W1 -> '01')", () => {
    const parsed = parseEspnEvent(
      buildEvent({ week: { number: 1 } }),
    );
    expect(parsed?.nflverseGameId).toBe("2025_01_ATL_IND");
  });

  it("post-season Wildcard ESPN W1 -> nflverse W19", () => {
    const parsed = parseEspnEvent(
      buildEvent({
        season: { year: 2025, type: 3, slug: "post-season" },
        week: { number: 1 },
      }),
    );
    expect(parsed?.weekNumber).toBe(19);
    expect(parsed?.weekId).toBe("2025:W19");
    expect(parsed?.nflverseGameId).toBe("2025_19_ATL_IND");
  });

  it("post-season Pro Bowl (ESPN W4) -> null (skip)", () => {
    const parsed = parseEspnEvent(
      buildEvent({
        season: { year: 2025, type: 3, slug: "post-season" },
        week: { number: 4 },
      }),
    );
    expect(parsed).toBeNull();
  });

  it("WSH -> WAS dans le gameId", () => {
    const parsed = parseEspnEvent(
      buildEvent({
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { abbreviation: "WSH" }, score: "20" },
              { homeAway: "away", team: { abbreviation: "DAL" }, score: "17" },
            ],
          },
        ],
      }),
    );
    expect(parsed?.homeTeam).toBe("WAS");
    expect(parsed?.nflverseGameId).toBe("2025_10_DAL_WAS");
  });

  it("scores manquants -> null (game scheduled)", () => {
    const parsed = parseEspnEvent(
      buildEvent({
        status: { type: { name: "STATUS_SCHEDULED" } },
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { abbreviation: "IND" } },
              { homeAway: "away", team: { abbreviation: "ATL" } },
            ],
          },
        ],
      }),
    );
    expect(parsed?.homeScore).toBeNull();
    expect(parsed?.awayScore).toBeNull();
    expect(parsed?.status).toBe("scheduled");
  });

  it("retourne null si team inconnue", () => {
    const parsed = parseEspnEvent(
      buildEvent({
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { abbreviation: "XXX" } },
              { homeAway: "away", team: { abbreviation: "ATL" } },
            ],
          },
        ],
      }),
    );
    expect(parsed).toBeNull();
  });

  it("retourne null si season/week absente", () => {
    expect(parseEspnEvent(buildEvent({ season: undefined }))).toBeNull();
    expect(parseEspnEvent(buildEvent({ week: undefined }))).toBeNull();
  });

  it("retourne null si pas de competitor home/away", () => {
    const parsed = parseEspnEvent(
      buildEvent({
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { abbreviation: "IND" } },
            ],
          },
        ],
      }),
    );
    expect(parsed).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────
// parseEspnRoster
// ────────────────────────────────────────────────────────────────────

describe("parseEspnRoster", () => {
  it("aplatit offense + defense + specialTeam", () => {
    const resp: EspnRosterResponse = {
      team: { abbreviation: "KC" },
      athletes: [
        {
          position: "offense",
          items: [
            {
              id: "3139477",
              displayName: "Patrick Mahomes",
              jersey: "15",
              position: { abbreviation: "QB" },
              active: true,
            },
          ],
        },
        {
          position: "defense",
          items: [
            {
              id: "999",
              displayName: "Some Linebacker",
              jersey: "55",
              position: { abbreviation: "LB" },
            },
          ],
        },
      ],
    };
    const out = parseEspnRoster(resp);
    expect(out).toHaveLength(2);
    expect(out[0]?.espnId).toBe("3139477");
    expect(out[0]?.jersey).toBe(15);
    expect(out[0]?.position).toBe("QB");
    expect(out[1]?.position).toBe("LB");
  });

  it("tolere les groupes / items absents", () => {
    expect(parseEspnRoster({})).toEqual([]);
    expect(parseEspnRoster({ athletes: [] })).toEqual([]);
    expect(parseEspnRoster({ athletes: [{ position: "x" }] })).toEqual([]);
  });

  it("jersey absent -> null, fullName fallback", () => {
    const out = parseEspnRoster({
      athletes: [
        {
          position: "offense",
          items: [
            {
              id: "1",
              fullName: "Joe Doe",
              position: { abbreviation: "WR" },
            },
          ],
        },
      ],
    });
    expect(out[0]?.jersey).toBeNull();
    expect(out[0]?.fullName).toBe("Joe Doe");
    expect(out[0]?.active).toBe(true);
  });

  it("active=false respecte", () => {
    const out = parseEspnRoster({
      athletes: [
        {
          position: "offense",
          items: [
            { id: "1", displayName: "Inactive Guy", active: false },
          ],
        },
      ],
    });
    expect(out[0]?.active).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// ingestEspnGameday
// ────────────────────────────────────────────────────────────────────

describe("ingestEspnGameday", () => {
  const sampleScoreboard: EspnScoreboard = {
    events: [
      buildEvent({ id: "evt-A", competitions: buildEvent().competitions }),
      buildEvent({
        id: "evt-B",
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { abbreviation: "KC" }, score: "27" },
              { homeAway: "away", team: { abbreviation: "DEN" }, score: "14" },
            ],
          },
        ],
      }),
    ],
  };

  it("upsert chaque event vers NflGame, audit en success", async () => {
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-1" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      id: "2025:W10",
      seasonId: "2025",
      weekNumber: 10,
    } as never);
    vi.mocked(prisma.nflGame.upsert).mockResolvedValue({} as never);

    const result = await ingestEspnGameday({
      dateYmd: "20251109",
      fetchScoreboard: async () => sampleScoreboard,
    });

    expect(result.gamesUpdated).toBe(2);
    expect(result.gamesSkipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.ingestRunId).toBe("run-1");
    expect(prisma.nflGame.upsert).toHaveBeenCalledTimes(2);

    expect(prisma.nflIngestRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "success" }),
      }),
    );
  });

  it("skip un event si NflWeek absente, log dans errors, partial status", async () => {
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-2" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue(null);

    const result = await ingestEspnGameday({
      dateYmd: "20251109",
      fetchScoreboard: async () => ({ events: [buildEvent()] }),
    });

    expect(result.gamesUpdated).toBe(0);
    expect(result.gamesSkipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.error).toMatch(/NflWeek 2025:W10 absent/);
    expect(prisma.nflGame.upsert).not.toHaveBeenCalled();

    expect(prisma.nflIngestRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "partial" }),
      }),
    );
  });

  it("skip silencieusement le Pro Bowl (parseEspnEvent null)", async () => {
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-3" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({ id: "x" } as never);

    const result = await ingestEspnGameday({
      dateYmd: "20260201",
      fetchScoreboard: async () => ({
        events: [
          buildEvent({
            id: "evt-probowl",
            season: { year: 2025, type: 3, slug: "post-season" },
            week: { number: 4 },
          }),
        ],
      }),
    });

    expect(result.gamesUpdated).toBe(0);
    expect(result.gamesSkipped).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("audit en failed si fetch jette", async () => {
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-4" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);

    await expect(
      ingestEspnGameday({
        dateYmd: "20251109",
        fetchScoreboard: async () => {
          throw new NflIngestError("FETCH_FAILED", "boom");
        },
      }),
    ).rejects.toThrow(NflIngestError);

    expect(prisma.nflIngestRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("audit log cree avec source='espn'", async () => {
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-5" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({ id: "x" } as never);
    vi.mocked(prisma.nflGame.upsert).mockResolvedValue({} as never);

    await ingestEspnGameday({
      dateYmd: "20251109",
      fetchScoreboard: async () => ({ events: [] }),
    });

    expect(prisma.nflIngestRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "espn",
          status: "in_progress",
        }),
      }),
    );
  });
});

// ────────────────────────────────────────────────────────────────────
// ingestEspnRosters
// ────────────────────────────────────────────────────────────────────

describe("ingestEspnRosters", () => {
  const sampleRoster: EspnRosterResponse = {
    team: { abbreviation: "KC" },
    athletes: [
      {
        position: "offense",
        items: [
          {
            id: "3139477",
            displayName: "Patrick Mahomes",
            jersey: "15",
            position: { abbreviation: "QB" },
          },
        ],
      },
    ],
  };

  it("snapshot les teams demandees, audit success", async () => {
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-1" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValue({ id: "2025" } as never);
    vi.mocked(prisma.nflRosterSnapshot.create).mockResolvedValue({} as never);

    const result = await ingestEspnRosters({
      seasonId: "2025",
      teamCodes: ["KC", "MIA"],
      fetchRoster: async () => sampleRoster,
    });

    expect(result.snapshotsCreated).toBe(2);
    expect(result.teamsCovered).toBe(2);
    expect(result.errors).toEqual([]);
    expect(prisma.nflRosterSnapshot.create).toHaveBeenCalledTimes(2);
  });

  it("appelle fetchRoster avec WSH pour WAS", async () => {
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-2" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValue({ id: "2025" } as never);
    vi.mocked(prisma.nflRosterSnapshot.create).mockResolvedValue({} as never);

    const fetchRoster = vi.fn(async () => sampleRoster);
    await ingestEspnRosters({
      seasonId: "2025",
      teamCodes: ["WAS"],
      fetchRoster,
    });

    expect(fetchRoster).toHaveBeenCalledWith("WSH");
  });

  it("default = 32 teams si teamCodes undefined", async () => {
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-3" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValue({ id: "2025" } as never);
    vi.mocked(prisma.nflRosterSnapshot.create).mockResolvedValue({} as never);

    const result = await ingestEspnRosters({
      seasonId: "2025",
      fetchRoster: async () => sampleRoster,
    });

    expect(result.teamsCovered).toBe(32);
    expect(result.snapshotsCreated).toBe(32);
  });

  it("throw SEASON_NOT_FOUND si saison absente", async () => {
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-4" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValue(null);

    await expect(
      ingestEspnRosters({
        seasonId: "2099",
        teamCodes: ["KC"],
        fetchRoster: async () => sampleRoster,
      }),
    ).rejects.toThrow(/NflSeason 2099 introuvable/);

    expect(prisma.nflIngestRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("isole les erreurs per-team, audit partial", async () => {
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-5" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValue({ id: "2025" } as never);
    vi.mocked(prisma.nflRosterSnapshot.create).mockResolvedValue({} as never);

    let call = 0;
    const fetchRoster = vi.fn(async () => {
      call++;
      if (call === 1) throw new Error("network fail");
      return sampleRoster;
    });

    const result = await ingestEspnRosters({
      seasonId: "2025",
      teamCodes: ["KC", "MIA"],
      fetchRoster,
    });

    expect(result.snapshotsCreated).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.context).toBe("KC");

    expect(prisma.nflIngestRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "partial" }),
      }),
    );
  });
});
