/**
 * Logos d'équipe sur la liste `/me/teams`.
 *
 * La liste n'affichait que le nom + le badge de roster : un coach qui avait
 * uploadé un logo ne le retrouvait nulle part avant d'ouvrir la fiche. On
 * vérifie ici les deux branches de `TeamLogo` : logo uploadé (balise <img>)
 * et repli programmatique (SVG inline dérivé du slug).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MyTeamsPage from "./page";

// Identités STABLES : `useEffect` de la page dépend de `t` et `router`. Un
// objet recréé à chaque render relancerait l'effet en boucle.
const ROUTER = { push: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => ROUTER,
}));

const LANG = {
  language: "fr" as const,
  t: {
    teams: {
      title: "Mes équipes",
      roster: "Roster",
      error: "Erreur",
      rulesetInfoList: "info",
      rulesetBadge: "{label}",
      rulesetSeason2: "S2",
      rulesetSeason3: "S3",
      formatBB11: "Blood Bowl à 11",
      formatSevens: "Blood Bowl à Sept",
      formatLabel: "Format",
      createNewTeamMessage: "Crée",
      openBuilder: "Ouvrir",
    },
    common: { all: "Tous" },
  },
};
vi.mock("../../contexts/LanguageContext", () => ({
  useLanguage: () => LANG,
}));

vi.mock("./_components/OnboardingModal", () => ({
  default: () => null,
}));

const TEAMS = [
  {
    id: "t1",
    name: "Reavers",
    roster: "human",
    ruleset: "season_3",
    format: "bb11",
    createdAt: "2026-01-01T00:00:00.000Z",
    logoUrl: "/images/team-logos/reavers-abc123.png",
    competition: null,
  },
  {
    id: "t2",
    name: "Gouge",
    roster: "skaven",
    ruleset: "season_3",
    format: "bb11",
    createdAt: "2026-01-02T00:00:00.000Z",
    logoUrl: null,
    competition: null,
  },
];

const originalFetch = global.fetch;

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "token", setItem: vi.fn(), removeItem: vi.fn() },
  });
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/me")) {
      return {
        ok: true,
        json: async () => ({ user: { id: "u1", createdAt: "2020-01-01" } }),
      } as Response;
    }
    if (url.includes("/team/mine")) {
      return {
        ok: true,
        json: async () => ({ success: true, data: { teams: TEAMS } }),
      } as Response;
    }
    if (url.includes("/api/rosters")) {
      return {
        ok: true,
        json: async () => ({ rosters: [{ slug: "human", name: "Humains" }] }),
      } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("/me/teams — logos d'équipe", () => {
  it("affiche le logo uploadé et le repli programmatique", async () => {
    const { container } = render(<MyTeamsPage />);

    await waitFor(() => expect(screen.getByText("Reavers")).toBeTruthy());

    const uploaded = container.querySelector(
      'img[src="/images/team-logos/reavers-abc123.png"]',
    );
    expect(uploaded).toBeTruthy();
    // Le nom de l'équipe est déjà écrit à côté : le logo est décoratif.
    expect(uploaded?.getAttribute("alt")).toBe("");

    // La 2e équipe n'a pas de logo uploadé : SVG inline, pas de <img>.
    expect(container.querySelectorAll("img").length).toBe(1);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("n'écrit le nom d'une équipe qu'UNE fois dans le texte de la page", () => {
    // Régression : passer `title` à `TeamLogo` faisait rendre un `<title>`
    // DANS le SVG du logo programmatique. Le nom apparaissait alors deux
    // fois, et `page.getByText(nom)` de Playwright échouait en strict mode
    // (« resolved to 2 elements ») sur le parcours de création d'équipe.
    const { container } = render(<MyTeamsPage />);

    const occurrences = (name: string) =>
      Array.from(container.querySelectorAll("*")).filter(
        (el) => el.children.length === 0 && el.textContent?.trim() === name,
      ).length;

    return waitFor(() => {
      expect(screen.getByText("Gouge")).toBeTruthy();
      expect(occurrences("Reavers")).toBe(1);
      expect(occurrences("Gouge")).toBe(1);
    });
  });
});
