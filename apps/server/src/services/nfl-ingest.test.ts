/**
 * Tests unitaires du service nfl-ingest.
 *
 * Couvre :
 *   - Helpers purs (parseNflverseCsv, filterRowsForWeek, parseRow,
 *     normalizeNflverseTeamCode, buildNflverseUrl)
 *   - seedNflTeams + seedNflSeason avec mock prisma (idempotence)
 *   - ingestNflverseWeek avec mock prisma + fetchCsv override
 *   - NflIngestError pour chaque code d'erreur
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflTeam: { findUnique: vi.fn(), upsert: vi.fn() },
    nflSeason: { upsert: vi.fn() },
    nflWeek: { upsert: vi.fn(), findUnique: vi.fn() },
    nflGame: { upsert: vi.fn() },
    nflPlayer: { upsert: vi.fn() },
    nflGameStat: { upsert: vi.fn() },
    nflIngestRun: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    // V3 cycles : seedNflSeason appelle seedDefaultCyclesForSeason qui
    // upsert 4 cycles. Mock no-op suffit ici.
    nflFantasySeasonCycle: { upsert: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  NflIngestError,
  backfillNflSeason,
  buildNflverseUrl,
  filterRowsForWeek,
  ingestNflverseWeek,
  normalizeNflverseGameId,
  normalizeNflverseTeamCode,
  parseNflverseCsv,
  parseRow,
  seedNflSeason,
  seedNflTeams,
} from "./nfl-ingest";

beforeEach(() => {
  vi.resetAllMocks();
});

// ────────────────────────────────────────────────────────────────────
// Helpers purs
// ────────────────────────────────────────────────────────────────────

describe("buildNflverseUrl", () => {
  it("construit l'URL stats_player pour une saison donnee", () => {
    expect(buildNflverseUrl(2025)).toBe(
      "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2025.csv",
    );
  });
});

describe("parseNflverseCsv", () => {
  it("parse un CSV minimal avec header", () => {
    const csv = `player_id,player_name,team,position,week,season_type\n00-X,Goff,DET,QB,10,REG`;
    const rows = parseNflverseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.player_id).toBe("00-X");
    expect(rows[0]?.team).toBe("DET");
  });

  it("tolere les lignes vides", () => {
    const csv = `player_id,team,week\n00-A,KC,10\n\n00-B,MIA,10\n`;
    const rows = parseNflverseCsv(csv);
    expect(rows).toHaveLength(2);
  });

  it("throw NflIngestError sur CSV invalide", () => {
    const csv = `col1,col2\n"unterminated quote`;
    expect(() => parseNflverseCsv(csv)).toThrow(NflIngestError);
    expect(() => parseNflverseCsv(csv)).toThrow(/PARSE_FAILED|CSV parse failed/);
  });
});

describe("filterRowsForWeek", () => {
  const rows = [
    { week: "10", season_type: "REG", player_id: "a" },
    { week: "10", season_type: "POST", player_id: "b" }, // doit etre ignore
    { week: "11", season_type: "REG", player_id: "c" },
    { week: "19", season_type: "POST", player_id: "d" },
    { week: "19", season_type: "REG", player_id: "e" }, // doit etre ignore
    { week: "10", season_type: "PRE", player_id: "f" },
  ];

  it("filtre regular season (week <19) sur season_type REG", () => {
    const filtered = filterRowsForWeek(rows, 10);
    expect(filtered.map((r) => r.player_id)).toEqual(["a"]);
  });

  it("filtre post-season (week >=19) sur season_type POST", () => {
    const filtered = filterRowsForWeek(rows, 19);
    expect(filtered.map((r) => r.player_id)).toEqual(["d"]);
  });

  it("retourne vide si pas de match", () => {
    expect(filterRowsForWeek(rows, 22)).toHaveLength(0);
  });
});

describe("normalizeNflverseTeamCode", () => {
  it("accepte les 32 codes officiels", () => {
    expect(normalizeNflverseTeamCode("KC")).toBe("KC");
    expect(normalizeNflverseTeamCode("WAS")).toBe("WAS");
    expect(normalizeNflverseTeamCode("LAR")).toBe("LAR");
    expect(normalizeNflverseTeamCode("LAC")).toBe("LAC");
  });

  it("normalise la casse et le whitespace", () => {
    expect(normalizeNflverseTeamCode(" kc ")).toBe("KC");
    expect(normalizeNflverseTeamCode("Mia")).toBe("MIA");
  });

  it("aliases legacy : LA -> LAR", () => {
    expect(normalizeNflverseTeamCode("LA")).toBe("LAR");
  });

  it("retourne null pour un code inconnu", () => {
    expect(normalizeNflverseTeamCode("XXX")).toBeNull();
    expect(normalizeNflverseTeamCode("")).toBeNull();
  });
});

describe("normalizeNflverseGameId", () => {
  it("rewrite legacy LA -> LAR dans le game_id (LA_SF -> LAR_SF)", () => {
    expect(normalizeNflverseGameId("2025_10_LA_SF")).toBe("2025_10_LAR_SF");
    expect(normalizeNflverseGameId("2025_10_SF_LA")).toBe("2025_10_SF_LAR");
  });

  it("laisse intacts les game_id alignes", () => {
    expect(normalizeNflverseGameId("2025_10_ATL_IND")).toBe("2025_10_ATL_IND");
    expect(normalizeNflverseGameId("2025_19_GB_PHI")).toBe("2025_19_GB_PHI");
  });

  it("retourne raw si format inattendu", () => {
    expect(normalizeNflverseGameId("garbage")).toBe("garbage");
    expect(normalizeNflverseGameId("")).toBe("");
    expect(normalizeNflverseGameId("a_b_c")).toBe("a_b_c");
  });
});

describe("parseRow", () => {
  const baseRow = {
    player_id: "00-0033873",
    player_display_name: "Patrick Mahomes",
    player_name: "Patrick Mahomes",
    team: "KC",
    opponent_team: "DEN",
    game_id: "2025_10_DEN_KC",
    position: "QB",
    position_group: "QB",
    week: "10",
    season_type: "REG",
    season: "2025",
    passing_yards: "320",
    passing_tds: "3",
    passing_interceptions: "0",
    completions: "25",
    attempts: "33",
    rushing_yards: "20",
    rushing_tds: "0",
    carries: "3",
    receiving_yards: "0",
    receptions: "0",
    receiving_tds: "0",
    def_tackles_solo: "0",
    def_sacks: "0",
  } as Record<string, string>;

  it("parse une row QB avec bbPosition = Thrower (KC Skaven)", () => {
    const r = parseRow(baseRow);
    expect(r).not.toBeNull();
    expect(r?.playerId).toBe("00-0033873");
    expect(r?.teamCode).toBe("KC");
    expect(r?.opponentCode).toBe("DEN");
    expect(r?.statLine.bbPosition).toBe("Thrower");
    expect(r?.statLine.passYards).toBe(320);
    expect(r?.statLine.passTd).toBe(3);
  });

  it("retourne null si player_id absent", () => {
    expect(parseRow({ ...baseRow, player_id: "" })).toBeNull();
  });

  it("retourne null si team inconnue", () => {
    expect(parseRow({ ...baseRow, team: "XXX" })).toBeNull();
  });

  it("fumbleLost agrege rushing + receiving fumbles", () => {
    const r = parseRow({
      ...baseRow,
      rushing_fumbles_lost: "1",
      receiving_fumbles_lost: "2",
    });
    expect(r?.statLine.fumbleLost).toBe(3);
  });

  it("tolere les champs manquants (defaults a 0)", () => {
    const r = parseRow({
      player_id: "x",
      team: "MIA",
      position: "WR",
      game_id: "g",
    } as Record<string, string>);
    expect(r?.statLine.passYards).toBe(0);
    expect(r?.statLine.tackles).toBe(0);
  });

  it("WR Skaven -> GutterRunner (MIA Skaven)", () => {
    const r = parseRow({ ...baseRow, team: "MIA", position: "WR" });
    expect(r?.statLine.bbPosition).toBe("GutterRunner");
  });

  it("WR Wood Elf -> Catcher (CIN)", () => {
    const r = parseRow({ ...baseRow, team: "CIN", position: "WR" });
    expect(r?.statLine.bbPosition).toBe("Catcher");
  });

  it("normalise LA legacy en LAR dans le gameId emis", () => {
    const r = parseRow({
      ...baseRow,
      team: "LAR",
      opponent_team: "SF",
      game_id: "2025_10_LA_SF",
    });
    expect(r?.gameId).toBe("2025_10_LAR_SF");
  });
});

// ────────────────────────────────────────────────────────────────────
// seedNflTeams
// ────────────────────────────────────────────────────────────────────

describe("seedNflTeams", () => {
  it("upsert les 32 NflTeam idempotemment (creation vierge)", async () => {
    vi.mocked(prisma.nflTeam.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.nflTeam.upsert).mockResolvedValue({} as never);

    const result = await seedNflTeams();

    expect(result.teamsCreated).toBe(32);
    expect(result.teamsUpdated).toBe(0);
    expect(prisma.nflTeam.upsert).toHaveBeenCalledTimes(32);
  });

  it("compte les updates si toutes les teams existent deja", async () => {
    vi.mocked(prisma.nflTeam.findUnique).mockResolvedValue({} as never);
    vi.mocked(prisma.nflTeam.upsert).mockResolvedValue({} as never);

    const result = await seedNflTeams();

    expect(result.teamsCreated).toBe(0);
    expect(result.teamsUpdated).toBe(32);
  });

  it("propage les bonnes valeurs raceLabel pour KC Skaven", async () => {
    vi.mocked(prisma.nflTeam.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.nflTeam.upsert).mockResolvedValue({} as never);

    await seedNflTeams();

    const calls = vi.mocked(prisma.nflTeam.upsert).mock.calls;
    const kcCall = calls.find((c) => (c[0]?.where as { code: string }).code === "KC");
    expect(kcCall).toBeDefined();
    const createArg = kcCall?.[0]?.create as { city: string; bbRace: string; raceLabel: string };
    expect(createArg.city).toBe("Kansas City");
    expect(createArg.bbRace).toBe("Skaven");
    expect(createArg.raceLabel).toBe("Kansas City Skaven");
  });
});

// ────────────────────────────────────────────────────────────────────
// seedNflSeason
// ────────────────────────────────────────────────────────────────────

describe("seedNflSeason", () => {
  it("cree 1 NflSeason et 22 NflWeek (1-18 REG, 19-22 POST)", async () => {
    vi.mocked(prisma.nflSeason.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.nflWeek.upsert).mockResolvedValue({} as never);

    await seedNflSeason("2025");

    expect(prisma.nflSeason.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.nflWeek.upsert).toHaveBeenCalledTimes(22);
  });

  it("flag isPlayoffs=true pour les weeks 19-22", async () => {
    vi.mocked(prisma.nflSeason.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.nflWeek.upsert).mockResolvedValue({} as never);

    await seedNflSeason("2025");

    const calls = vi.mocked(prisma.nflWeek.upsert).mock.calls;
    const w10 = calls.find((c) => (c[0]?.where as { id: string }).id === "2025:W10");
    const w19 = calls.find((c) => (c[0]?.where as { id: string }).id === "2025:W19");
    expect((w10?.[0]?.create as { isPlayoffs: boolean })?.isPlayoffs).toBe(false);
    expect((w19?.[0]?.create as { isPlayoffs: boolean })?.isPlayoffs).toBe(true);
  });

  it("throw si seasonId invalide", async () => {
    await expect(seedNflSeason("invalid")).rejects.toThrow(NflIngestError);
    await expect(seedNflSeason("1999")).rejects.toThrow(/seasonId invalide/);
  });
});

// ────────────────────────────────────────────────────────────────────
// ingestNflverseWeek
// ────────────────────────────────────────────────────────────────────

describe("ingestNflverseWeek", () => {
  const sampleCsv = [
    "player_id,player_display_name,player_name,team,opponent_team,game_id,position,week,season_type,season,passing_yards,passing_tds,passing_interceptions,completions,attempts,rushing_yards,rushing_tds,carries,receiving_yards,receptions,receiving_tds,def_tackles_solo,def_sacks,def_tackle_assists,def_qb_hits,def_tackles_for_loss,def_interceptions,def_pass_defended,def_fumbles_forced,def_tds",
    // QB Mahomes - 3 TD, 320 yds, 0 INT
    "00-Mahomes,Patrick Mahomes,Patrick Mahomes,KC,DEN,2025_10_DEN_KC,QB,10,REG,2025,320,3,0,25,33,20,0,3,0,0,0,0,0,0,0,0,0,0,0,0",
    // DE McDonald - 4 sacks
    "00-McDonald,Will McDonald IV,Will McDonald IV,NYJ,CLE,2025_10_NYJ_CLE,DE,10,REG,2025,0,0,0,0,0,0,0,0,0,0,0,4,4,0,5,0,0,0,0,0",
    // Row a ignorer (POST sur week 10)
    "00-Ignore,Skip Me,Skip,KC,DEN,2025_10_DEN_KC,QB,10,POST,2025,99,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0",
  ].join("\n");

  it("ingere une semaine, upsert games + players + stats avec computedSpp", async () => {
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      id: "2025:W10",
      seasonId: "2025",
      weekNumber: 10,
      startDate: new Date("2025-11-09T00:00:00Z"),
      endDate: new Date("2025-11-10T00:00:00Z"),
      isPlayoffs: false,
    } as never);
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-1" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflGame.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.nflPlayer.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.nflGameStat.upsert).mockResolvedValue({} as never);

    const result = await ingestNflverseWeek({
      seasonId: "2025",
      weekNumber: 10,
      fetchCsv: async () => sampleCsv,
    });

    expect(result.playersUpdated).toBe(2); // Mahomes + McDonald
    expect(result.statsUpdated).toBe(2);
    expect(result.gamesUpdated).toBe(2); // 2 games distincts
    expect(result.errors).toEqual([]);
    expect(result.ingestRunId).toBe("run-1");
  });

  it("idempotent : computedSpp passe en update pour Mahomes (12 SPP)", async () => {
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      id: "2025:W10",
      startDate: new Date(),
    } as never);
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-2" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflGame.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.nflPlayer.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.nflGameStat.upsert).mockResolvedValue({} as never);

    await ingestNflverseWeek({
      seasonId: "2025",
      weekNumber: 10,
      fetchCsv: async () => sampleCsv,
    });

    const calls = vi.mocked(prisma.nflGameStat.upsert).mock.calls;
    const mahomesCall = calls.find(
      (c) => (c[0]?.where as { gameId_playerId: { playerId: string } }).gameId_playerId.playerId === "00-Mahomes",
    );
    expect(mahomesCall).toBeDefined();
    // Mahomes : 3 TD * 3 + floor(320/75)=4 CP + 0 INT = 9+4 = 13 SPP
    // (rushing 20 yd < 50, pas de bonus CP)
    const create = mahomesCall?.[0]?.create as { computedSpp: number };
    expect(create.computedSpp).toBe(13);
  });

  it("throw si week introuvable en DB", async () => {
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-3" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);

    await expect(
      ingestNflverseWeek({
        seasonId: "2025",
        weekNumber: 10,
        fetchCsv: async () => sampleCsv,
      }),
    ).rejects.toThrow(/NflWeek 2025:W10 introuvable/);
  });

  it("throw si fetch nflverse echoue", async () => {
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-4" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);

    await expect(
      ingestNflverseWeek({
        seasonId: "2025",
        weekNumber: 10,
        fetchCsv: async () => {
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

  it("throw si weekNumber hors bornes", async () => {
    await expect(
      ingestNflverseWeek({ seasonId: "2025", weekNumber: 0, fetchCsv: async () => "" }),
    ).rejects.toThrow(/weekNumber doit etre 1-22/);
    await expect(
      ingestNflverseWeek({ seasonId: "2025", weekNumber: 23, fetchCsv: async () => "" }),
    ).rejects.toThrow(/weekNumber doit etre 1-22/);
  });

  it("audit log NflIngestRun cree au debut, update a la fin (success)", async () => {
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      id: "2025:W10",
      startDate: new Date(),
    } as never);
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({ id: "run-5" } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflGame.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.nflPlayer.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.nflGameStat.upsert).mockResolvedValue({} as never);

    await ingestNflverseWeek({
      seasonId: "2025",
      weekNumber: 10,
      fetchCsv: async () => sampleCsv,
    });

    expect(prisma.nflIngestRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "nflverse",
          weekId: "2025:W10",
          status: "in_progress",
        }),
      }),
    );
    expect(prisma.nflIngestRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-5" },
        data: expect.objectContaining({ status: "success" }),
      }),
    );
  });
});

describe("NflIngestError", () => {
  it("expose un code string typé", () => {
    const err = new NflIngestError("FETCH_FAILED", "boom");
    expect(err.code).toBe("FETCH_FAILED");
    expect(err.name).toBe("NflIngestError");
    expect(err).toBeInstanceOf(Error);
  });

  it("supporte tous les codes documentés", () => {
    const codes = [
      "FETCH_FAILED",
      "PARSE_FAILED",
      "SEASON_NOT_FOUND",
      "WEEK_NOT_FOUND",
      "INVALID_WEEK_NUMBER",
    ] as const;
    for (const code of codes) {
      expect(new NflIngestError(code, "msg").code).toBe(code);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// backfillNflSeason (Phase 3.E)
// ────────────────────────────────────────────────────────────────────

describe("backfillNflSeason", () => {
  function setupSeed(): void {
    vi.mocked(prisma.nflSeason.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.nflWeek.upsert).mockResolvedValue({} as never);
  }

  it("throw INVALID_WEEK_NUMBER pour range invalide", async () => {
    await expect(
      backfillNflSeason({ seasonId: "2024", fromWeek: 5, toWeek: 2 }),
    ).rejects.toMatchObject({ code: "INVALID_WEEK_NUMBER" });
    await expect(
      backfillNflSeason({ seasonId: "2024", fromWeek: 0 }),
    ).rejects.toMatchObject({ code: "INVALID_WEEK_NUMBER" });
    await expect(
      backfillNflSeason({ seasonId: "2024", toWeek: 25 }),
    ).rejects.toMatchObject({ code: "INVALID_WEEK_NUMBER" });
  });

  it("skip les weeks deja success quand skipExisting=true (default)", async () => {
    setupSeed();
    const fetchCsv = vi.fn().mockResolvedValue("");
    const fetchSchedulesCsv = vi.fn().mockResolvedValue("game_id,season\n");
    vi.mocked(prisma.nflIngestRun.findFirst)
      .mockResolvedValueOnce({ id: "prev-1" } as never)
      .mockResolvedValueOnce({ id: "prev-2" } as never)
      .mockResolvedValueOnce({ id: "prev-3" } as never);

    const out = await backfillNflSeason({
      seasonId: "2024",
      fromWeek: 1,
      toWeek: 3,
      fetchCsv,
      fetchSchedulesCsv,
    });

    expect(out.weeksProcessed).toBe(0);
    expect(out.weeksSkipped).toBe(3);
    expect(out.weeksFailed).toBe(0);
    // fetch n'est appele qu'une fois (avant la boucle)
    expect(fetchCsv).toHaveBeenCalledTimes(1);
  });

  it("re-ingest si skipExisting=false meme avec NflIngestRun success", async () => {
    setupSeed();
    const csv =
      "player_id,player_name,team,opponent_team,position,week,season_type,game_id\n" +
      "00-A,Goff,DET,KC,QB,1,REG,2024_01_DET_KC\n";
    const fetchCsv = vi.fn().mockResolvedValue(csv);
    const fetchSchedulesCsv = vi.fn().mockResolvedValue("game_id,season\n");
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({
      id: "run-1",
    } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      id: "2024:W1",
      startDate: new Date("2024-09-05"),
    } as never);
    vi.mocked(prisma.nflGame.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.nflPlayer.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.nflGameStat.upsert).mockResolvedValue({} as never);

    const out = await backfillNflSeason({
      seasonId: "2024",
      fromWeek: 1,
      toWeek: 1,
      skipExisting: false,
      fetchCsv,
      fetchSchedulesCsv,
    });

    expect(out.weeksProcessed).toBe(1);
    expect(out.weeksSkipped).toBe(0);
    expect(prisma.nflIngestRun.findFirst).not.toHaveBeenCalled();
  });

  it("reutilise le CSV cache pour toutes les weeks (1 seul fetch)", async () => {
    setupSeed();
    const fetchCsv = vi.fn().mockResolvedValue("player_id\n");
    const fetchSchedulesCsv = vi.fn().mockResolvedValue("game_id,season\n");
    vi.mocked(prisma.nflIngestRun.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({
      id: "run-x",
    } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      id: "x",
      startDate: new Date(),
    } as never);

    await backfillNflSeason({
      seasonId: "2024",
      fromWeek: 1,
      toWeek: 5,
      fetchCsv,
      fetchSchedulesCsv,
    });

    expect(fetchCsv).toHaveBeenCalledTimes(1);
  });

  it("collecte les erreurs par week sans arreter la boucle", async () => {
    setupSeed();
    const fetchCsv = vi.fn().mockResolvedValue("player_id\n");
    const fetchSchedulesCsv = vi.fn().mockResolvedValue("game_id,season\n");
    vi.mocked(prisma.nflIngestRun.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({
      id: "run",
    } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    // W2 → throw WEEK_NOT_FOUND
    vi.mocked(prisma.nflWeek.findUnique)
      .mockResolvedValueOnce({ id: "2024:W1", startDate: new Date() } as never)
      .mockResolvedValueOnce(null) // W2
      .mockResolvedValueOnce({ id: "2024:W3", startDate: new Date() } as never);

    const out = await backfillNflSeason({
      seasonId: "2024",
      fromWeek: 1,
      toWeek: 3,
      fetchCsv,
      fetchSchedulesCsv,
    });

    expect(out.weeksProcessed).toBe(2);
    expect(out.weeksFailed).toBe(1);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]?.weekNumber).toBe(2);
  });

  it("appelle onProgress pour chaque week (ingested/skipped/failed)", async () => {
    setupSeed();
    const fetchCsv = vi.fn().mockResolvedValue("player_id\n");
    const fetchSchedulesCsv = vi.fn().mockResolvedValue("game_id,season\n");
    vi.mocked(prisma.nflIngestRun.findFirst)
      .mockResolvedValueOnce({ id: "prev" } as never) // W1 skipped
      .mockResolvedValueOnce(null); // W2 ingested
    vi.mocked(prisma.nflIngestRun.create).mockResolvedValue({
      id: "run",
    } as never);
    vi.mocked(prisma.nflIngestRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue({
      id: "x",
      startDate: new Date(),
    } as never);

    const events: Array<{ w: number; status: string }> = [];
    await backfillNflSeason({
      seasonId: "2024",
      fromWeek: 1,
      toWeek: 2,
      fetchCsv,
      fetchSchedulesCsv,
      onProgress: (w, status) => events.push({ w, status }),
    });

    expect(events).toEqual([
      { w: 1, status: "skipped" },
      { w: 2, status: "ingested" },
    ]);
  });
});
