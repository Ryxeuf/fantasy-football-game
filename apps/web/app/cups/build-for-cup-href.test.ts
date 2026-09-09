import { describe, it, expect } from "vitest";
import { buildForCupHref } from "./build-for-cup-href";

describe("buildForCupHref", () => {
  it("porte l'identifiant, l'édition et le format de la coupe", () => {
    const href = buildForCupHref({ id: "c1", ruleset: "season_3", format: "sevens" });
    const params = new URLSearchParams(href.split("?")[1]);
    expect(href.startsWith("/me/teams/new?")).toBe(true);
    expect(params.get("cupId")).toBe("c1");
    expect(params.get("ruleset")).toBe("season_3");
    expect(params.get("format")).toBe("sevens");
  });

  it("retombe sur bb11 quand le format n'est pas renseigné", () => {
    const params = new URLSearchParams(
      buildForCupHref({ id: "c1", ruleset: "season_3", format: null }).split("?")[1],
    );
    expect(params.get("format")).toBe("bb11");
  });

  it("porte le RÈGLEMENT de la coupe (budget + PSP dès le 1er rendu)", () => {
    const params = new URLSearchParams(
      buildForCupHref({
        id: "c1",
        ruleset: "season_3",
        format: "bb11",
        tournamentRuleset: "naf_world_cup_2027",
      }).split("?")[1],
    );
    expect(params.get("tournamentRuleset")).toBe("naf_world_cup_2027");
  });

  it("omet le règlement quand la coupe n'en impose aucun", () => {
    const params = new URLSearchParams(
      buildForCupHref({ id: "c1", ruleset: "season_3" }).split("?")[1],
    );
    expect(params.has("tournamentRuleset")).toBe(false);
  });

  it("ajoute l'équipe de base pour « Adapter à la coupe »", () => {
    const params = new URLSearchParams(
      buildForCupHref({ id: "c1", ruleset: "season_3" }, "t42").split("?")[1],
    );
    expect(params.get("fromTeamId")).toBe("t42");
  });

  it("n'ajoute pas fromTeamId quand aucune équipe n'est choisie", () => {
    for (const empty of [undefined, null, ""]) {
      const params = new URLSearchParams(
        buildForCupHref({ id: "c1", ruleset: "season_3" }, empty).split("?")[1],
      );
      expect(params.has("fromTeamId")).toBe(false);
    }
  });
});
