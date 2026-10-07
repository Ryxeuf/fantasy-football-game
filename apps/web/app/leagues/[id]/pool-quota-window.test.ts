/**
 * Fenêtre d'édition du quota de qualifiés d'une poule de ligue : ouverte
 * jusqu'au bracket, fermée par la clôture.
 */
import { describe, it, expect } from "vitest";
import { isPoolQuotaEditable, poolQuotaSignature } from "./pool-quota-window";

const regular = { kind: "regular", bracketSlot: null };

describe("isPoolQuotaEditable", () => {
  it("reste ouverte sur une saison en cours sans bracket", () => {
    expect(
      isPoolQuotaEditable({
        status: "in_progress",
        rounds: [regular, regular],
      }),
    ).toBe(true);
  });

  it("est ouverte avant le démarrage", () => {
    expect(isPoolQuotaEditable({ status: "draft", rounds: [] })).toBe(true);
  });

  it("se ferme dès qu'un tour de play-off existe", () => {
    expect(
      isPoolQuotaEditable({
        status: "in_progress",
        rounds: [regular, { kind: "playoff", bracketSlot: "qf1" }],
      }),
    ).toBe(false);
  });

  it("reconnaît un tour de bracket créé à la main par son slot", () => {
    expect(
      isPoolQuotaEditable({
        status: "in_progress",
        rounds: [regular, { kind: "regular", bracketSlot: "final" }],
      }),
    ).toBe(false);
  });

  it("se ferme à la clôture de la saison", () => {
    expect(isPoolQuotaEditable({ status: "completed", rounds: [] })).toBe(
      false,
    );
  });

  it("tolère des rounds sans kind (API antérieure)", () => {
    expect(isPoolQuotaEditable({ status: "in_progress", rounds: [{}] })).toBe(
      true,
    );
  });

  it("est fermée sans saison chargée", () => {
    expect(isPoolQuotaEditable(null)).toBe(false);
  });
});

describe("poolQuotaSignature", () => {
  const pools = [
    { id: "pa", qualifiesForPlayoffs: 4 },
    { id: "pb", qualifiesForPlayoffs: 4 },
  ];

  it("change dès qu'un quota change", () => {
    expect(poolQuotaSignature(pools)).not.toBe(
      poolQuotaSignature([pools[0], { id: "pb", qualifiesForPlayoffs: 3 }]),
    );
  });

  it("change quand une poule apparaît", () => {
    expect(poolQuotaSignature(pools)).not.toBe(
      poolQuotaSignature([...pools, { id: "pc", qualifiesForPlayoffs: 0 }]),
    );
  });

  it("est stable à quotas identiques", () => {
    expect(poolQuotaSignature(pools)).toBe(poolQuotaSignature([...pools]));
  });
});
