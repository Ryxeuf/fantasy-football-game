import { describe, it, expect } from "vitest";
import { buildStaffLines, dedicatedFansCostPo } from "./staff-lines";

/**
 * Postes de staff de la page publique `/r/[token]`.
 *
 * Deux invariants : les chiffres SERVIS par l'API font foi (la page ne
 * doit jamais annoncer un coût que la fiche du coach contredirait), et un
 * poste non acheté n'affiche pas de coût.
 */

const BASE = {
  roster: "skaven",
  rerolls: 2,
  cheerleaders: 1,
  assistants: 0,
  apothecary: true,
  dedicatedFans: 3,
};

const CONFIG = {
  rerollCost: 60_000,
  cheerleaderCost: 10_000,
  assistantCost: 10_000,
  apothecaryCost: 50_000,
  dedicatedFanCost: 5_000,
};

function lineOf(lines: ReturnType<typeof buildStaffLines>, key: string) {
  const found = lines.find((l) => l.key === key);
  if (!found) throw new Error(`ligne ${key} absente`);
  return found;
}

describe("buildStaffLines", () => {
  it("chiffre chaque poste avec les coûts unitaires servis", () => {
    const lines = buildStaffLines({ ...BASE, staffConfig: CONFIG });

    expect(lineOf(lines, "rerolls")).toMatchObject({ value: "2", costPo: 120_000 });
    expect(lineOf(lines, "cheerleaders")).toMatchObject({ value: "1", costPo: 10_000 });
    expect(lineOf(lines, "apothecary")).toMatchObject({ value: "Oui", costPo: 50_000 });
  });

  it("le premier fan dévoué est offert", () => {
    const lines = buildStaffLines({ ...BASE, staffConfig: CONFIG });
    expect(lineOf(lines, "dedicatedFans")).toMatchObject({ value: "3", costPo: 10_000 });
    expect(dedicatedFansCostPo(1, 5_000)).toBe(0);
  });

  it("préfère les totaux déjà calculés par le serveur", () => {
    const lines = buildStaffLines({
      ...BASE,
      staffConfig: CONFIG,
      // Règlement de tournoi : le serveur a facturé autre chose que
      // `effectif × tarif`. C'est lui qui a raison.
      budgetSummary: { rerollsCost: 100_000, dedicatedFansCost: 4_000 },
    });
    expect(lineOf(lines, "rerolls").costPo).toBe(100_000);
    expect(lineOf(lines, "dedicatedFans").costPo).toBe(4_000);
  });

  it("n'affiche pas de coût pour un poste non acheté", () => {
    const lines = buildStaffLines({
      ...BASE,
      rerolls: 0,
      cheerleaders: 0,
      apothecary: false,
      dedicatedFans: 1,
      staffConfig: CONFIG,
    });
    expect(lineOf(lines, "rerolls").costPo).toBeNull();
    expect(lineOf(lines, "cheerleaders").costPo).toBeNull();
    expect(lineOf(lines, "apothecary")).toMatchObject({ value: "Non", costPo: null });
    expect(lineOf(lines, "dedicatedFans").costPo).toBeNull();
  });

  it("reste lisible face à un serveur qui ne sert pas la config staff", () => {
    // Repli : défauts édition 2025, les mêmes que la fiche du coach.
    const lines = buildStaffLines(BASE);
    expect(lineOf(lines, "cheerleaders").costPo).toBe(10_000);
    expect(lineOf(lines, "apothecary").costPo).toBe(50_000);
    expect(lineOf(lines, "dedicatedFans").costPo).toBe(10_000);
    // Le coût de relance dépend du roster (repli moteur) : jamais nul.
    expect(lineOf(lines, "rerolls").costPo).toBeGreaterThan(0);
  });

  it("rend les 5 postes dans l'ordre de la feuille d'équipe", () => {
    expect(buildStaffLines(BASE).map((l) => l.key)).toEqual([
      "rerolls",
      "cheerleaders",
      "assistants",
      "apothecary",
      "dedicatedFans",
    ]);
  });
});
