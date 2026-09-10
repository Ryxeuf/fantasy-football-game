/**
 * Groupement par poule côté COUPE : ce qui lui est propre — la poule se lit
 * par l'équipe à domicile, et une ronde de bracket ne se groupe jamais.
 */
import { describe, it, expect } from "vitest";
import {
  groupCupRoundByPool,
  poolIdByTeamId,
  poolNamesById,
  preferredPoolIdFor,
} from "./round-pools";

const NAMES = { pa: "Poule A", pb: "Poule B" };
const BY_TEAM = { t1: "pa", t2: "pb", t3: "pa", t4: null };

const pairing = (id: string, homeTeamId: string) => ({
  id,
  homeTeam: { id: homeTeamId },
});

describe("groupCupRoundByPool", () => {
  it("groupe une ronde de classement par la poule de l'équipe à domicile", () => {
    const groups = groupCupRoundByPool(
      { pairings: [pairing("m1", "t1"), pairing("m2", "t2")] },
      NAMES,
      BY_TEAM,
    );
    expect(groups!.map((g) => g.poolName)).toEqual(["Poule A", "Poule B"]);
  });

  it("ne groupe JAMAIS une ronde de bracket — la finale oppose deux poules", () => {
    const groups = groupCupRoundByPool(
      {
        kind: "playoff",
        pairings: [pairing("f1", "t1"), pairing("f2", "t2")],
      },
      NAMES,
      BY_TEAM,
    );
    expect(groups).toBeNull();
  });

  it("laisse une ronde `regular` explicite se grouper", () => {
    const groups = groupCupRoundByPool(
      { kind: "regular", pairings: [pairing("m1", "t1"), pairing("m2", "t2")] },
      NAMES,
      BY_TEAM,
    );
    expect(groups).not.toBeNull();
  });

  it("rend null sur une coupe sans poule : l'affichage reste à plat", () => {
    expect(
      groupCupRoundByPool(
        { pairings: [pairing("m1", "t1"), pairing("m2", "t2")] },
        {},
        {},
      ),
    ).toBeNull();
  });

  it("range un exempt dans la poule de son équipe (il n'a pas d'extérieur)", () => {
    const groups = groupCupRoundByPool(
      { pairings: [pairing("bye", "t3"), pairing("m2", "t2")] },
      NAMES,
      BY_TEAM,
    );
    expect(groups!.find((g) => g.poolId === "pa")!.items[0].id).toBe("bye");
  });

  it("remonte la poule du coach", () => {
    const groups = groupCupRoundByPool(
      { pairings: [pairing("m1", "t1"), pairing("m2", "t2")] },
      NAMES,
      BY_TEAM,
      "pb",
    );
    expect(groups!.map((g) => g.poolId)).toEqual(["pb", "pa"]);
  });

  it("garde une équipe non affectée visible, en queue", () => {
    const groups = groupCupRoundByPool(
      { pairings: [pairing("m1", "t1"), pairing("m4", "t4")] },
      NAMES,
      BY_TEAM,
    );
    expect(groups!.map((g) => g.poolId)).toEqual(["pa", null]);
  });
});

describe("preferredPoolIdFor", () => {
  const participants = [
    { id: "t1", poolId: "pa" },
    { id: "t2", poolId: "pb" },
    { id: "t4", poolId: null },
  ];

  it("rend la poule de l'équipe du coach", () => {
    expect(preferredPoolIdFor(participants, ["t2"])).toBe("pb");
  });

  it("rend null quand le coach n'est pas inscrit", () => {
    expect(preferredPoolIdFor(participants, [])).toBeNull();
    expect(preferredPoolIdFor(participants, ["inconnu"])).toBeNull();
  });

  it("rend null quand l'équipe du coach n'est affectée à aucune poule", () => {
    expect(preferredPoolIdFor(participants, ["t4"])).toBeNull();
  });

  it("tranche sur la PREMIÈRE équipe affectée quand le coach en aligne deux", () => {
    expect(preferredPoolIdFor(participants, ["t2", "t1"])).toBe("pa");
  });
});

describe("index par équipe et par poule", () => {
  it("indexe les affectations, `null` compris", () => {
    expect(
      poolIdByTeamId([
        { id: "t1", poolId: "pa" },
        { id: "t4" },
      ]),
    ).toEqual({ t1: "pa", t4: null });
  });

  it("indexe les noms de poule", () => {
    expect(poolNamesById([{ id: "pa", name: "Poule A" }])).toEqual({
      pa: "Poule A",
    });
    expect(poolNamesById([])).toEqual({});
  });
});
