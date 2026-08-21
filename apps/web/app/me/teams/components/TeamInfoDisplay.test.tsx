/**
 * La section historiquement titrée « Informations de l'équipe » liste le
 * staff (relances, pom-pom girls, assistants, apothicaire, fans dévoués) :
 * son titre est désormais « Staff de l'équipe ».
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import TeamInfoDisplay from "./TeamInfoDisplay";
import { LanguageProvider } from "../../../contexts/LanguageContext";

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
