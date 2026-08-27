import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { language } = vi.hoisted(() => ({ language: { value: "fr" } }));
vi.mock("../contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: language.value }),
}));

import CatalogToolsBar from "./CatalogToolsBar";

describe("CatalogToolsBar", () => {
  it("expose les cinq entrees du catalogue", () => {
    render(<CatalogToolsBar />);
    expect(screen.getByTestId("catalog-tool-teams")).toBeDefined();
    expect(screen.getByTestId("catalog-tool-compare-teams")).toBeDefined();
    expect(screen.getByTestId("catalog-tool-positions")).toBeDefined();
    expect(screen.getByTestId("catalog-tool-compare-positions")).toBeDefined();
    expect(screen.getByTestId("catalog-tool-tier-list")).toBeDefined();
  });

  it("retire l'outil courant (on y est deja)", () => {
    render(<CatalogToolsBar current="positions" />);
    expect(screen.queryByTestId("catalog-tool-positions")).toBeNull();
    expect(screen.getByTestId("catalog-tool-tier-list")).toBeDefined();
  });

  it("pointe vers les URLs des outils", () => {
    render(<CatalogToolsBar />);
    expect(
      screen.getByTestId("catalog-tool-compare-positions").getAttribute("href"),
    ).toBe("/teams/positions/comparer");
    expect(
      screen.getByTestId("catalog-tool-compare-teams").getAttribute("href"),
    ).toBe("/teams/comparer");
  });

  it("bascule les libelles en anglais", () => {
    language.value = "en";
    try {
      render(<CatalogToolsBar />);
      expect(
        screen.getByTestId("catalog-tool-positions").textContent,
      ).toContain("Position studies");
    } finally {
      language.value = "fr";
    }
  });
});
