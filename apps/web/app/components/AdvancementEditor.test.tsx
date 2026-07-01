import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext";
import { AdvancementEditor } from "./AdvancementEditor";

const apiRequest = vi.fn();
vi.mock("../lib/api-client", () => ({
  apiRequest: (path: string, init?: RequestInit) => apiRequest(path, init),
  ApiClientError: class extends Error {},
}));

const PENDING = {
  teamId: "team-1",
  ruleset: "season_3",
  items: [
    {
      sequenceId: "seq-1",
      matchId: "m-1",
      seasonId: "s-1",
      teamPlayerId: "p1",
      playerName: "Griff Oberwald",
      spp: 16,
      advancementsTaken: 0,
      nextAdvancementCost: 6,
      createdAt: "2026-06-01T00:00:00Z",
      position: "Blitzer",
      // null => saisie libre (input texte) plutôt qu'un select filtré.
      primarySkills: null,
      secondarySkills: null,
    },
  ],
};

function setup() {
  return render(
    <LanguageProvider>
      <AdvancementEditor teamId="team-1" />
    </LanguageProvider>,
  );
}

describe("AdvancementEditor", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation((path: string) => {
      if (path.includes("/pending-advancements")) return Promise.resolve(PENDING);
      if (path.includes("/skills")) return Promise.resolve({ skills: [] });
      if (path.includes("/advancement"))
        return Promise.resolve({ applied: true, newSpp: 10, addedSkill: "block" });
      return Promise.resolve({});
    });
  });

  it("liste les joueurs en attente d'évolution", async () => {
    setup();
    expect(await screen.findByText("Griff Oberwald")).toBeTruthy();
    expect(screen.getByTestId("advancement-list")).toBeTruthy();
    expect(screen.getByTestId("level-up-row-p1")).toBeTruthy();
  });

  it("applique un avancement via l'API", async () => {
    setup();
    await screen.findByText("Griff Oberwald");
    // Le défaut est « random-primary » (flux de tirage) : on bascule sur
    // « primary » (choix libre) pour ce test d'application générique.
    fireEvent.click(screen.getByTestId("level-up-type-primary-p1"));
    // Saisie libre (pas de catalogue chargé ici) : on tape un slug puis applique.
    fireEvent.change(screen.getByTestId("level-up-skill-p1"), {
      target: { value: "block" },
    });
    fireEvent.click(screen.getByTestId("level-up-apply-p1"));
    await waitFor(() =>
      expect(
        apiRequest.mock.calls.some(
          ([path, init]) =>
            path === "/team/team-1/players/p1/advancement" &&
            init?.method === "POST",
        ),
      ).toBe(true),
    );
  });

  it("random-primary : tire 2 candidats via le serveur puis en applique un", async () => {
    const PENDING_A = {
      teamId: "team-1",
      ruleset: "season_3",
      items: [
        {
          ...PENDING.items[0],
          teamPlayerId: "gob1",
          playerName: "Gobelin",
          primarySkills: "A", // Agilité en principale
          secondarySkills: "G",
        },
      ],
    };
    apiRequest.mockReset();
    apiRequest.mockImplementation((path: string) => {
      if (path.includes("/pending-advancements")) return Promise.resolve(PENDING_A);
      if (path.includes("/skills"))
        return Promise.resolve({
          skills: [
            { slug: "dodge", nameFr: "Esquive", category: "Agility" },
            { slug: "leap", nameFr: "Saut", category: "Agility" },
          ],
        });
      if (path.includes("/roll-random-primary"))
        return Promise.resolve({ candidates: ["dodge", "leap"] });
      if (path.includes("/advancement"))
        return Promise.resolve({ applied: true, newSpp: 13, addedSkill: "dodge" });
      return Promise.resolve({});
    });
    setup();
    await screen.findByText("Gobelin");

    // Catégorie principale = Agilité (chip), puis tirage.
    fireEvent.click(screen.getByTestId("level-up-category-A-gob1"));
    fireEvent.click(screen.getByTestId("level-up-roll-gob1"));

    // Les 2 candidats tirés s'affichent (cartes cliquables, nom FR).
    await screen.findByTestId("level-up-candidates-gob1");
    expect(screen.getByText("Esquive")).toBeTruthy();
    expect(screen.getByText("Saut")).toBeTruthy();

    // On choisit « Esquive » (carte candidate) et on applique.
    fireEvent.click(screen.getByTestId("level-up-candidate-dodge-gob1"));
    fireEvent.click(screen.getByTestId("level-up-apply-gob1"));

    await waitFor(() =>
      expect(
        apiRequest.mock.calls.some(
          ([path, init]) =>
            path === "/team/team-1/players/gob1/advancement" &&
            init?.method === "POST" &&
            JSON.parse(String(init?.body)).type === "random-primary" &&
            JSON.parse(String(init?.body)).category === "A" &&
            JSON.parse(String(init?.body)).skillSlug === "dodge",
        ),
      ).toBe(true),
    );
  });

  it("charge le catalogue depuis /api/skills et peuple le picker selon l'accès", async () => {
    const PENDING_WITH_ACCESS = {
      teamId: "team-1",
      ruleset: "season_3",
      items: [
        {
          ...PENDING.items[0],
          teamPlayerId: "gnome1",
          playerName: "Belluaire Gnome 1",
          // Accès primaire = Agilité (A) → seules les compétences Agilité
          // sont éligibles en « random-primary »/« primary ».
          primarySkills: "A",
          secondarySkills: "G,S,K",
        },
      ],
    };
    apiRequest.mockReset();
    apiRequest.mockImplementation((path: string) => {
      if (path.includes("/pending-advancements"))
        return Promise.resolve(PENDING_WITH_ACCESS);
      if (path.includes("/skills"))
        return Promise.resolve({
          skills: [
            { slug: "dodge", nameFr: "Esquive", category: "Agility" },
            { slug: "block", nameFr: "Blocage", category: "General" },
          ],
        });
      return Promise.resolve({});
    });
    setup();

    // Le catalogue est bien demandé sur /api/skills (et pas /skills).
    await waitFor(() =>
      expect(
        apiRequest.mock.calls.some(([path]) =>
          String(path).startsWith("/api/skills"),
        ),
      ).toBe(true),
    );

    // Bascule sur « primary » (picker de compétences filtré par accès) — le
    // défaut random-primary passe désormais par le tirage serveur.
    fireEvent.click(await screen.findByTestId("level-up-type-primary-gnome1"));

    // Agilité éligible (chip « Esquive » présent), Général exclu (accès A).
    await screen.findByTestId("level-up-skill-dodge-gnome1");
    expect(screen.getByText("Esquive")).toBeTruthy();
    expect(screen.queryByText("Blocage")).toBeNull();
  });

  it("groupe les compétences par catégorie et prévisualise la description au survol", async () => {
    const PENDING_ACCESS = {
      teamId: "team-1",
      ruleset: "season_3",
      items: [
        {
          ...PENDING.items[0],
          teamPlayerId: "cat1",
          playerName: "Coach Cat",
          primarySkills: "A,G", // Agilité + Générales en principale
          secondarySkills: "S",
        },
      ],
    };
    apiRequest.mockReset();
    apiRequest.mockImplementation((path: string) => {
      if (path.includes("/pending-advancements"))
        return Promise.resolve(PENDING_ACCESS);
      if (path.includes("/skills"))
        return Promise.resolve({
          skills: [
            {
              slug: "dodge",
              nameFr: "Esquive",
              category: "Agility",
              description: "Esquive un joueur adverse sans risque.",
            },
            {
              slug: "block",
              nameFr: "Blocage",
              category: "General",
              description: "Ignore un résultat Les Deux Plaqués.",
            },
          ],
        });
      return Promise.resolve({});
    });
    setup();
    await screen.findByText("Coach Cat");
    fireEvent.click(await screen.findByTestId("level-up-type-primary-cat1"));

    // Les compétences sont groupées sous leurs entêtes de catégorie.
    await screen.findByTestId("level-up-skill-dodge-cat1");
    expect(screen.getByText("Agilité")).toBeTruthy();
    expect(screen.getByText("Générales")).toBeTruthy();

    // Survol d'une compétence -> sa description s'affiche avant tout choix.
    fireEvent.mouseEnter(screen.getByTestId("level-up-skill-dodge-cat1"));
    const desc = await screen.findByTestId("level-up-skill-desc-cat1");
    expect(desc.textContent).toContain("Esquive un joueur adverse");
  });

  it("affiche un état vide quand aucun joueur n'est en attente", async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path.includes("/pending-advancements"))
        return Promise.resolve({ teamId: "team-1", ruleset: "season_3", items: [] });
      return Promise.resolve({ skills: [] });
    });
    setup();
    expect(await screen.findByTestId("advancement-empty")).toBeTruthy();
  });
});
