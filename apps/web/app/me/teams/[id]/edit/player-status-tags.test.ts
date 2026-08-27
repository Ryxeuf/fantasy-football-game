import { describe, expect, it } from "vitest";
import { playerStatusTags } from "./player-status-tags";

describe("playerStatusTags", () => {
  it("ne pose aucune etiquette sur un joueur sain", () => {
    expect(playerStatusTags({})).toEqual([]);
    expect(
      playerStatusTags({ dead: false, missNextMatch: false, nigglingInjuries: 0 }),
    ).toEqual([]);
  });

  it("pose l'etiquette Absent quand le joueur rate le prochain match", () => {
    const tags = playerStatusTags({ missNextMatch: true });
    expect(tags.map((t) => t.key)).toEqual(["absent"]);
    expect(tags[0].label).toBe("Absent");
  });

  it("pose l'etiquette Mort et remplace l'absence (un mort ne rate rien)", () => {
    const tags = playerStatusTags({ dead: true, missNextMatch: true });
    expect(tags.map((t) => t.key)).toEqual(["dead"]);
    expect(tags[0].label).toContain("Mort");
  });

  it("compte les Blessures Persistantes avec le sigle invariable BP", () => {
    expect(playerStatusTags({ nigglingInjuries: 1 })[0].label).toBe("1 BP");
    expect(playerStatusTags({ nigglingInjuries: 3 })[0].label).toBe("3 BP");
  });

  it("cumule mort/absence, BP et sequelles dans l'ordre de gravite", () => {
    const tags = playerStatusTags({
      missNextMatch: true,
      nigglingInjuries: 2,
      maReduction: 1,
      avReduction: 1,
    });
    expect(tags.map((t) => t.key)).toEqual(["absent", "niggling", "sequelae"]);
    expect(tags[2].label).toBe("-1 M, -1 AR");
  });

  it("affiche les sequelles AG/CP en hausse de seuil (jet a reussir)", () => {
    const tags = playerStatusTags({ agReduction: 1, paReduction: 2 });
    expect(tags[0].label).toBe("+1 AG, +2 CP");
  });
});
