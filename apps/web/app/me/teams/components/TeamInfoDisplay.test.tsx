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

  it("n'affiche plus de ligne de coût pour les fans dévoués", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={{ ...INFO, dedicatedFans: 3 }} />
      </LanguageProvider>,
    );
    // Les fans dévoués ne comptent ni dans la VE ni dans la VEA : la
    // ligne de coût a disparu du détail des coûts.
    expect(screen.queryByTestId("dedicated-fans-cost")).toBeNull();
  });

  it("le total staff & relances ignore les fans dévoués", () => {
    const renderWithFans = (dedicatedFans: number) => {
      const { container, unmount } = render(
        <LanguageProvider>
          <TeamInfoDisplay info={{ ...INFO, dedicatedFans }} />
        </LanguageProvider>,
      );
      const text = normalizeSpaces(container.textContent);
      unmount();
      return text;
    };
    // Staff : relances 2×50k + pom-pom 10k + assistant 10k + apo 50k = 170k,
    // identique quel que soit le nombre de fans.
    expect(renderWithFans(1)).toContain("170K po");
    expect(renderWithFans(6)).toContain("170K po");
  });

  it("affiche tous les montants en kpo (aucun montant en po complets)", () => {
    const { container } = render(
      <LanguageProvider>
        <TeamInfoDisplay info={INFO} />
      </LanguageProvider>,
    );
    const text = normalizeSpaces(container.textContent);
    // VE 1 000 000 po -> « 1 000K po » ; trésorerie 30 000 po -> « 30K po ».
    expect(text).toContain("1 000K po");
    expect(text).toContain("30K po");
    // Plus aucun montant en po complets (« 1 000 000 po », « 30 000 po »…).
    expect(text).not.toMatch(/\d{2,3} \d{3} po/);
    expect(text).not.toContain("000 po");
  });

  it("respecte le coût de la config staff quand elle est fournie", () => {
    const { container } = render(
      <LanguageProvider>
        <TeamInfoDisplay
          info={{
            ...INFO,
            dedicatedFans: 2,
            staffConfig: {
              rerollCost: 60_000,
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
    // Relances 2 × 60 000 po (config DB) = 120 000 po ; total staff
    // 120k + 10k + 10k + 50k = 190k — sans aucune part fans dévoués.
    const text = normalizeSpaces(container.textContent);
    expect(text).toContain("120K po");
    expect(text).toContain("190K po");
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

describe("TeamInfoDisplay — coût des joueurs", () => {
  it("affiche le coût joueurs calculé par le serveur quand il est fourni", () => {
    render(
      <LanguageProvider>
        {/* VE stale (1 000k) vs coût joueurs réel (860k) : c'est le champ
            serveur qui doit gagner, pas la dérivation « VE − staff ». */}
        <TeamInfoDisplay info={{ ...INFO, playersCost: 860_000 }} />
      </LanguageProvider>,
    );
    expect(
      normalizeSpaces(screen.getByTestId("staff-players-cost").textContent),
    ).toBe("860K po");
  });

  it("retombe sur « VE − staff » quand le serveur ne fournit rien", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={INFO} />
      </LanguageProvider>,
    );
    // VE 1 000k − (2×50k relances + 10k + 10k + 50k apothicaire) = 830k
    expect(
      normalizeSpaces(screen.getByTestId("staff-players-cost").textContent),
    ).toBe("830K po");
  });
});
