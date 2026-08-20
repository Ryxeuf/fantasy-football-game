/**
 * Admin — création d'un Star Player : ruleset explicite et sélection des
 * compétences / règles de recrutement en cases à cocher.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import NewStarPlayerPage from "./page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// `DEFAULT_RULESET` vaut `season_3` : c'est le ruleset pré-sélectionné.
const SKILLS_BY_RULESET: Record<string, Array<Record<string, string>>> = {
  season_3: [
    { slug: "block", nameFr: "Blocage", nameEn: "Block", category: "General" },
  ],
  season_2: [
    { slug: "block", nameFr: "Blocage", nameEn: "Block", category: "General" },
    { slug: "piling-on", nameFr: "Plaquage appuyé", nameEn: "Piling On", category: "Strength" },
  ],
};

const ROSTERS = [{ id: "roster-orc", slug: "orc", name: "Orques" }];

const originalFetch = global.fetch;

function mockFetch() {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const path = String(url);
    if (path.includes("/auth/me")) {
      return { ok: true, json: async () => ({ user: { roles: ["admin"] } }) };
    }
    if (path.includes("/admin/data/skills")) {
      const ruleset = path.includes("season_2") ? "season_2" : "season_3";
      return {
        ok: true,
        json: async () => ({ skills: SKILLS_BY_RULESET[ruleset] }),
      };
    }
    if (path.includes("/admin/data/rosters")) {
      return { ok: true, json: async () => ({ rosters: ROSTERS }) };
    }
    return { ok: true, json: async () => ({ starPlayer: { id: "sp1" } }) };
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

describe("NewStarPlayerPage — sélection en chips", () => {
  it("recharge les catalogues au changement de ruleset sans vider le formulaire", async () => {
    mockFetch();
    render(<NewStarPlayerPage />);

    // Le catalogue est proposé dans les suggestions du sélecteur.
    await waitFor(() =>
      expect(screen.getByTestId("star-player-skills-search")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(screen.getByTestId("star-player-skills-search")).toBeTruthy(),
    );
    fireEvent.focus(screen.getByTestId("star-player-skills-search"));
    await waitFor(() =>
      expect(screen.getByTestId("star-player-skills-option-block")).toBeTruthy(),
    );
    expect(
      screen.queryByTestId("star-player-skills-option-piling-on"),
    ).toBeNull();

    const slugInput = document.querySelector(
      'input[name="slug"]',
    ) as HTMLInputElement;
    fireEvent.change(slugInput, { target: { value: "griff_oberwald" } });

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "season_2" },
    });

    await waitFor(() =>
      expect(
        screen.getByTestId("star-player-skills-option-piling-on"),
      ).toBeTruthy(),
    );
    // Le formulaire n'a pas été démonté : la saisie en cours est intacte.
    expect(
      (document.querySelector('input[name="slug"]') as HTMLInputElement).value,
    ).toBe("griff_oberwald");
  });

  it("envoie le ruleset et la sélection", async () => {
    const fetchMock = mockFetch();
    render(<NewStarPlayerPage />);

    await waitFor(() =>
      expect(screen.getByTestId("star-player-skills-search")).toBeTruthy(),
    );
    fireEvent.focus(screen.getByTestId("star-player-skills-search"));
    await waitFor(() =>
      expect(screen.getByTestId("star-player-skills-option-block")).toBeTruthy(),
    );

    const setField = (name: string, value: string) =>
      fireEvent.change(
        document.querySelector(`[name="${name}"]`) as HTMLElement,
        { target: { value } },
      );
    setField("slug", "griff_oberwald");
    setField("displayName", "Griff Oberwald");
    setField("cost", "280000");
    setField("ma", "7");
    setField("st", "4");
    setField("ag", "2");
    setField("av", "9");

    fireEvent.click(screen.getByTestId("star-player-skills-option-block"));
    expect(screen.getByTestId("star-player-skills-chip-block")).toBeTruthy();
    fireEvent.click(screen.getByTestId("star-player-hirable-rules-all"));
    fireEvent.click(
      screen.getByTestId("star-player-hirable-rosters-roster-orc"),
    );
    fireEvent.click(screen.getByText("Créer le Star Player"));

    await waitFor(() => expect(pushMock).toHaveBeenCalled());

    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST",
    );
    const body = JSON.parse(String(post?.[1]?.body));
    expect(body.ruleset).toBe("season_3");
    expect(body.skillSlugs).toEqual(["block"]);
    expect(body.hirableBy).toEqual([
      "all",
      { rule: "orc", rosterId: "roster-orc" },
    ]);
  });
});
