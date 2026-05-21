import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflPlayer: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@bb/nfl-mapper", async () => {
  const actual = await vi.importActual<typeof import("@bb/nfl-mapper")>(
    "@bb/nfl-mapper",
  );
  return {
    ...actual,
    getBbPosition: vi.fn().mockReturnValue("Thrower"),
    getTeamMeta: vi.fn().mockReturnValue({
      code: "KC",
      city: "Kansas City",
      race: "Skaven",
    }),
    generatePseudonym: vi
      .fn()
      .mockImplementation(
        ({ cityTag, bbPosition, jerseyNumber }) =>
          `${bbPosition} de ${cityTag}, #${jerseyNumber}`,
      ),
  };
});

import { prisma } from "../prisma";
import {
  generatePseudonym,
  getBbPosition,
  getTeamMeta,
} from "@bb/nfl-mapper";
import {
  buildNflverseRostersUrl,
  ingestNflverseRosters,
  parseHeightToInches,
  parseRosterRow,
  parseRostersCsv,
} from "./nfl-ingest-rosters";

beforeEach(() => {
  vi.resetAllMocks();
  // resetAllMocks wipe les mockReturnValue declares dans la factory
  // vi.mock — on les re-applique ici.
  vi.mocked(getBbPosition).mockReturnValue("Thrower");
  vi.mocked(getTeamMeta).mockReturnValue({
    code: "KC",
    city: "Kansas City",
    race: "Skaven",
  } as never);
  vi.mocked(generatePseudonym).mockImplementation(
    ({ cityTag, bbPosition, jerseyNumber }) =>
      `${bbPosition} de ${cityTag}, #${jerseyNumber}`,
  );
});

describe("parseHeightToInches", () => {
  it("parse format 6-2 → 74", () => {
    expect(parseHeightToInches("6-2")).toBe(74);
  });

  it("parse format 6'2 → 74", () => {
    expect(parseHeightToInches("6'2")).toBe(74);
  });

  it("parse format 6 2 → 74", () => {
    expect(parseHeightToInches("6 2")).toBe(74);
  });

  it("parse format 5-10 → 70", () => {
    expect(parseHeightToInches("5-10")).toBe(70);
  });

  it("accepte un nombre brut (inches direct)", () => {
    expect(parseHeightToInches("74")).toBe(74);
  });

  it("retourne null si vide", () => {
    expect(parseHeightToInches("")).toBeNull();
    expect(parseHeightToInches(undefined)).toBeNull();
  });

  it("retourne null si feet hors range", () => {
    expect(parseHeightToInches("3-0")).toBeNull();
    expect(parseHeightToInches("9-0")).toBeNull();
  });

  it("retourne null si inches hors range", () => {
    expect(parseHeightToInches("6-15")).toBeNull();
  });

  it("retourne null sur format invalide", () => {
    expect(parseHeightToInches("foo")).toBeNull();
  });
});

describe("parseRosterRow", () => {
  it("parse une row complete", () => {
    const out = parseRosterRow({
      gsis_id: "00-0033873",
      full_name: "Patrick Mahomes",
      team: "KC",
      position: "QB",
      jersey_number: "15",
      height: "6-2",
      weight: "230",
      birth_date: "1995-09-17",
      college: "Texas Tech",
      headshot_url: "https://example.com/mahomes.png",
      draft_year: "2017",
      draft_round: "1",
      draft_number: "10",
      draft_club: "KC",
      rookie_year: "2017",
      years_exp: "8",
      status: "ACT",
    });
    expect(out).not.toBeNull();
    expect(out!.playerId).toBe("00-0033873");
    expect(out!.fullName).toBe("Patrick Mahomes");
    expect(out!.teamCode).toBe("KC");
    expect(out!.nflPosition).toBe("QB");
    expect(out!.jerseyNumber).toBe(15);
    expect(out!.heightInches).toBe(74);
    expect(out!.weightLbs).toBe(230);
    expect(out!.birthDate?.toISOString().slice(0, 10)).toBe("1995-09-17");
    expect(out!.college).toBe("Texas Tech");
    expect(out!.headshotUrl).toBe("https://example.com/mahomes.png");
    expect(out!.draftYear).toBe(2017);
    expect(out!.draftRound).toBe(1);
    expect(out!.draftPick).toBe(10);
    expect(out!.draftClub).toBe("KC");
    expect(out!.rookieYear).toBe(2017);
    expect(out!.yearsExp).toBe(8);
    expect(out!.status).toBe("active");
  });

  it("retourne null si gsis_id manquant", () => {
    expect(parseRosterRow({ gsis_id: "" } as never)).toBeNull();
  });

  it("normalise status RES → ir, RET → retired, SUS → suspended", () => {
    const res = parseRosterRow({
      gsis_id: "P1",
      position: "QB",
      team: "KC",
      status: "RES",
    });
    expect(res!.status).toBe("ir");

    const ret = parseRosterRow({
      gsis_id: "P1",
      position: "QB",
      team: "KC",
      status: "RET",
    });
    expect(ret!.status).toBe("retired");

    const sus = parseRosterRow({
      gsis_id: "P1",
      position: "QB",
      team: "KC",
      status: "SUS",
    });
    expect(sus!.status).toBe("suspended");
  });

  it("fallback full_name = first_name + last_name si full_name vide", () => {
    const out = parseRosterRow({
      gsis_id: "P1",
      first_name: "John",
      last_name: "Doe",
      team: "KC",
      position: "QB",
    });
    expect(out!.fullName).toBe("John Doe");
  });

  it("teamCode null si team invalide (FA)", () => {
    const out = parseRosterRow({
      gsis_id: "P1",
      position: "QB",
      team: "XXX",
    });
    expect(out!.teamCode).toBeNull();
  });
});

describe("parseRostersCsv", () => {
  it("parse un CSV avec headers", () => {
    const csv =
      "gsis_id,full_name,team,position\n00-0033873,Patrick Mahomes,KC,QB\n";
    const rows = parseRostersCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.full_name).toBe("Patrick Mahomes");
  });

  it("tolere ligne vide en fin", () => {
    const csv = "gsis_id,full_name\nP1,Mahomes\n\n";
    expect(parseRostersCsv(csv)).toHaveLength(1);
  });
});

describe("buildNflverseRostersUrl", () => {
  it("genere l'URL correcte", () => {
    expect(buildNflverseRostersUrl(2025)).toBe(
      "https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2025.csv",
    );
  });
});

describe("ingestNflverseRosters", () => {
  const SAMPLE_CSV =
    "gsis_id,full_name,team,position,jersey_number,height,weight,college,birth_date,headshot_url,draft_year,draft_round,draft_number,status\n" +
    "00-0033873,Patrick Mahomes,KC,QB,15,6-2,230,Texas Tech,1995-09-17,https://example.com/mahomes.png,2017,1,10,ACT\n" +
    "00-0034796,Travis Kelce,KC,TE,87,6-5,250,Cincinnati,1989-10-05,,2013,3,63,ACT\n";

  it("update un joueur existant et cree un nouveau", async () => {
    vi.mocked(prisma.nflPlayer.findUnique)
      .mockResolvedValueOnce({
        id: "00-0033873",
        teamCode: "KC",
        bbPosition: "Thrower",
      } as never)
      .mockResolvedValueOnce(null as never);
    vi.mocked(prisma.nflPlayer.update).mockResolvedValue({} as never);
    vi.mocked(prisma.nflPlayer.create).mockResolvedValue({} as never);

    const out = await ingestNflverseRosters({
      seasonId: "2025",
      fetchCsv: async () => SAMPLE_CSV,
    });

    expect(out.rowsTotal).toBe(2);
    expect(out.playersUpdated).toBe(1);
    expect(out.playersCreated).toBe(1);
    expect(out.playersSkipped).toBe(0);
    expect(out.errors).toEqual([]);

    expect(prisma.nflPlayer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "00-0033873" },
        data: expect.objectContaining({
          jerseyNumber: 15,
          heightInches: 74,
          weightLbs: 230,
          college: "Texas Tech",
          draftPick: 10,
        }),
      }),
    );
    expect(prisma.nflPlayer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "00-0034796",
          jerseyNumber: 87,
          heightInches: 77,
          weightLbs: 250,
          bbStats: {},
          bbSkills: [],
        }),
      }),
    );
  });

  it("collecte les erreurs sans arreter la boucle", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.nflPlayer.create)
      .mockRejectedValueOnce(new Error("dup key"))
      .mockResolvedValueOnce({} as never);

    const out = await ingestNflverseRosters({
      seasonId: "2025",
      fetchCsv: async () => SAMPLE_CSV,
    });

    expect(out.playersCreated).toBe(1);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]!.playerId).toBe("00-0033873");
  });

  it("throw PARSE_FAILED si seasonId invalide", async () => {
    await expect(
      ingestNflverseRosters({
        seasonId: "abc",
        fetchCsv: async () => "",
      }),
    ).rejects.toMatchObject({ code: "PARSE_FAILED" });
  });
});
