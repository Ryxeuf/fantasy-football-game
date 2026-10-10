import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/star-player-repository", () => ({
  getStarPlayerBySlugDb: vi.fn(),
}));

import { getStarPlayerBySlugDb } from "../utils/star-player-repository";
import {
  deriveSheetStarPlayers,
  deriveSideStarPlayers,
  isSheetStarPlayerId,
  parseFrozenStarPlayers,
  registeredStarPlayerSlugs,
  sheetCompetitionKind,
  isSyntheticSheetPlayerId,
  parseStarPlayerInducements,
  sheetStarPlayerSide,
  syntheticSheetPlayerSide,
} from "./league-sheet-star-players";

const mockGet = getStarPlayerBySlugDb as ReturnType<typeof vi.fn>;

const GRIFF = {
  slug: "griff_oberwald",
  displayName: "Griff Oberwald",
  cost: 280_000,
  ma: 7,
  st: 4,
  ag: 2,
  pa: 3,
  av: 9,
  skills: "block,dodge,sprint",
  hirableBy: ["all"],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("parseStarPlayerInducements", () => {
  it("ne garde que les entrees star_player avec un slug", () => {
    const out = parseStarPlayerInducements([
      { slug: "bribe", name: "Pot-de-vin", cost: 100_000, qty: 1 },
      {
        slug: "star_player",
        starPlayerSlug: "griff_oberwald",
        name: "Griff",
        cost: 280_000,
        qty: 1,
      },
      { slug: "star_player", name: "sans slug", cost: 0, qty: 1 },
    ]);
    expect(out).toEqual([
      { slug: "griff_oberwald", name: "Griff", cost: 280_000, qty: 1 },
    ]);
  });

  it("parse la forme string (miroir sqlite) et dedoublonne par slug", () => {
    const out = parseStarPlayerInducements(
      JSON.stringify([
        { slug: "star_player", starPlayerSlug: "griff_oberwald", cost: 1 },
        { slug: "star_player", starPlayerSlug: "griff_oberwald", cost: 1 },
      ]),
    );
    expect(out).toHaveLength(1);
  });

  it("tolere null / JSON invalide / forme inattendue", () => {
    expect(parseStarPlayerInducements(null)).toEqual([]);
    expect(parseStarPlayerInducements("{pas du json")).toEqual([]);
    expect(parseStarPlayerInducements({ slug: "star_player" })).toEqual([]);
  });
});

describe("deriveSheetStarPlayers", () => {
  it("derive un joueur synthetique depuis la fiche catalogue", async () => {
    mockGet.mockResolvedValue(GRIFF);
    const out = await deriveSheetStarPlayers({
      side: "home",
      inducements: [
        { slug: "star_player", starPlayerSlug: "griff_oberwald", cost: 280_000 },
      ],
      ruleset: "season_3",
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "star-home-griff_oberwald",
      name: "Griff Oberwald",
      position: "star_player",
      positionName: "Star Player",
      stats: { ma: 7, st: 4, ag: 2, pa: 3, av: 9 },
      skills: "block,dodge,sprint",
      cost: 280_000,
    });
    // Numero hors des 16 maillots reglementaires : aucune collision.
    expect(out[0].number).toBeGreaterThan(16);
    expect(mockGet).toHaveBeenCalledWith("griff_oberwald", "season_3");
  });

  it("reste selectionnable quand la fiche catalogue est introuvable", async () => {
    mockGet.mockResolvedValue(null);
    const out = await deriveSheetStarPlayers({
      side: "away",
      inducements: [
        { slug: "star_player", starPlayerSlug: "inconnu", name: "X", cost: 150_000 },
      ],
    });
    expect(out[0]).toMatchObject({ id: "star-away-inconnu", name: "X", cost: 150_000 });
  });

  it("retourne [] sans aucun Star Player engage (pas de lookup DB)", async () => {
    const out = await deriveSheetStarPlayers({
      side: "home",
      inducements: [{ slug: "bribe", cost: 100_000 }],
    });
    expect(out).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("un echec du lookup ne casse pas la derivation", async () => {
    mockGet.mockRejectedValue(new Error("db down"));
    const out = await deriveSheetStarPlayers({
      side: "home",
      inducements: [{ slug: "star_player", starPlayerSlug: "griff_oberwald" }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("star-home-griff_oberwald");
  });
});

describe("sheetStarPlayerSide / syntheticSheetPlayerSide", () => {
  it("lit le côté d'un Star Player ou d'un journalier dans son id", () => {
    expect(sheetStarPlayerSide("star-home-griff_oberwald")).toBe("home");
    expect(sheetStarPlayerSide("star-away-griff_oberwald")).toBe("away");
    expect(syntheticSheetPlayerSide("star-away-griff_oberwald")).toBe("away");
    expect(syntheticSheetPlayerSide("journeyman-home-2")).toBe("home");
  });

  it("lit aussi le côté d'un mort relevé (Maîtres de la Non-vie)", () => {
    expect(syntheticSheetPlayerSide("raised-home-1")).toBe("home");
    expect(syntheticSheetPlayerSide("raised-away-1")).toBe("away");
    expect(sheetStarPlayerSide("raised-home-1")).toBeNull();
  });

  it("null pour un joueur réel ou un id mal formé", () => {
    expect(sheetStarPlayerSide("cku123abc")).toBeNull();
    expect(sheetStarPlayerSide("journeyman-home-1")).toBeNull();
    expect(syntheticSheetPlayerSide("cku123abc")).toBeNull();
    expect(syntheticSheetPlayerSide("star-north-x")).toBeNull();
    expect(syntheticSheetPlayerSide(null)).toBeNull();
  });
});

describe("isSheetStarPlayerId / isSyntheticSheetPlayerId", () => {
  it("reconnait les ids synthetiques de la feuille", () => {
    expect(isSheetStarPlayerId("star-home-griff_oberwald")).toBe(true);
    expect(isSheetStarPlayerId("journeyman-home-1")).toBe(false);
    expect(isSheetStarPlayerId("clx123")).toBe(false);
    expect(isSyntheticSheetPlayerId("journeyman-away-2")).toBe(true);
    expect(isSyntheticSheetPlayerId("star-away-x")).toBe(true);
    // Troisième famille : le mort relevé par Maîtres de la Non-vie.
    expect(isSyntheticSheetPlayerId("raised-home-1")).toBe(true);
    expect(isSyntheticSheetPlayerId("clx123")).toBe(false);
    expect(isSyntheticSheetPlayerId(null)).toBe(false);
  });
});

describe("deriveSideStarPlayers", () => {
  const MORG = {
    ...GRIFF,
    slug: "morg_n_thorg",
    displayName: "Morg 'n' Thorg",
    cost: 380_000,
  };
  const frozen = {
    roster: "human",
    players: [],
    starPlayers: [{ starPlayerSlug: "morg_n_thorg", cost: 380_000 }],
  };
  const griffInducement = [
    { slug: "star_player", starPlayerSlug: "griff_oberwald", cost: 280_000 },
  ];

  it("coupe : aligne les Star Players du roster figé (achetés au build)", async () => {
    mockGet.mockResolvedValue(MORG);
    const out = await deriveSideStarPlayers({
      side: "home",
      inducements: null,
      frozenSnapshot: frozen,
      competitionKind: "cup",
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "star-home-morg_n_thorg",
      name: "Morg 'n' Thorg",
      registered: true,
    });
  });

  it("coupe : lit aussi le snapshot sérialisé du miroir SQLite", async () => {
    mockGet.mockResolvedValue(MORG);
    const out = await deriveSideStarPlayers({
      side: "away",
      inducements: undefined,
      frozenSnapshot: JSON.stringify(frozen),
      competitionKind: "cup",
    });
    expect(out.map((s) => s.id)).toEqual(["star-away-morg_n_thorg"]);
  });

  it("coupe : fusionne figés et avant-match, sans doublon", async () => {
    mockGet.mockImplementation(async (slug: string) =>
      slug === "griff_oberwald" ? GRIFF : MORG,
    );
    const out = await deriveSideStarPlayers({
      side: "home",
      inducements: [
        ...griffInducement,
        { slug: "star_player", starPlayerSlug: "morg_n_thorg", cost: 1 },
      ],
      frozenSnapshot: frozen,
      competitionKind: "cup",
    });
    expect(out.map((s) => s.slug)).toEqual(["morg_n_thorg", "griff_oberwald"]);
    expect(out[0].registered).toBe(true);
    expect(out[1].registered).toBeUndefined();
    // Numéros distincts, hors des numéros de maillot.
    expect(new Set(out.map((s) => s.number)).size).toBe(2);
  });

  it("avant-match seul : identique à la dérivation historique", async () => {
    mockGet.mockResolvedValue(GRIFF);
    const out = await deriveSideStarPlayers({
      side: "home",
      inducements: griffInducement,
      competitionKind: "cup",
    });
    expect(out.map((s) => s.id)).toEqual(["star-home-griff_oberwald"]);
  });

  it("ligue : ignore les Star Players du roster figé", async () => {
    mockGet.mockResolvedValue(GRIFF);
    const out = await deriveSideStarPlayers({
      side: "home",
      inducements: griffInducement,
      frozenSnapshot: frozen,
      competitionKind: "league",
    });
    expect(out.map((s) => s.slug)).toEqual(["griff_oberwald"]);
  });

  it("snapshot sans `starPlayers` ou illisible : aucun Star Player figé", async () => {
    expect(
      await deriveSideStarPlayers({
        side: "home",
        inducements: null,
        frozenSnapshot: { roster: "human", players: [] },
        competitionKind: "cup",
      }),
    ).toEqual([]);
    expect(parseFrozenStarPlayers("{pas du json")).toEqual([]);
    expect(parseFrozenStarPlayers(null)).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe("registeredStarPlayerSlugs / sheetCompetitionKind", () => {
  it("ne lit les Star Players figés qu'en coupe", () => {
    const frozen = { starPlayers: [{ starPlayerSlug: "griff_oberwald", cost: 1 }] };
    expect(
      registeredStarPlayerSlugs({ frozenSnapshot: frozen, competitionKind: "cup" }),
    ).toEqual(["griff_oberwald"]);
    expect(
      registeredStarPlayerSlugs({ frozenSnapshot: frozen, competitionKind: "league" }),
    ).toEqual([]);
  });

  it("une feuille de coupe porte `cupPairingId`", () => {
    expect(sheetCompetitionKind({ cupPairingId: "cp1" })).toBe("cup");
    expect(sheetCompetitionKind({ cupPairingId: null })).toBe("league");
    expect(sheetCompetitionKind({})).toBe("league");
  });
});
