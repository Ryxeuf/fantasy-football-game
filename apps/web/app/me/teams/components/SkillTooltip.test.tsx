import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// État partagé mutable : simule le cache module rempli en asynchrone.
// `vi.hoisted` car les factories `vi.mock` sont hoistées avant les imports.
const h = vi.hoisted(() => ({ state: { ready: false } }));

// `getSkillDescription` (sync) renvoie le fallback tant que le cache n'est pas
// prêt, puis la valeur "API". `getSkillDescriptionAsync` "réchauffe" le cache.
vi.mock("../skills-data", () => ({
  // Le composant lit désormais le catalogue de compétences PAR ÉDITION
  // (`?ruleset=`) : le mock doit exposer le défaut (cf. CLAUDE.md — un mock
  // doit déclarer toutes les exports utilisées).
  DEFAULT_SKILLS_RULESET: "season_3",
  // Les variantes de Haine sont creees A LA VOLEE a la validation d'une
  // feuille : un catalogue deja charge ne les connait pas et ne resout rien.
  getSkillDescription: (slug: string) =>
    slug.startsWith("hate")
      ? null
      : {
          name: h.state.ready ? `API-${slug}` : `FB-${slug}`,
          description: "",
          category: "General",
        },
  getSkillDescriptionAsync: async (slug: string) => {
    h.state.ready = true;
    if (slug.startsWith("hate")) return null;
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

// `importOriginal` : on garde la vraie `hateSkillLabelFr` (module pur), qui
// est justement ce que le repli francophone des badges doit exercer.
vi.mock("@bb/game-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bb/game-engine")>();
  return {
    ...actual,
    parseSkillSlugs: (s: string) =>
      s.split(",").map((x) => x.trim()).filter(Boolean),
  };
});

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

  it("E8 — l'infobulle indique si la compétence est passive ou active", async () => {
    const catalog = {
      block: {
        slug: "block",
        nameFr: "Blocage",
        nameEn: "Block",
        description: "Ignore Les Deux Plaqués.",
        category: "General",
        isPassive: false,
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
    render(
      <SkillsCatalogProvider value={catalog}>
        <SkillTooltip skillsString="block,thick-skull" />
      </SkillsCatalogProvider>,
    );

    // Les badges (1er rendu) : le nom réapparaît ensuite dans l'infobulle, on
    // garde donc une référence au badge avant tout survol.
    const blockBadge = screen.getByText("Blocage");
    const thickSkullBadge = screen.getByText("Crâne Épais");

    fireEvent.mouseEnter(blockBadge);
    await waitFor(() =>
      expect(
        screen.getByTestId("skill-tooltip-activation-block").textContent,
      ).toBe("Actif"),
    );

    fireEvent.mouseLeave(blockBadge);
    fireEvent.mouseEnter(thickSkullBadge);
    await waitFor(() =>
      expect(
        screen.getByTestId("skill-tooltip-activation-thick-skull").textContent,
      ).toBe("Passif"),
    );
  });
});

describe("SkillTooltip — trait Haine hors catalogue (A160)", () => {
  beforeEach(() => {
    h.state.ready = false;
  });

  it("affiche « Haine (Orque) » plutôt que le slug brut", () => {
    // Le badge retombait sur `hate-orque`, que le coach lit comme de
    // l'anglais alors que le trait a un nom français.
    render(<SkillTooltip skillsString="hate-orque" />);
    expect(screen.getByText("Haine (Orque)")).toBeTruthy();
    expect(screen.queryByText("hate-orque")).toBeNull();
  });

  it("restitue l'accent perdu par la slugification", () => {
    render(<SkillTooltip skillsString="hate-homme-lezard" />);
    expect(screen.getByText("Haine (Homme Lézard)")).toBeTruthy();
  });

  it("francise aussi les variantes au slug anglais du catalogue", () => {
    render(<SkillTooltip skillsString="hate-dwarf" />);
    expect(screen.getByText("Haine (Nain)")).toBeTruthy();
  });

  it("laisse les autres compétences inconnues sur leur slug", () => {
    render(<SkillTooltip skillsString="hatchet-job" />);
    expect(screen.getByText("FB-hatchet-job")).toBeTruthy();
  });
});
