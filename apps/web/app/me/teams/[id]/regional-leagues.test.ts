import { describe, it, expect } from "vitest";
import { displayedRegionalLeagues } from "./regional-leagues";

const LEAGUES = [
  { slug: "norse_league", name: "Ligue Nordique" },
  { slug: "chaos_clash", name: "Clash du Chaos" },
  { slug: "old_world_classic", name: "Old World Classic" },
];

describe("displayedRegionalLeagues (A159)", () => {
  it("n'affiche QUE la Ligue retenue par l'équipe", () => {
    expect(displayedRegionalLeagues(LEAGUES, "chaos_clash")).toEqual([
      { slug: "chaos_clash", name: "Clash du Chaos" },
    ]);
  });

  it("affiche toutes les Ligues du roster sans choix enregistré", () => {
    // Équipe antérieure à la règle du choix : elles s'appliquent toutes.
    expect(displayedRegionalLeagues(LEAGUES, null)).toEqual(LEAGUES);
    expect(displayedRegionalLeagues(LEAGUES, undefined)).toEqual(LEAGUES);
    expect(displayedRegionalLeagues(LEAGUES, "")).toEqual(LEAGUES);
  });

  it("retombe sur la liste complète si le choix n'est plus au catalogue", () => {
    // Ligue renommée/retirée : mieux vaut la liste du roster qu'une section
    // vide qui ferait croire à une équipe sans Ligue.
    expect(displayedRegionalLeagues(LEAGUES, "ligue_disparue")).toEqual(
      LEAGUES,
    );
  });

  it("ne mute pas la liste reçue", () => {
    const out = displayedRegionalLeagues(LEAGUES, null);
    out.pop();
    expect(LEAGUES).toHaveLength(3);
  });

  it("gère un roster sans Ligue", () => {
    expect(displayedRegionalLeagues([], "chaos_clash")).toEqual([]);
  });
});
