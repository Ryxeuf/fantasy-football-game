/**
 * S27.1a — Tests des helpers Nuffle Cup mensuelles.
 *
 * Convention : une "Nuffle Cup mensuelle" est une Cup avec un couple
 * `(monthlyYear, monthlyMonth)` defini, qui marque l'edition canonique
 * du mois (ex. "Nuffle Cup Avril 2026"). Les helpers ici fournissent :
 *  - validation du couple (1-12 et annee positive)
 *  - libelle du mois en FR
 *  - format public "Nuffle Cup {Mois} {YYYY}"
 *
 * Foundation pour le bracket visuel `/cups/{slug}`, le match-of-week
 * et le badge profil "Champion Nuffle Cup {Mois} {YYYY}".
 */

import { describe, it, expect } from "vitest";
import {
  isValidMonthlyCupSlot,
  formatMonthlyNuffleCupName,
  getMonthLabelFr,
  formatMonthlyNuffleCupChampionLabel,
  MONTH_LABELS_FR,
} from "./nuffle-cup-monthly";

describe("MONTH_LABELS_FR", () => {
  it("expose 12 libelles ordonnes janvier -> decembre", () => {
    expect(MONTH_LABELS_FR).toHaveLength(12);
    expect(MONTH_LABELS_FR[0]).toBe("Janvier");
    expect(MONTH_LABELS_FR[11]).toBe("Decembre");
  });
});

describe("getMonthLabelFr", () => {
  it("retourne le libelle pour 1-12", () => {
    expect(getMonthLabelFr(1)).toBe("Janvier");
    expect(getMonthLabelFr(4)).toBe("Avril");
    expect(getMonthLabelFr(12)).toBe("Decembre");
  });

  it("retourne null pour un mois invalide", () => {
    expect(getMonthLabelFr(0)).toBeNull();
    expect(getMonthLabelFr(13)).toBeNull();
    expect(getMonthLabelFr(-1)).toBeNull();
    expect(getMonthLabelFr(1.5)).toBeNull();
    expect(getMonthLabelFr(NaN)).toBeNull();
  });
});

describe("isValidMonthlyCupSlot", () => {
  it("accepte un couple year + month entier dans [1,12] et year positif", () => {
    expect(isValidMonthlyCupSlot(2026, 4)).toBe(true);
    expect(isValidMonthlyCupSlot(2026, 1)).toBe(true);
    expect(isValidMonthlyCupSlot(2026, 12)).toBe(true);
  });

  it("rejette un mois hors [1,12]", () => {
    expect(isValidMonthlyCupSlot(2026, 0)).toBe(false);
    expect(isValidMonthlyCupSlot(2026, 13)).toBe(false);
    expect(isValidMonthlyCupSlot(2026, -3)).toBe(false);
  });

  it("rejette un mois non entier", () => {
    expect(isValidMonthlyCupSlot(2026, 4.5)).toBe(false);
  });

  it("rejette une annee <= 0", () => {
    expect(isValidMonthlyCupSlot(0, 4)).toBe(false);
    expect(isValidMonthlyCupSlot(-1, 4)).toBe(false);
  });

  it("rejette une annee non entiere", () => {
    expect(isValidMonthlyCupSlot(2026.5, 4)).toBe(false);
  });
});

describe("formatMonthlyNuffleCupName", () => {
  it("formatte 'Nuffle Cup {Mois} {YYYY}' quand le slot est valide", () => {
    expect(formatMonthlyNuffleCupName(2026, 4)).toBe("Nuffle Cup Avril 2026");
    expect(formatMonthlyNuffleCupName(2026, 1)).toBe(
      "Nuffle Cup Janvier 2026",
    );
  });

  it("retourne null si le slot est invalide", () => {
    expect(formatMonthlyNuffleCupName(2026, 13)).toBeNull();
    expect(formatMonthlyNuffleCupName(0, 4)).toBeNull();
  });
});

describe("formatMonthlyNuffleCupChampionLabel", () => {
  it("formatte 'Champion Nuffle Cup {Mois} {YYYY}'", () => {
    expect(formatMonthlyNuffleCupChampionLabel(2026, 5)).toBe(
      "Champion Nuffle Cup Mai 2026",
    );
  });

  it("retourne null si le slot est invalide", () => {
    expect(formatMonthlyNuffleCupChampionLabel(2026, 13)).toBeNull();
    expect(formatMonthlyNuffleCupChampionLabel(-1, 4)).toBeNull();
    expect(formatMonthlyNuffleCupChampionLabel(2026, 4.5)).toBeNull();
  });
});
