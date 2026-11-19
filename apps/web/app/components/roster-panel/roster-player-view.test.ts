import { describe, expect, it } from "vitest";
import {
  availabilityOf,
  deathOriginLabel,
  formatKpo,
  formatTarget,
  hasTeamPlayerCard,
  lastingInjuriesLabel,
  playerValueLabel,
  rosterStatCells,
  rosterStatTestId,
} from "./roster-player-view";
import { competitionPlayerCardUrl } from "./player-card-export";

const base = { dead: false, spp: 0 };

describe("roster-player-view", () => {
  it("libelle les blessures durables (séquelles puis BP cumulées)", () => {
    expect(lastingInjuriesLabel(base)).toBe("");
    expect(
      lastingInjuriesLabel({
        ...base,
        nigglingInjuries: 2,
        statReductions: { ma: 1, st: 0, ag: 1, pa: 0, av: 1 },
      }),
    ).toBe("-1 M, +1 AG, -1 AR, 2 BP");
  });

  it("explique l'origine d'une mort", () => {
    expect(deathOriginLabel(base)).toBe("");
    expect(deathOriginLabel({ ...base, dead: true })).toBe("Décédé");
    expect(
      deathOriginLabel({ ...base, dead: true, statusSource: "match_sheet" }),
    ).toBe("Décédé — feuille de match");
  });

  it("dérive la disponibilité, la mort l'emportant sur l'absence", () => {
    expect(availabilityOf(base)).toBe("available");
    expect(availabilityOf({ ...base, missNextMatch: true })).toBe("absent");
    expect(availabilityOf({ ...base, dead: true, missNextMatch: true })).toBe("dead");
  });

  it("formate valeurs et caractéristiques", () => {
    expect(formatKpo(105_000)).toBe("105 k po");
    expect(playerValueLabel(undefined)).toBe("—");
    expect(formatTarget(null)).toBe("–");
    expect(formatTarget(3)).toBe("3+");
  });

  it("sert les sept statistiques dans l'ordre des colonnes, titres par compétition", () => {
    const cells = rosterStatCells(
      {
        ...base,
        spp: 12,
        matchesPlayed: 6,
        totalTouchdowns: 4,
        totalCasualties: 2,
        totalCompletions: 5,
        totalInterceptions: 1,
        aggressions: 3,
      },
      "league",
    );
    expect(cells.map((c) => [c.label, c.value])).toEqual([
      ["MJ", 6],
      ["TD", 4],
      ["Élim.", 2],
      ["Pas.", 5],
      ["Int.", 1],
      ["Agr.", 3],
      ["PSP", 12],
    ]);
    expect(rosterStatCells(base, "cup")[0].title).toBe("Matchs joués dans la coupe");
    expect(rosterStatCells(base, "cup").every((c) => c.value === 0)).toBe(true);
  });

  it("ne duplique jamais un data-testid du tableau dans les cartes", () => {
    expect(rosterStatTestId("matches", "p1", "table")).toBe("player-matches-p1");
    expect(rosterStatTestId("matches", "p1", "mobile")).toBe("player-matches-mobile-p1");
    expect(rosterStatTestId("spp", "p1", "table")).toBeUndefined();
  });

  it("réserve la carte PNG aux joueurs numérotés (pas aux Star Players)", () => {
    expect(hasTeamPlayerCard({ number: 7 })).toBe(true);
    expect(hasTeamPlayerCard({ number: null })).toBe(false);
  });

  it("construit l'URL de la carte PNG (aperçu / téléchargement)", () => {
    const player = {
      name: "Griff",
      number: 7,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "block",
      spp: 12,
      dead: false,
      value: 105_000,
    };
    const ctx = { teamName: "Reavers", rosterSlug: "human", positionName: "Blitzer" };
    const preview = competitionPlayerCardUrl(player, ctx, false);
    expect(preview.startsWith("/api/player-card?d=")).toBe(true);
    expect(preview).not.toContain("download=1");
    expect(competitionPlayerCardUrl(player, ctx, true)).toContain("&download=1");
  });
});
