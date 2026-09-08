import { describe, it, expect } from "vitest";
import { putPoolFirst } from "./pool-order";

const pools = [
  { poolId: "A", name: "Poule A" },
  { poolId: "B", name: "Poule B" },
  { poolId: "C", name: "Poule C" },
];

describe("putPoolFirst", () => {
  it("remonte la poule du coach en tête sans toucher à l'ordre des autres", () => {
    expect(putPoolFirst(pools, (p) => p.poolId, "B").map((p) => p.poolId)).toEqual([
      "B",
      "A",
      "C",
    ]);
  });

  it("ne change rien sans poule préférée ou si elle est inconnue", () => {
    expect(putPoolFirst(pools, (p) => p.poolId, null).map((p) => p.poolId)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(putPoolFirst(pools, (p) => p.poolId, "Z").map((p) => p.poolId)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("renvoie toujours une nouvelle liste", () => {
    const out = putPoolFirst(pools, (p) => p.poolId, null);
    expect(out).not.toBe(pools);
    expect(out).toEqual(pools);
  });
});
