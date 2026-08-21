import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { StarPlayerDefinition } from "@bb/game-engine";
import StarPlayerCard, { type StarPlayerWithKeywords } from "./StarPlayerCard";
import { LanguageProvider } from "../contexts/LanguageContext";

const GRIFF: StarPlayerWithKeywords = {
  slug: "griff_oberwald",
  displayName: "Griff Oberwald",
  cost: 280000,
  ma: 7,
  st: 4,
  ag: 2,
  pa: 4,
  av: 9,
  skills: "block,dodge",
  hirableBy: ["old_world_classic"],
  keywords: "Humain, Blitzer",
  keywordsEn: "Human, Blitzer",
} as StarPlayerDefinition & { keywordsEn?: string | null };

afterEach(() => {
  localStorage.clear();
});

describe("StarPlayerCard — données fraîches de l'API", () => {
  it("préfère les noms de compétences renvoyés par l'API au catalogue statique", () => {
    render(
      <LanguageProvider>
        <StarPlayerCard
          starPlayer={{
            ...GRIFF,
            skillDetails: [
              { slug: "block", nameFr: "Blocage (édité)", nameEn: "Block" },
              // Slug inconnu du moteur : le nom DB s'affiche quand même
              // (le catalogue statique le droppait silencieusement).
              { slug: "toute-nouvelle-competence", nameFr: "Toute Nouvelle" },
            ],
          }}
        />
      </LanguageProvider>,
    );
    expect(screen.getByText("Blocage (édité)")).toBeTruthy();
    expect(screen.getByText("Toute Nouvelle")).toBeTruthy();
  });

  it("préfère le prix de paire calculé sur les coûts DB (pairCost API)", () => {
    render(
      <LanguageProvider>
        <StarPlayerCard
          starPlayer={{
            ...GRIFF,
            slug: "grak",
            pairWith: "crumbleberry",
            pairCost: 280_000,
            cost: 250_000,
          }}
        />
      </LanguageProvider>,
    );
    // 280 000 / 1000 = « 280 K po » — le coût de PAIRE, pas l'unitaire.
    expect(screen.getByText(/280 K po|280 K po|280 K po/)).toBeTruthy();
    // Le nom du partenaire vient du catalogue (repli slug si inconnu).
    expect(
      screen.getByTestId("star-player-card-pair").textContent?.toLowerCase(),
    ).toContain("crumbleberry");
  });
});

describe("StarPlayerCard — pouvoir exclu de la liste des compétences", () => {
  it("filtre le pouvoir des skillDetails API (payload pré-migration)", () => {
    render(
      <LanguageProvider>
        <StarPlayerCard
          starPlayer={{
            ...GRIFF,
            skillDetails: [
              { slug: "block", nameFr: "Blocage", nameEn: "Block" },
              {
                slug: "consummate-professional",
                nameFr: "Professionnel Accompli",
                nameEn: "Consummate Professional",
              },
            ],
          }}
        />
      </LanguageProvider>,
    );
    expect(screen.getByText("Blocage")).toBeTruthy();
    expect(screen.queryByText("Professionnel Accompli")).toBeNull();
  });

  it("filtre le pouvoir sur le repli catalogue statique (skills CSV)", () => {
    render(
      <LanguageProvider>
        <StarPlayerCard
          starPlayer={{
            ...GRIFF,
            skills: "block,dodge,consummate-professional",
          }}
        />
      </LanguageProvider>,
    );
    expect(screen.getByText("Blocage")).toBeTruthy();
    expect(screen.getByText("Esquive")).toBeTruthy();
    expect(screen.queryByText("Professionnel Accompli")).toBeNull();
  });
});

describe("StarPlayerCard — mots-clés", () => {
  it("affiche une pastille par mot-clé (FR par défaut)", () => {
    render(
      <LanguageProvider>
        <StarPlayerCard starPlayer={GRIFF} />
      </LanguageProvider>,
    );
    const chips = screen.getByTestId("star-player-keywords");
    expect(chips.textContent).toContain("Humain");
    expect(chips.textContent).toContain("Blitzer");
    expect(chips.children).toHaveLength(2);
  });

  it("bascule sur les mots-clés traduits en anglais", async () => {
    localStorage.setItem("language", "en");
    render(
      <LanguageProvider>
        <StarPlayerCard starPlayer={GRIFF} />
      </LanguageProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("star-player-keywords").textContent).toContain(
        "Human",
      );
    });
  });

  it("n'affiche rien quand le star player n'a pas de mots-clés", () => {
    render(
      <LanguageProvider>
        <StarPlayerCard
          starPlayer={{ ...GRIFF, keywords: undefined, keywordsEn: null }}
        />
      </LanguageProvider>,
    );
    expect(screen.queryByTestId("star-player-keywords")).toBeNull();
  });
});
