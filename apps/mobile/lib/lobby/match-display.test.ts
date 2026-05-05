/**
 * S27.3.4 — Tests des helpers d'affichage de match (lobby).
 *
 * Helpers testes :
 *  - getStatusLabel : utilise i18n pour retourner le label localise.
 *  - getStatusColor : couleur hex selon le statut (pure, no i18n).
 *  - formatMatchDate : date courte localisee FR/EN.
 *  - formatRoundLabel : "MT 1, Tour 2" / "H 1, Turn 2" via i18n.
 */

import { describe, expect, it } from "vitest";
import { t } from "../i18n";
import {
  getStatusLabel,
  getStatusColor,
  formatMatchDate,
  formatRoundLabel,
} from "./match-display";

describe("getStatusLabel", () => {
  it("retourne le label FR pour les statuts connus", () => {
    expect(getStatusLabel("active", t)).toBe("En cours");
    expect(getStatusLabel("pending", t)).toBe("En attente");
    expect(getStatusLabel("prematch", t)).toBe("Pre-match");
    expect(getStatusLabel("prematch-setup", t)).toBe("Configuration");
    expect(getStatusLabel("ended", t)).toBe("Termine");
  });

  it("retourne le label EN si t est lie a en", () => {
    const tEn = (k: Parameters<typeof t>[0]) => t(k, undefined, "en");
    expect(getStatusLabel("active", tEn)).toBe("In progress");
    expect(getStatusLabel("pending", tEn)).toBe("Pending");
    expect(getStatusLabel("ended", tEn)).toBe("Ended");
  });

  it("retourne le statut brut pour un statut inconnu", () => {
    expect(getStatusLabel("zombie", t)).toBe("zombie");
  });
});

describe("getStatusColor", () => {
  it("retourne la couleur correcte pour chaque statut", () => {
    expect(getStatusColor("active")).toBe("#22C55E");
    expect(getStatusColor("pending")).toBe("#EAB308");
    expect(getStatusColor("prematch")).toBe("#3B82F6");
    expect(getStatusColor("prematch-setup")).toBe("#3B82F6");
    expect(getStatusColor("ended")).toBe("#6B7280");
  });

  it("retourne une couleur fallback pour un statut inconnu", () => {
    expect(getStatusColor("zombie")).toBe("#9CA3AF");
  });
});

describe("formatMatchDate", () => {
  it("formate une date ISO en chaine courte FR (jour court + heure)", () => {
    const result = formatMatchDate("2026-05-05T10:30:00Z", "fr");
    expect(result).toMatch(/\d/);
    expect(result.length).toBeGreaterThan(0);
  });

  it("formate une date ISO en chaine courte EN", () => {
    const result = formatMatchDate("2026-05-05T10:30:00Z", "en");
    expect(result).toMatch(/\d/);
    expect(result.length).toBeGreaterThan(0);
  });

  it("retourne chaine vide pour une date invalide", () => {
    expect(formatMatchDate("not-a-date", "fr")).toBe("");
    expect(formatMatchDate("", "fr")).toBe("");
  });
});

describe("formatRoundLabel", () => {
  it("retourne 'MT 1, Tour 2' en FR", () => {
    expect(formatRoundLabel(1, 2, t)).toBe("MT 1, Tour 2");
  });

  it("retourne 'H 1, Turn 2' en EN", () => {
    const tEn = (
      k: Parameters<typeof t>[0],
      params?: Parameters<typeof t>[1],
    ) => t(k, params, "en");
    expect(formatRoundLabel(1, 2, tEn)).toBe("H 1, Turn 2");
  });
});
