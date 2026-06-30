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

    const select = (await screen.findByTestId(
      "level-up-skill-gnome1",
    )) as HTMLSelectElement;
    // Agilité éligible, Général exclu (accès primaire = A).
    await waitFor(() =>
      expect(
        Array.from(select.options).some((o) => o.textContent === "Esquive"),
      ).toBe(true),
    );
    expect(
      Array.from(select.options).some((o) => o.textContent === "Blocage"),
    ).toBe(false);
    expect(select.textContent).not.toContain("aucune compétence pour ce type");
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
