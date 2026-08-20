/**
 * Admin — édition d'un Star Player : les compétences et les règles de
 * recrutement se saisissent en chips + recherche (même sélecteur que les
 * positions) et non plus en texte libre séparé par des virgules.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import EditStarPlayerPage from "./page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ id: "sp1" }),
}));

const STAR_PLAYER = {
  id: "sp1",
  slug: "griff_oberwald",
  ruleset: "season_3",
  displayName: "Griff Oberwald",
  cost: 280000,
  ma: 7,
  st: 4,
  ag: 2,
  pa: 4,
  av: 9,
  specialRule: null,
  imageUrl: null,
  skills: [
    { skill: { slug: "block", nameFr: "Blocage" } },
    // Slug hérité, absent du catalogue du ruleset : ne doit pas disparaître.
    { skill: { slug: "loner-4", nameFr: "Solitaire (4+)" } },
  ],
  hirableBy: [
    { rule: "old_world_classic", roster: null },
    {
      rule: "skaven",
      roster: { id: "roster-skaven", slug: "skaven", name: "Skavens" },
    },
  ],
};

const SKILLS = [
  { slug: "block", nameFr: "Blocage", nameEn: "Block", category: "General" },
  { slug: "dodge", nameFr: "Esquive", nameEn: "Dodge", category: "Agility" },
];

const ROSTERS = [
  { id: "roster-skaven", slug: "skaven", name: "Skavens" },
  { id: "roster-orc", slug: "orc", name: "Orques" },
];

const originalFetch = global.fetch;

function mockFetch() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.includes("/auth/me")) {
      return { ok: true, json: async () => ({ user: { roles: ["admin"] } }) };
    }
    if (path.includes("/admin/data/skills")) {
      return { ok: true, json: async () => ({ skills: SKILLS }) };
    }
    if (path.includes("/admin/data/rosters")) {
      return { ok: true, json: async () => ({ rosters: ROSTERS }) };
    }
    if (init?.method === "PUT") {
      return { ok: true, json: async () => ({ starPlayer: STAR_PLAYER }) };
    }
    return { ok: true, json: async () => ({ starPlayer: STAR_PLAYER }) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "token", setItem: vi.fn(), removeItem: vi.fn() },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("EditStarPlayerPage — saisie en chips", () => {
  it("affiche les compétences du joueur en chips, hors catalogue compris", async () => {
    mockFetch();
    render(<EditStarPlayerPage />);

    await waitFor(() =>
      expect(screen.getByTestId("star-player-skills-chip-block")).toBeTruthy(),
    );
    // Le slug hérité reste visible (et donc jamais perdu à l'enregistrement).
    expect(screen.getByTestId("star-player-skills-chip-loner-4")).toBeTruthy();
    expect(screen.queryByTestId("star-player-skills-chip-dodge")).toBeNull();
  });

  it("affiche la règle globale ET le roster ciblé du joueur en chips", async () => {
    mockFetch();
    render(<EditStarPlayerPage />);

    await waitFor(() =>
      expect(
        screen.getByTestId("star-player-hirable-rules-chip-old_world_classic"),
      ).toBeTruthy(),
    );
    expect(screen.queryByTestId("star-player-hirable-rules-chip-all")).toBeNull();
    expect(
      screen.getByTestId("star-player-hirable-rosters-chip-roster-skaven"),
    ).toBeTruthy();
    expect(
      screen.queryByTestId("star-player-hirable-rosters-chip-roster-orc"),
    ).toBeNull();
  });

  it("envoie la sélection, avec le couple (règle, rosterId)", async () => {
    const fetchMock = mockFetch();
    render(<EditStarPlayerPage />);

    await waitFor(() =>
      expect(screen.getByTestId("star-player-skills-chip-block")).toBeTruthy(),
    );

    fireEvent.focus(screen.getByTestId("star-player-skills-search"));
    fireEvent.click(screen.getByTestId("star-player-skills-option-dodge"));
    fireEvent.focus(screen.getByTestId("star-player-hirable-rules-search"));
    fireEvent.click(screen.getByTestId("star-player-hirable-rules-option-all"));
    fireEvent.focus(screen.getByTestId("star-player-hirable-rosters-search"));
    fireEvent.click(
      screen.getByTestId("star-player-hirable-rosters-option-roster-orc"),
    );
    fireEvent.click(screen.getByText("Mettre à jour"));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, init]) => init?.method === "PUT"),
      ).toBe(true),
    );

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    const body = JSON.parse(String(put?.[1]?.body));
    expect(body.skillSlugs).toEqual(["block", "loner-4", "dodge"]);
    expect(body.hirableBy).toEqual([
      "old_world_classic",
      "all",
      { rule: "skaven", rosterId: "roster-skaven" },
      { rule: "orc", rosterId: "roster-orc" },
    ]);
  });

  it("n'envoie plus de champ texte CSV pour les compétences", async () => {
    mockFetch();
    render(<EditStarPlayerPage />);

    await waitFor(() =>
      expect(screen.getByTestId("star-player-skills-chip-block")).toBeTruthy(),
    );
    expect(
      document.querySelector('input[name="skillSlugs"]'),
    ).toBeNull();
    expect(document.querySelector('input[name="hirableBy"]')).toBeNull();
  });

  it("charge les catalogues filtrés sur le ruleset du joueur", async () => {
    const fetchMock = mockFetch();
    render(<EditStarPlayerPage />);

    await waitFor(() =>
      expect(screen.getByTestId("star-player-skills-chip-block")).toBeTruthy(),
    );
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(
      urls.some((u) => u.includes("/admin/data/skills?ruleset=season_3")),
    ).toBe(true);
    expect(
      urls.some((u) => u.includes("/admin/data/rosters?ruleset=season_3")),
    ).toBe(true);
  });
});
