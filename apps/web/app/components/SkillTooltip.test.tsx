import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../me/teams/skills-data", () => ({
  getSkillDescription: () => null,
}));

vi.mock("../me/teams/use-skills-cache", () => ({
  useSkillsCacheReady: () => 0,
}));

vi.mock("../contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "fr", setLanguage: () => {}, t: {} }),
}));

import SkillTooltip from "./SkillTooltip";
import { SkillsCatalogProvider } from "../me/teams/skills-catalog-context";

const catalog = {
  block: {
    slug: "block",
    nameFr: "Blocage",
    nameEn: "Block",
    description: "Ignore Les Deux Plaqués.",
    category: "General",
    isPassive: false,
    isElite: true,
  },
  "thick-skull": {
    slug: "thick-skull",
    nameFr: "Crâne Épais",
    nameEn: "Thick Skull",
    description: "Sonné au lieu de K.-O.",
    category: "Strength",
    isPassive: true,
  },
};

describe("SkillTooltip (public) — E8 actif / passif", () => {
  it("affiche « Actif » dans l'infobulle d'une compétence active", async () => {
    render(
      <SkillsCatalogProvider value={catalog}>
        <SkillTooltip skillSlug="block" />
      </SkillsCatalogProvider>,
    );

    fireEvent.mouseEnter(screen.getByText("Blocage"));
    await waitFor(() =>
      expect(
        screen.getByTestId("skill-tooltip-activation-block").textContent,
      ).toBe("Actif"),
    );
  });

  it("affiche « Passif » dans l'infobulle d'une compétence passive", async () => {
    render(
      <SkillsCatalogProvider value={catalog}>
        <SkillTooltip skillSlug="thick-skull" />
      </SkillsCatalogProvider>,
    );

    fireEvent.mouseEnter(screen.getByText("Crâne Épais"));
    const badge = await screen.findByTestId(
      "skill-tooltip-activation-thick-skull",
    );
    expect(badge.textContent).toBe("Passif");
    // L'attribut `title` explique la différence (lecteurs d'écran + survol).
    expect(badge.getAttribute("title")).toContain("en permanence");
  });
});

describe("SkillTooltip (public) — compétence Élite", () => {
  it("marque le badge d'une compétence Élite d'une ⭐ (avec explication)", () => {
    render(
      <SkillsCatalogProvider value={catalog}>
        <SkillTooltip skillSlug="block" />
      </SkillsCatalogProvider>,
    );
    const star = screen.getByTestId("skill-badge-elite-block");
    expect(star.textContent).toContain("⭐");
    expect(star.getAttribute("title")).toContain("10 000");
  });

  it("affiche le badge « Élite » dans l'infobulle", async () => {
    render(
      <SkillsCatalogProvider value={catalog}>
        <SkillTooltip skillSlug="block" />
      </SkillsCatalogProvider>,
    );
    fireEvent.mouseEnter(screen.getByText("Blocage"));
    const badge = await screen.findByTestId("skill-tooltip-elite-block");
    expect(badge.textContent).toContain("Élite");
  });

  it("n'affiche aucune ⭐ pour une compétence non-Élite", () => {
    render(
      <SkillsCatalogProvider value={catalog}>
        <SkillTooltip skillSlug="thick-skull" />
      </SkillsCatalogProvider>,
    );
    expect(screen.queryByTestId("skill-badge-elite-thick-skull")).toBeNull();
  });
});
