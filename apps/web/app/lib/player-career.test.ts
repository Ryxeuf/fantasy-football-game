import { describe, expect, it } from "vitest";
import { resolvePlayerCareer } from "./player-career";

const raw = {
  id: "p-1",
  spp: 3,
  matchesPlayed: 2,
  totalTouchdowns: 1,
  totalCasualties: 0,
  totalCompletions: 4,
  totalInterceptions: 0,
  totalMvpAwards: 1,
};

describe("resolvePlayerCareer", () => {
  it("lit la carrière toutes compétitions servie par le serveur", () => {
    const career = resolvePlayerCareer(raw, {
      "p-1": {
        matchesPlayed: 5,
        touchdowns: 3,
        casualties: 2,
        completions: 4,
        interceptions: 1,
        mvpAwards: 2,
        spp: 3,
        cup: {
          matchesPlayed: 3,
          touchdowns: 2,
          casualties: 2,
          completions: 0,
          interceptions: 1,
          mvpAwards: 1,
        },
      },
    });
    expect(career).toEqual({
      matchesPlayed: 5,
      touchdowns: 3,
      casualties: 2,
      completions: 4,
      interceptions: 1,
      mvpAwards: 2,
      spp: 3,
      cup: {
        matchesPlayed: 3,
        touchdowns: 2,
        casualties: 2,
        completions: 0,
        interceptions: 1,
        mvpAwards: 1,
      },
    });
  });

  it("retombe sur les compteurs bruts face à un serveur antérieur", () => {
    expect(resolvePlayerCareer(raw, undefined)).toEqual({
      matchesPlayed: 2,
      touchdowns: 1,
      casualties: 0,
      completions: 4,
      interceptions: 0,
      mvpAwards: 1,
      spp: 3,
    });
    // Joueur absent de la map, ou entrée illisible.
    expect(resolvePlayerCareer(raw, { other: {} }).matchesPlayed).toBe(2);
    expect(resolvePlayerCareer(raw, { "p-1": { touchdowns: 9 } }).touchdowns).toBe(1);
  });

  it("rend zéro pour un joueur neuf sans compteur", () => {
    expect(resolvePlayerCareer({ id: "neuf" })).toEqual({
      matchesPlayed: 0,
      touchdowns: 0,
      casualties: 0,
      completions: 0,
      interceptions: 0,
      mvpAwards: 0,
      spp: 0,
    });
  });
});
