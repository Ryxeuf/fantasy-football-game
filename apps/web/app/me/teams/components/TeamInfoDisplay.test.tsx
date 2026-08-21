/**
 * La section historiquement titrée « Informations de l'équipe » liste le
 * staff (relances, pom-pom girls, assistants, apothicaire, fans dévoués) :
 * son titre est désormais « Staff de l'équipe ».
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import TeamInfoDisplay from "./TeamInfoDisplay";
import { LanguageProvider } from "../../../contexts/LanguageContext";

/** `toLocaleString("fr-FR")` sépare les milliers avec U+202F : on normalise. */
function normalizeSpaces(text: string | null): string {
  return (text ?? "").replace(/[\u202f\u00a0]/g, " ");
}

const INFO = {
  treasury: 30_000,
  rerolls: 2,
  cheerleaders: 1,
  assistants: 1,
  apothecary: true,
  dedicatedFans: 1,
  teamValue: 1_000_000,
  currentValue: 990_000,
  roster: "skaven",
};

afterEach(() => {
  localStorage.clear();
});

describe("TeamInfoDisplay — titre de section", () => {
  it("affiche « Staff de l'équipe » (et plus « Informations de l'équipe »)", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={INFO} />
      </LanguageProvider>,
    );
    expect(screen.getByText("Staff de l'équipe")).toBeTruthy();
    expect(screen.queryByText("Informations de l'équipe")).toBeNull();
  });

  it("facture les fans dévoués 5 000 po pièce (défaut édition 2025)", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={{ ...INFO, dedicatedFans: 3 }} />
      </LanguageProvider>,
    );
    // 2 fans payants (le 1er est gratuit) × 5 000 po = 10 000 po.
    expect(
      normalizeSpaces(screen.getByTestId("dedicated-fans-cost").textContent),
    ).toContain("10 000");
  });

  it("respecte le coût de la config staff quand elle est fournie", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay
          info={{
            ...INFO,
            dedicatedFans: 2,
            staffConfig: {
              rerollCost: 50_000,
              maxRerolls: 8,
              apothecaryAllowed: true,
              apothecaryCost: 50_000,
              maxCheerleaders: 12,
              cheerleaderCost: 10_000,
              maxAssistants: 6,
              assistantCost: 10_000,
              maxDedicatedFans: 6,
              dedicatedFanCost: 5_000,
            },
          }}
        />
      </LanguageProvider>,
    );
    expect(
      normalizeSpaces(screen.getByTestId("dedicated-fans-cost").textContent),
    ).toContain("5 000");
  });

  it("affiche « Team staff » en anglais", async () => {
    localStorage.setItem("language", "en");
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={INFO} />
      </LanguageProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("Team staff")).toBeTruthy();
    });
  });
});
