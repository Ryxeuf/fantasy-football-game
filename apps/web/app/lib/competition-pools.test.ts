/**
 * Moteur de groupement par poule, partagé ligue ↔ coupe. Les règles qui ne
 * se voient pas dans un rendu : le seuil de découpage, le tri, la poule
 * préférée, et le sort des non-affectés.
 */
import { describe, it, expect } from "vitest";
import { groupByPool, putPoolFirst } from "./competition-pools";

const NAMES = { A: "Poule A", B: "Poule B", C: "Poule C" };
const item = (id: string, pool: string | null) => ({ id, pool });

function group(
  items: ReadonlyArray<{ id: string; pool: string | null }>,
  preferred: string | null = null,
  names: Record<string, string> = NAMES,
) {
  return groupByPool(items, (i) => i.pool, names, preferred);
}

describe("putPoolFirst", () => {
  const pools = [
    { poolId: "A" },
    { poolId: "B" },
    { poolId: "C" },
  ];

  it("remonte la poule préférée sans toucher à l'ordre des autres", () => {
    expect(putPoolFirst(pools, (p) => p.poolId, "B").map((p) => p.poolId)).toEqual(
      ["B", "A", "C"],
    );
  });

  it("ne change rien sans poule préférée ou si elle est inconnue", () => {
    expect(putPoolFirst(pools, (p) => p.poolId, null).map((p) => p.poolId)).toEqual(
      ["A", "B", "C"],
    );
    expect(putPoolFirst(pools, (p) => p.poolId, "Z").map((p) => p.poolId)).toEqual(
      ["A", "B", "C"],
    );
  });

  it("renvoie toujours une nouvelle liste", () => {
    const out = putPoolFirst(pools, (p) => p.poolId, null);
    expect(out).not.toBe(pools);
    expect(out).toEqual(pools);
  });
});

describe("groupByPool", () => {
  it("rend null sans aucune poule déclarée", () => {
    expect(group([item("1", "A")], null, {})).toBeNull();
  });

  it("rend null quand une seule poule est représentée — un bandeau unique n'apprendrait rien", () => {
    expect(group([item("1", "A"), item("2", "A")])).toBeNull();
  });

  it("groupe dès que deux poules sont représentées", () => {
    const groups = group([item("1", "A"), item("2", "B"), item("3", "A")]);
    expect(groups!.map((g) => g.poolName)).toEqual(["Poule A", "Poule B"]);
    expect(groups!.find((g) => g.poolId === "A")!.items).toHaveLength(2);
  });

  it("trie par nom de poule, pas par ordre d'apparition", () => {
    const groups = group([item("1", "C"), item("2", "A"), item("3", "B")]);
    expect(groups!.map((g) => g.poolId)).toEqual(["A", "B", "C"]);
  });

  it("remonte la poule préférée en tête", () => {
    const groups = group([item("1", "A"), item("2", "B"), item("3", "C")], "C");
    expect(groups!.map((g) => g.poolId)).toEqual(["C", "A", "B"]);
  });

  it("regroupe les non-affectés en QUEUE plutôt que de les taire", () => {
    const groups = group([item("1", "A"), item("2", null)]);
    expect(groups!.map((g) => g.poolId)).toEqual(["A", null]);
    expect(groups!.at(-1)!.poolName).toBeNull();
  });

  it("ferme la marche avec les non-affectés même face à un nom de poule tardif", () => {
    const groups = group([item("1", null), item("2", "Z")], null, { Z: "Zulu" });
    expect(groups!.map((g) => g.poolId)).toEqual(["Z", null]);
  });

  it("traite une poule inconnue du dictionnaire comme un groupe sans nom", () => {
    const groups = group([item("1", "A"), item("2", "INCONNUE")]);
    const orphan = groups!.find((g) => g.poolId === "INCONNUE");
    expect(orphan).toBeTruthy();
    expect(orphan!.poolName).toBeNull();
  });

  it("préserve l'ordre des rencontres à l'intérieur d'un groupe", () => {
    const groups = group([
      item("1", "A"),
      item("2", "B"),
      item("3", "A"),
      item("4", "A"),
    ]);
    expect(groups!.find((g) => g.poolId === "A")!.items.map((i) => i.id)).toEqual(
      ["1", "3", "4"],
    );
  });
});
