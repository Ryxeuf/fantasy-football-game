/**
 * Index Ligue → équipes éligibles, construit depuis la BASE
 * (`Roster.regionalRules` servi par `/api/rosters`).
 *
 * Audit statique vs base — lot 5 (W8) : les pages Ligues partaient des tables
 * compilées `getRegionalLeaguesWithRosters` / `getRostersForRegionalLeague`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/serverApi", () => ({
  getServerApiBase: () => "http://api.test",
  safeServerJson: vi.fn(),
}));

import { safeServerJson } from "../lib/serverApi";
import {
  fetchLeagueRosterIndex,
  resolveRosters,
  type RosterInfo,
} from "./data";

const json = safeServerJson as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchLeagueRosterIndex", () => {
  it("inverse les options de Ligue déclarées par chaque roster", async () => {
    json.mockResolvedValue({
      rosters: [
        {
          slug: "skaven",
          regionalLeagueOptions: [
            { slug: "underworld_challenge", name: "Défi des Bas-Fonds" },
          ],
        },
        {
          slug: "goblin",
          regionalLeagueOptions: [
            { slug: "underworld_challenge", name: "Défi des Bas-Fonds" },
            { slug: "badlands_brawl", name: "Bagarre des Terres Arides" },
          ],
        },
      ],
    });

    const index = await fetchLeagueRosterIndex("season_3");

    expect(index.get("underworld_challenge")).toEqual({
      slug: "underworld_challenge",
      name: "Défi des Bas-Fonds",
      rosterSlugs: ["goblin", "skaven"],
    });
    expect(index.get("badlands_brawl")?.rosterSlugs).toEqual(["goblin"]);
  });

  it("interroge l'édition demandée", async () => {
    json.mockResolvedValue({ rosters: [] });
    await fetchLeagueRosterIndex("season_2");
    expect(json).toHaveBeenCalledWith(
      "http://api.test/api/rosters?lang=fr&ruleset=season_2",
      expect.anything(),
    );
  });

  it("expose une Ligue qu'aucun catalogue compilé ne connaît", async () => {
    json.mockResolvedValue({
      rosters: [
        {
          slug: "roster_maison",
          regionalLeagueOptions: [
            { slug: "ligue_maison", name: "Ligue Maison" },
          ],
        },
      ],
    });
    const index = await fetchLeagueRosterIndex("season_3");
    expect(index.get("ligue_maison")?.rosterSlugs).toEqual(["roster_maison"]);
  });

  it("ignore les entrées incomplètes", async () => {
    json.mockResolvedValue({
      rosters: [
        { regionalLeagueOptions: [{ slug: "orphan" }] },
        { slug: "human", regionalLeagueOptions: [{ name: "sans slug" }] },
      ],
    });
    expect((await fetchLeagueRosterIndex("season_3")).size).toBe(0);
  });

  it("API injoignable -> index vide (repli catalogue côté page)", async () => {
    json.mockResolvedValue(null);
    expect((await fetchLeagueRosterIndex("season_3")).size).toBe(0);
  });
});

const MAP = new Map<string, RosterInfo>([
  ["wood_elf", { slug: "wood_elf", name: "Elfes Sylvains", tier: "I", naf: false, positionCount: 6 }],
  ["high_elf", { slug: "high_elf", name: "Hauts Elfes", tier: "II", naf: false, positionCount: 5 }],
]);

describe("resolveRosters", () => {
  it("résout les slugs connus en infos d'équipe, dans l'ordre d'entrée", () => {
    const result = resolveRosters(["high_elf", "wood_elf"], MAP);
    expect(result.map((r) => r.name)).toEqual(["Hauts Elfes", "Elfes Sylvains"]);
  });

  it("retombe sur un nom dérivé du slug si l'équipe est absente de l'API", () => {
    const result = resolveRosters(["chaos_dwarf"], MAP);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      slug: "chaos_dwarf",
      name: "Chaos Dwarf",
      tier: "",
    });
  });
});
