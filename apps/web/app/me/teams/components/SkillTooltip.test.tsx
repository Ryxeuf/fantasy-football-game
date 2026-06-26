import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// État partagé mutable : simule le cache module rempli en asynchrone.
// `vi.hoisted` car les factories `vi.mock` sont hoistées avant les imports.
const h = vi.hoisted(() => ({ state: { ready: false } }));

// `getSkillDescription` (sync) renvoie le fallback tant que le cache n'est pas
// prêt, puis la valeur "API". `getSkillDescriptionAsync` "réchauffe" le cache.
vi.mock("../skills-data", () => ({
  getSkillDescription: (slug: string) => ({
    name: h.state.ready ? `API-${slug}` : `FB-${slug}`,
    description: "",
    category: "General",
  }),
  getSkillDescriptionAsync: async (slug: string) => {
    h.state.ready = true;
    return { name: `API-${slug}`, description: "", category: "General" };
  },
  parseSkills: (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean),
  slugsToDisplayNames: (slugs: string[]) => slugs,
}));

vi.mock("../base-skills-data", () => ({
  separateSkills: (_pos: string, slugs: string[]) => ({
    baseSkills: slugs,
    acquiredSkills: [],
  }),
}));

vi.mock("@bb/game-engine", () => ({
  parseSkillSlugs: (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean),
}));

vi.mock("../../../contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "fr", setLanguage: () => {}, t: {} }),
}));

import SkillTooltip from "./SkillTooltip";
import { SkillsCatalogProvider } from "../skills-catalog-context";

describe("SkillTooltip (me/teams) — rafraîchissement du cache compétences", () => {
  beforeEach(() => {
    h.state.ready = false;
  });

  it("met à jour les noms de badges après chargement du cache API, SANS survol", async () => {
    render(<SkillTooltip skillsString="block,dodge" />);

    // 1er rendu : cache vide → fallback game-engine.
    expect(screen.getByText("FB-block")).toBeTruthy();

    // Le hook réchauffe le cache puis force un re-render : les badges passent
    // aux valeurs API automatiquement, sans aucune interaction souris.
    await waitFor(() => expect(screen.getByText("API-block")).toBeTruthy());
    expect(screen.getByText("API-dodge")).toBeTruthy();
    // Le fallback a bien disparu.
    expect(screen.queryByText("FB-block")).toBeNull();
  });

  it("dbBaseSkills (source DB) classe base vs acquise — encadré orange réservé aux acquises", () => {
    // block est dans les compétences par défaut (DB), tackle ne l'est pas.
    const { container } = render(
      <SkillTooltip
        skillsString="block,tackle"
        position="dwarf_blitzer"
        dbBaseSkills={["block"]}
      />,
    );
    const badges = Array.from(container.querySelectorAll("span")).filter((el) =>
      /FB-(block|tackle)/.test(el.textContent ?? ""),
    );
    const blockBadge = badges.find((b) => b.textContent === "FB-block");
    const tackleBadge = badges.find((b) => b.textContent === "FB-tackle");
    // Compétence par défaut : bordure neutre (pas d'orange).
    expect(blockBadge?.className).toContain("border-gray-300");
    expect(blockBadge?.className).not.toContain("border-orange-400");
    // Compétence acquise : encadré orange.
    expect(tackleBadge?.className).toContain("border-orange-400");
  });

  it("affiche le nom du catalogue SSR dès le 1er rendu (option 1, zéro flash)", () => {
    const catalog = {
      block: {
        slug: "block",
        nameFr: "Blocage",
        nameEn: "Block",
        description: "",
        category: "General",
      },
    };
    render(
      <SkillsCatalogProvider value={catalog}>
        <SkillTooltip skillsString="block" />
      </SkillsCatalogProvider>,
    );
    // Synchrone : pas de waitFor, pas de survol → le catalogue prime sur le
    // fallback game-engine mocké ("FB-block").
    expect(screen.getByText("Blocage")).toBeTruthy();
    expect(screen.queryByText("FB-block")).toBeNull();
  });
});
