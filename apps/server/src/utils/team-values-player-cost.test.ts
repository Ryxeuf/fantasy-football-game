/**
 * `sumPlayerCostsForTeam` — coût des joueurs au tarif de la BASE.
 *
 * Audit statique vs base — lot 3 (S5, S6). Les contrôles de budget
 * mélangeaient deux tarifs : le total des joueurs existants venait du
 * catalogue compilé (`getPlayerCost`), le joueur ajouté du tarif base
 * (`Position.cost`). Un prix corrigé en admin autorisait — ou refusait — un
 * recrutement à tort.
 */
import { describe, it, expect, vi } from "vitest";
import { sumPlayerCostsForTeam } from "./team-values";

const TEAM = { roster: "human", ruleset: "season_3" };

function prismaWith(rows: Array<{ slug: string; cost: number; max: number }>) {
  return {
    position: { findMany: vi.fn().mockResolvedValue(rows) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("sumPlayerCostsForTeam", () => {
  it("somme au tarif base (kpo -> po)", async () => {
    const db = prismaWith([
      { slug: "human_lineman", cost: 55, max: 16 },
      { slug: "human_blitzer", cost: 90, max: 4 },
    ]);

    const total = await sumPlayerCostsForTeam(db, TEAM, [
      { position: "human_lineman" },
      { position: "human_lineman" },
      { position: "human_blitzer" },
    ]);

    expect(total).toBe(55_000 * 2 + 90_000);
  });

  it("suit une correction de prix faite en admin", async () => {
    const before = await sumPlayerCostsForTeam(
      prismaWith([{ slug: "human_lineman", cost: 50, max: 16 }]),
      TEAM,
      [{ position: "human_lineman" }],
    );
    const after = await sumPlayerCostsForTeam(
      prismaWith([{ slug: "human_lineman", cost: 60, max: 16 }]),
      TEAM,
      [{ position: "human_lineman" }],
    );

    expect(before).toBe(50_000);
    expect(after).toBe(60_000);
  });

  it("retombe sur le catalogue poste par poste quand la base ignore le slug", async () => {
    const db = prismaWith([{ slug: "human_lineman", cost: 60, max: 16 }]);

    const total = await sumPlayerCostsForTeam(db, TEAM, [
      { position: "human_lineman" },
      // Absent de la base : repli catalogue. `getPlayerCost` ne lève jamais
      // — slug inconnu ⇒ table par nom anglais ⇒ défaut 50 000 po — donc le
      // contrôle de budget reste servi (jamais de 0 silencieux ici).
      { position: "poste-inconnu-du-catalogue" },
    ]);

    expect(total).toBe(60_000 + 50_000);
  });

  it("retombe entièrement sur le catalogue si la base est injoignable", async () => {
    const db = {
      position: { findMany: vi.fn().mockRejectedValue(new Error("no db")) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await expect(
      sumPlayerCostsForTeam(db, TEAM, [{ position: "human_lineman" }]),
    ).resolves.toBeGreaterThanOrEqual(0);
  });

  it("équipe vide -> 0", async () => {
    expect(await sumPlayerCostsForTeam(prismaWith([]), TEAM, [])).toBe(0);
  });
});
