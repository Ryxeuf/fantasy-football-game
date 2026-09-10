import { describe, it, expect } from "vitest";
import {
  mergeGroupRounds,
  poolGroups,
  toCupRoundPlan,
} from "./cup-rounds";

const team = (id: string, poolId: string | null) => ({
  poolId,
  team: { id },
});

describe("poolGroups (PUR)", () => {
  const RANKED = ["t1", "t2", "t3", "t4", "t5", "t6"];

  it("sans poule : un seul groupe, toute la coupe", () => {
    expect(poolGroups([], RANKED.map((id) => team(id, null)), RANKED)).toEqual([
      { poolId: null, teamIds: RANKED },
    ]);
  });

  it("des poules déclarées mais aucune équipe affectée = pas de poules", () => {
    // Créer les poules et ne rien y mettre ne doit pas produire six groupes
    // vides ni bloquer la génération.
    expect(
      poolGroups(
        [{ id: "A" }, { id: "B" }],
        RANKED.map((id) => team(id, null)),
        RANKED,
      ),
    ).toEqual([{ poolId: null, teamIds: RANKED }]);
  });

  it("un groupe par poule, dans l'ordre des poules", () => {
    const participants = [
      team("t1", "A"),
      team("t2", "B"),
      team("t3", "A"),
      team("t4", "B"),
    ];
    expect(
      poolGroups([{ id: "A" }, { id: "B" }], participants, [
        "t1",
        "t2",
        "t3",
        "t4",
      ]),
    ).toEqual([
      { poolId: "A", teamIds: ["t1", "t3"] },
      { poolId: "B", teamIds: ["t2", "t4"] },
    ]);
  });

  it("conserve l'ordre du CLASSEMENT à l'intérieur d'un groupe", () => {
    const participants = [team("t1", "A"), team("t2", "A"), team("t3", "A")];
    // Classement inversé : le groupe doit le suivre, pas l'ordre d'inscription.
    expect(
      poolGroups([{ id: "A" }], participants, ["t3", "t1", "t2"])[0].teamIds,
    ).toEqual(["t3", "t1", "t2"]);
  });

  it("range les équipes sans poule dans un dernier groupe", () => {
    const participants = [
      team("t1", "A"),
      team("t2", "A"),
      team("t3", null),
      team("t4", null),
    ];
    expect(
      poolGroups([{ id: "A" }], participants, ["t1", "t2", "t3", "t4"]),
    ).toEqual([
      { poolId: "A", teamIds: ["t1", "t2"] },
      { poolId: null, teamIds: ["t3", "t4"] },
    ]);
  });

  it("récupère une équipe dont la poule a disparu", () => {
    // `onDelete: SetNull` couvre la suppression propre ; une poule d'une autre
    // coupe ou un id périmé ne doit pas faire disparaître l'équipe.
    const participants = [team("t1", "A"), team("t2", "fantome")];
    expect(poolGroups([{ id: "A" }], participants, ["t1", "t2"])).toEqual([
      { poolId: "A", teamIds: ["t1"] },
      { poolId: null, teamIds: ["t2"] },
    ]);
  });

  it("ignore une poule vide", () => {
    const participants = [team("t1", "A")];
    expect(
      poolGroups([{ id: "A" }, { id: "B" }], participants, ["t1"]),
    ).toEqual([{ poolId: "A", teamIds: ["t1"] }]);
  });
});

describe("mergeGroupRounds (PUR)", () => {
  const round = (
    pairings: Array<[string, string]>,
    bye: string | null = null,
    rematchForced = false,
  ) => ({
    pairings: pairings.map(([home, away], i) => ({
      home,
      away,
      table: i + 1,
    })),
    bye,
    rematchForced,
  });

  it("concatène et renumérote les tables en continu", () => {
    const merged = mergeGroupRounds([
      round([
        ["a1", "a2"],
        ["a3", "a4"],
      ]),
      round([["b1", "b2"]]),
    ]);
    expect(merged.pairings.map((p) => p.table)).toEqual([1, 2, 3]);
    expect(merged.pairings.map((p) => p.home)).toEqual(["a1", "a3", "b1"]);
  });

  it("garde UN exempt PAR groupe impair", () => {
    const merged = mergeGroupRounds([
      round([["a1", "a2"]], "a3"),
      round([["b1", "b2"]], "b3"),
    ]);
    expect(merged.byes).toEqual(["a3", "b3"]);
  });

  it("ne remonte aucun exempt quand tous les groupes sont pairs", () => {
    expect(mergeGroupRounds([round([["a1", "a2"]])]).byes).toEqual([]);
  });

  it("propage un rematch forcé d'un seul groupe", () => {
    const merged = mergeGroupRounds([
      round([["a1", "a2"]]),
      round([["b1", "b2"]], null, true),
    ]);
    expect(merged.rematchForced).toBe(true);
  });

  it("rend un plan vide sans groupe", () => {
    expect(mergeGroupRounds([])).toEqual({
      pairings: [],
      byes: [],
      rematchForced: false,
    });
  });
});

describe("toCupRoundPlan (PUR)", () => {
  it("transforme l'exempt unique du moteur en liste", () => {
    expect(
      toCupRoundPlan({
        pairings: [{ home: "a", away: "b", table: 1 }],
        bye: "c",
        rematchForced: false,
      }),
    ).toEqual({
      pairings: [{ home: "a", away: "b", table: 1 }],
      byes: ["c"],
      rematchForced: false,
    });
  });

  it("rend une liste vide sans exempt", () => {
    expect(
      toCupRoundPlan({ pairings: [], bye: null, rematchForced: true }),
    ).toEqual({ pairings: [], byes: [], rematchForced: true });
  });
});
