import { describe, it, expect, vi } from "vitest";

vi.mock("../utils/server-log", () => ({
  serverLog: { warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));
import {
  buildNewsTicker,
  gatherNewsTicker,
  isHiddenPlayoffResult,
  mapLeagueSheet,
  mapLocalMatch,
  NEWS_TICKER_LIMITS,
  NEWS_TICKER_MAX_ITEMS,
  type LeagueSheetRow,
  type LocalMatchRow,
  type NewsTickerClient,
  type NewsTickerItem,
} from "./public-news-ticker";

const REGULAR = { kind: "regular", bracketSlot: null };
const FINAL = { kind: "playoff", bracketSlot: "final" };

function sheet(over: Partial<LeagueSheetRow> = {}, playoffs: {
  round?: { kind: string; bracketSlot: string | null };
  published?: boolean | null;
} = {}): LeagueSheetRow {
  return {
    id: "sheet-1",
    validatedAt: new Date("2026-09-20T10:00:00Z"),
    scoreHome: 2,
    scoreAway: 1,
    forfeitSide: null,
    pairing: {
      id: "p1",
      homeParticipant: { team: { name: "Rats", roster: "skaven" } },
      awayParticipant: { team: { name: "Nains", roster: "dwarf" } },
      round: {
        ...(playoffs.round ?? REGULAR),
        season: {
          playoffsPublished: playoffs.published ?? null,
          league: { id: "L1", name: "Ligue du Reikland" },
        },
      },
    },
    ...over,
  };
}

function localMatch(over: Partial<LocalMatchRow> = {}): LocalMatchRow {
  return {
    id: "lm1",
    completedAt: new Date("2026-09-21T10:00:00Z"),
    scoreTeamA: 1,
    scoreTeamB: 1,
    teamA: { name: "Orques", roster: "orc" },
    teamB: { name: "Elfes", roster: "wood_elf" },
    cup: { id: "C1", name: "Coupe d'automne", playoffsPublished: null },
    cupPairing: { round: REGULAR },
    ...over,
  };
}

function item(kind: NewsTickerItem["kind"], at: string, id = at): NewsTickerItem {
  return { kind, id, at, href: "/", title: id };
}

describe("buildNewsTicker", () => {
  it("trie par date décroissante", () => {
    const out = buildNewsTicker([
      item("blog_post", "2026-09-01T00:00:00Z"),
      item("league_result", "2026-09-03T00:00:00Z"),
      item("cup_result", "2026-09-02T00:00:00Z"),
    ]);
    expect(out.map((i) => i.kind)).toEqual(["league_result", "cup_result", "blog_post"]);
  });

  it("plafonne chaque famille puis le total", () => {
    const many = Array.from({ length: 20 }, (_, n) =>
      item("league_result", new Date(Date.UTC(2026, 8, n + 1)).toISOString()),
    );
    const out = buildNewsTicker([...many, item("blog_post", "2026-01-01T00:00:00Z")]);
    expect(out.filter((i) => i.kind === "league_result")).toHaveLength(
      NEWS_TICKER_LIMITS.league_result,
    );
    // Le blog, plus ancien, n'est pas noyé par les résultats.
    expect(out.some((i) => i.kind === "blog_post")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(NEWS_TICKER_MAX_ITEMS);
  });

  it("met les dates invalides en fin de liste", () => {
    const out = buildNewsTicker([
      item("blog_post", "pas une date", "bad"),
      item("league_result", "2026-09-03T00:00:00Z", "ok"),
    ]);
    expect(out.map((i) => i.id)).toEqual(["ok", "bad"]);
  });
});

describe("isHiddenPlayoffResult", () => {
  it("masque un tour de bracket non publié (kind ou bracketSlot)", () => {
    expect(isHiddenPlayoffResult(FINAL, false)).toBe(true);
    expect(isHiddenPlayoffResult({ kind: "regular", bracketSlot: "sf1" }, false)).toBe(true);
  });
  it("laisse passer un bracket publié ou antérieur (null)", () => {
    expect(isHiddenPlayoffResult(FINAL, true)).toBe(false);
    expect(isHiddenPlayoffResult(FINAL, null)).toBe(false);
  });
  it("laisse passer un tour régulier et l'absence de tour", () => {
    expect(isHiddenPlayoffResult(REGULAR, false)).toBe(false);
    expect(isHiddenPlayoffResult(null, false)).toBe(false);
  });
});

describe("mapLeagueSheet", () => {
  it("projette une feuille validée en résultat de ligue", () => {
    expect(mapLeagueSheet(sheet())).toEqual({
      kind: "league_result",
      id: "sheet-1",
      at: "2026-09-20T10:00:00.000Z",
      href: "/leagues/L1",
      title: "Ligue du Reikland",
      home: { name: "Rats", roster: "skaven" },
      away: { name: "Nains", roster: "dwarf" },
      scoreHome: 2,
      scoreAway: 1,
    });
  });
  it("porte le côté forfait", () => {
    expect(mapLeagueSheet(sheet({ forfeitSide: "away" }))?.forfeitSide).toBe("away");
    expect(mapLeagueSheet(sheet({ forfeitSide: "bogus" }))?.forfeitSide).toBeUndefined();
  });
  it("écarte un play-off non publié, une feuille de coupe et une date absente", () => {
    expect(mapLeagueSheet(sheet({}, { round: FINAL, published: false }))).toBeNull();
    expect(mapLeagueSheet(sheet({ pairing: null }))).toBeNull();
    expect(mapLeagueSheet(sheet({ validatedAt: null }))).toBeNull();
  });
});

describe("mapLocalMatch", () => {
  it("projette une rencontre de coupe", () => {
    expect(mapLocalMatch(localMatch())).toMatchObject({
      kind: "cup_result",
      href: "/cups/C1",
      title: "Coupe d'automne",
      scoreHome: 1,
      scoreAway: 1,
    });
  });
  it("écarte hors coupe, sans adversaire, sans score, ou play-off non publié", () => {
    expect(mapLocalMatch(localMatch({ cup: null }))).toBeNull();
    expect(mapLocalMatch(localMatch({ teamB: null }))).toBeNull();
    expect(mapLocalMatch(localMatch({ scoreTeamB: null }))).toBeNull();
    expect(mapLocalMatch(localMatch({ completedAt: null }))).toBeNull();
    expect(
      mapLocalMatch(
        localMatch({
          cup: { id: "C1", name: "X", playoffsPublished: false },
          cupPairing: { round: FINAL },
        }),
      ),
    ).toBeNull();
  });
});

describe("gatherNewsTicker", () => {
  function fakeDb(): NewsTickerClient & Record<string, { findMany: ReturnType<typeof vi.fn> }> {
    return {
      leagueMatchSheet: { findMany: vi.fn().mockResolvedValue([sheet()]) },
      localMatch: { findMany: vi.fn().mockResolvedValue([localMatch()]) },
      blogPost: {
        findMany: vi.fn().mockResolvedValue([
          { id: "b1", slug: "saison-3", title: "Saison 3", publishedAt: new Date("2026-09-22T00:00:00Z") },
        ]),
      },
      league: {
        findMany: vi.fn().mockResolvedValue([
          { id: "L2", name: "Ligue ouverte", createdAt: new Date("2026-09-10T00:00:00Z") },
        ]),
      },
      cup: {
        findMany: vi.fn().mockResolvedValue([
          { id: "C2", name: "Coupe ouverte", createdAt: new Date("2026-09-09T00:00:00Z") },
        ]),
      },
    };
  }

  it("agrège les cinq sources, triées", async () => {
    const out = await gatherNewsTicker(fakeDb());
    expect(out.map((i) => i.href)).toEqual([
      "/blog/saison-3",
      "/cups/C1",
      "/leagues/L1",
      "/leagues/L2",
      "/cups/C2",
    ]);
    expect(out[3]).toMatchObject({ kind: "competition_open", competition: "league" });
    expect(out[4]).toMatchObject({ kind: "competition_open", competition: "cup" });
  });

  it("ignore une source en échec ou absente sans vider le bandeau", async () => {
    const db = fakeDb();
    db.leagueMatchSheet.findMany.mockRejectedValue(new Error("boom"));
    const partial = { ...db, blogPost: undefined } as unknown as NewsTickerClient;
    const out = await gatherNewsTicker(partial);
    expect(out.map((i) => i.href)).toEqual(["/cups/C1", "/leagues/L2", "/cups/C2"]);
  });

  it("ne lit que des compétitions PUBLIQUES", async () => {
    const db = fakeDb();
    await gatherNewsTicker(db);
    const where = (m: { findMany: ReturnType<typeof vi.fn> }) =>
      JSON.stringify(m.findMany.mock.calls[0][0].where);
    expect(where(db.leagueMatchSheet)).toContain('"league":{"isPublic":true}');
    expect(where(db.leagueMatchSheet)).toContain('"status":"validated"');
    expect(where(db.localMatch)).toContain('"cup":{"isPublic":true}');
    expect(where(db.localMatch)).toContain('"isPublic":true');
    expect(where(db.league)).toContain('"isPublic":true');
    expect(where(db.cup)).toContain('"isPublic":true');
    expect(where(db.blogPost)).toContain('"status":"published"');
  });
});
