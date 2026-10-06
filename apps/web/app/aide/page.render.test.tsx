import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("../lib/serverApi", () => ({
  getServerApiBase: () => "http://api.test",
  safeServerJson: vi.fn(),
}));

import { safeServerJson } from "../lib/serverApi";
import HelpPage from "./page";
import { HELP_CATEGORIES } from "./help-catalogue";

const mockedFetch = vi.mocked(safeServerJson);

async function renderHelp(flags: readonly string[] | null) {
  mockedFetch.mockResolvedValueOnce(flags === null ? null : { success: true, data: flags });
  render(await HelpPage());
}

describe("HelpPage (rendu)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lit les flags en ANONYME : aucun en-tête d'authentification", async () => {
    await renderHelp([]);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe("http://api.test/api/feature-flags/me");
    expect((init as RequestInit | undefined)?.headers).toBeUndefined();
  });

  it("liste les fonctionnalités sans flag, chacune avec son lien", async () => {
    await renderHelp([]);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    const compendium = screen.getByTestId("help-feature-compendium");
    expect(
      within(compendium).getAllByRole("link").map((a) => a.getAttribute("href")),
    ).toContain("/compendium");
    expect(screen.getByTestId("help-feature-saisir-une-rencontre")).toBeTruthy();
    // Sommaire : une ancre par catégorie affichée.
    const toc = screen.getByRole("navigation", { name: "Catégories" });
    expect(within(toc).getByRole("link", { name: /Règles et référence/ }).getAttribute("href")).toBe(
      "#regles",
    );
  });

  it("masque ce qui dépend d'un flag fermé, catégorie vide comprise", async () => {
    await renderHelp([]);
    expect(screen.queryByTestId("help-feature-jouer-en-ligne")).toBeNull();
    expect(screen.queryByTestId("help-feature-boutique")).toBeNull();
    expect(screen.queryByTestId("help-feature-exports-pdf")).toBeNull();
    // Nuffle Coach n'a que des fonctionnalités gatées : la section disparaît.
    expect(document.getElementById("nuffle-coach")).toBeNull();
  });

  it("affiche une fonctionnalité dès que son flag est ouvert à tous", async () => {
    await renderHelp(["online_play", "nuffle_coach", "dice_themes"]);
    expect(screen.getByTestId("help-feature-jouer-en-ligne")).toBeTruthy();
    expect(screen.getByTestId("help-feature-boutique")).toBeTruthy();
    expect(document.getElementById("nuffle-coach")).not.toBeNull();
    // L'IA exige aussi `ai_training`.
    expect(screen.queryByTestId("help-feature-entrainement-ia")).toBeNull();
  });

  it("retombe sur les seules fonctionnalités sans flag si l'API ne répond pas", async () => {
    await renderHelp(null);
    expect(screen.getByTestId("help-feature-compendium")).toBeTruthy();
    expect(screen.queryByTestId("help-feature-classement-elo")).toBeNull();
  });

  it("affiche toutes les catégories quand tous les flags sont ouverts", async () => {
    const allFlags = HELP_CATEGORIES.flatMap((c) => c.features.flatMap((f) => f.flags ?? []));
    await renderHelp(allFlags);
    for (const category of HELP_CATEGORIES) {
      expect(document.getElementById(category.id), category.id).not.toBeNull();
    }
  });
});
