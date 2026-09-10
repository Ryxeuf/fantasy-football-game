/**
 * Dérivations pures du bracket de coupe. Ce sont les trois règles qu'un
 * rendu ne vérifierait que de biais : l'ordre des tours, le placeholder qui
 * ne compte qu'une tête, et la fenêtre d'édition des têtes de série.
 */
import { describe, it, expect } from "vitest";
import {
  canEditSeeds,
  currentSeeds,
  firstStageOf,
  groupRoundsByStage,
  stageOf,
  type BracketRoundLike,
} from "./playoff-bracket";

function round(
  slot: string,
  roundNumber: number,
  overrides: Partial<BracketRoundLike> = {},
): BracketRoundLike {
  return {
    id: `r-${slot}`,
    roundNumber,
    slot,
    placeholder: false,
    homeTeam: { id: `${slot}-home` },
    awayTeam: { id: `${slot}-away` },
    pairingStatus: "scheduled",
    localMatch: null,
    ...overrides,
  };
}

describe("stageOf", () => {
  it("reconnaît chaque tour depuis son slot", () => {
    expect(stageOf("qf3")).toBe("qf");
    expect(stageOf("sf1")).toBe("sf");
    expect(stageOf("final")).toBe("final");
  });

  it("rend null sur un slot inconnu plutôt qu'un tour inventé", () => {
    expect(stageOf("consolante")).toBeNull();
    expect(stageOf("")).toBeNull();
  });
});

describe("groupRoundsByStage", () => {
  it("range les tours des quarts vers la finale, quel que soit l'ordre reçu", () => {
    const groups = groupRoundsByStage([
      round("final", 9),
      round("qf2", 2),
      round("sf1", 5),
      round("qf1", 1),
    ]);
    expect(groups.map((g) => g.stage)).toEqual(["qf", "sf", "final"]);
    expect(groups[0].rounds.map((r) => r.slot)).toEqual(["qf1", "qf2"]);
  });

  it("n'annonce que les tours présents", () => {
    const groups = groupRoundsByStage([round("sf1", 1), round("sf2", 2)]);
    expect(groups.map((g) => g.stage)).toEqual(["sf"]);
  });

  it("ignore un slot inconnu — une colonne « autre » ne voudrait rien dire", () => {
    const groups = groupRoundsByStage([round("qf1", 1), round("barrage", 2)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rounds).toHaveLength(1);
  });
});

describe("firstStageOf", () => {
  it("désigne le tour qui porte les têtes de série", () => {
    expect(firstStageOf(8)).toBe("qf");
    expect(firstStageOf(4)).toBe("sf");
    expect(firstStageOf(2)).toBe("final");
  });
});

describe("currentSeeds", () => {
  it("relit les têtes du premier tour, dans l'ordre", () => {
    const seeds = currentSeeds(
      [
        round("sf2", 2, {
          homeTeam: { id: "t2" },
          awayTeam: { id: "t3" },
        }),
        round("sf1", 1, {
          homeTeam: { id: "t1" },
          awayTeam: { id: "t4" },
        }),
        round("final", 3),
      ],
      4,
    );
    expect(seeds).toEqual(["t1", "t4", "t2", "t3"]);
  });

  it("ne compte un placeholder qu'une fois — sinon deux têtes seraient la même équipe", () => {
    const seeds = currentSeeds(
      [
        round("final", 3, {
          placeholder: true,
          homeTeam: { id: "t1" },
          awayTeam: { id: "t1" },
        }),
      ],
      2,
    );
    expect(seeds).toEqual(["t1"]);
  });

  it("ignore les tours avals", () => {
    const seeds = currentSeeds(
      [
        round("qf1", 1, { homeTeam: { id: "a" }, awayTeam: { id: "b" } }),
        round("sf1", 5, { homeTeam: { id: "z" }, awayTeam: { id: "z" } }),
      ],
      8,
    );
    expect(seeds).toEqual(["a", "b"]);
  });
});

describe("canEditSeeds", () => {
  it("autorise tant qu'aucune rencontre n'est lancée", () => {
    expect(canEditSeeds([round("sf1", 1), round("sf2", 2)])).toBe(true);
  });

  it("refuse dès qu'un match existe — réécrire effacerait son résultat", () => {
    expect(
      canEditSeeds([
        round("sf1", 1),
        round("sf2", 2, { localMatch: { id: "lm1" } }),
      ]),
    ).toBe(false);
  });

  it("refuse une rencontre déjà jouée même sans match local (résultat saisi)", () => {
    expect(canEditSeeds([round("sf1", 1, { pairingStatus: "played" })])).toBe(
      false,
    );
  });

  it("refuse sur un bracket vide : il n'y a rien à éditer", () => {
    expect(canEditSeeds([])).toBe(false);
  });
});
