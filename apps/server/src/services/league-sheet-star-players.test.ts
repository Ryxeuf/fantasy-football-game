import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/star-player-repository", () => ({
  getStarPlayerBySlugDb: vi.fn(),
}));

import { getStarPlayerBySlugDb } from "../utils/star-player-repository";
import {
  deriveSheetStarPlayers,
  isSheetStarPlayerId,
  isSyntheticSheetPlayerId,
  parseStarPlayerInducements,
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

describe("isSheetStarPlayerId / isSyntheticSheetPlayerId", () => {
  it("reconnait les ids synthetiques de la feuille", () => {
    expect(isSheetStarPlayerId("star-home-griff_oberwald")).toBe(true);
    expect(isSheetStarPlayerId("journeyman-home-1")).toBe(false);
    expect(isSheetStarPlayerId("clx123")).toBe(false);
    expect(isSyntheticSheetPlayerId("journeyman-away-2")).toBe(true);
    expect(isSyntheticSheetPlayerId("star-away-x")).toBe(true);
    expect(isSyntheticSheetPlayerId("clx123")).toBe(false);
    expect(isSyntheticSheetPlayerId(null)).toBe(false);
  });
});
