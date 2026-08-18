/**
 * Admin — édition d'un roster : les ligues régionales se saisissent en
 * cases à cocher (même modèle que les règles spéciales) et non plus en
 * texte libre séparé par des virgules.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import EditRosterPage from "./page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ id: "roster-1" }),
}));

const ROSTER = {
  id: "roster-1",
  slug: "wood_elf",
  ruleset: "season_3",
  name: "Elfes Sylvains",
  nameEn: "Wood Elf",
  descriptionFr: null,
  descriptionEn: null,
  budget: 1150,
  tier: "I",
  // Une ligue du catalogue + un slug hérité hors catalogue.
  regionalRules: ["elven_kingdoms_league", "favoured_of"],
  regionalRulesSource: "db",
  specialRules: null,
  naf: true,
  staffConfigs: [],
};

const originalFetch = global.fetch;

/** Réponses successives : /auth/me puis le roster. */
function mockFetch(
  roster: Record<string, unknown> = ROSTER,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/auth/me")) {
      return { ok: true, json: async () => ({ user: { roles: ["admin"] } }) };
    }
    if (init?.method === "PUT") {
      return { ok: true, json: async () => ({ roster }) };
    }
    return { ok: true, json: async () => ({ roster }) };
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

describe("EditRosterPage — ligues régionales en cases à cocher", () => {
  it("coche les ligues du roster et préserve un slug hors catalogue", async () => {
    mockFetch();
    render(<EditRosterPage />);

    await waitFor(() =>
      expect(screen.getByTestId("roster-regional-leagues")).toBeTruthy(),
    );

    const checked = (slug: string) =>
      (
        screen.getByTestId(
          `roster-regional-leagues-${slug}`,
        ) as HTMLInputElement
      ).checked;

    expect(checked("elven_kingdoms_league")).toBe(true);
    expect(checked("old_world_classic")).toBe(false);
    // Slug hérité absent du catalogue : conservé et coché.
    expect(checked("favoured_of")).toBe(true);
    // Plus de champ texte libre.
    expect(document.querySelector('input[name="regionalRules"]')).toBeNull();
  });

  it("envoie le tableau de slugs cochés à l'API", async () => {
    const fetchMock = mockFetch();
    render(<EditRosterPage />);
    await waitFor(() =>
      expect(screen.getByTestId("roster-regional-leagues")).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId("roster-regional-leagues-woodland_league"));
    fireEvent.click(
      screen.getByTestId("roster-regional-leagues-elven_kingdoms_league"),
    );
    fireEvent.click(screen.getByRole("button", { name: /Mettre à jour/i }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => c[1]?.method === "PUT"),
      ).toBe(true),
    );
    const put = fetchMock.mock.calls.find((c) => c[1]?.method === "PUT")!;
    const body = JSON.parse(String(put[1]?.body));
    expect(body.regionalRules).toEqual(["favoured_of", "woodland_league"]);
  });

  it("coche les ligues héritées du catalogue quand rien n'est en base", async () => {
    // Cas majoritaire en prod : le seed laisse `regionalRules` NULL et
    // l'API renvoie donc le défaut du roster, marqué comme tel.
    mockFetch({
      ...ROSTER,
      regionalRules: ["elven_kingdoms_league", "woodland_league"],
      regionalRulesSource: "roster-defaults",
    });
    render(<EditRosterPage />);

    await waitFor(() =>
      expect(screen.getByTestId("roster-regional-leagues")).toBeTruthy(),
    );
    expect(
      (
        screen.getByTestId(
          "roster-regional-leagues-elven_kingdoms_league",
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (
        screen.getByTestId(
          "roster-regional-leagues-woodland_league",
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    // L'admin est prévenu que ces valeurs ne sont pas encore en base.
    expect(
      screen.getByTestId("roster-regional-leagues-inherited"),
    ).toBeTruthy();
  });

  it("ne signale rien quand les ligues viennent de la base", async () => {
    mockFetch();
    render(<EditRosterPage />);
    await waitFor(() =>
      expect(screen.getByTestId("roster-regional-leagues")).toBeTruthy(),
    );
    expect(
      screen.queryByTestId("roster-regional-leagues-inherited"),
    ).toBeNull();
  });

  it("tolère un CSV historique renvoyé par l'API", async () => {
    mockFetch({
      ...ROSTER,
      regionalRules: "elven_kingdoms_league, woodland_league",
    });
    render(<EditRosterPage />);
    await waitFor(() =>
      expect(screen.getByTestId("roster-regional-leagues")).toBeTruthy(),
    );
    expect(
      (
        screen.getByTestId(
          "roster-regional-leagues-woodland_league",
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });


  it("confirme l'enregistrement en relisant ce que le serveur a stocké", async () => {
    // Le GET qui suit le PUT renvoie l'état réel en base : c'est LUI qui
    // est affiché, pas la sélection locale — un écart devient visible.
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/me")) {
        return { ok: true, json: async () => ({ user: { roles: ["admin"] } }) };
      }
      if (init?.method === "PUT") {
        return { ok: true, json: async () => ({ roster: ROSTER }) };
      }
      return {
        ok: true,
        json: async () => ({
          roster: {
            ...ROSTER,
            regionalRules: ["elven_kingdoms_league", "woodland_league"],
            regionalRulesSource: "db",
          },
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<EditRosterPage />);
    await waitFor(() =>
      expect(screen.getByTestId("roster-regional-leagues")).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Mettre à jour/i }));

    await waitFor(() =>
      expect(screen.getByTestId("roster-save-success").textContent).toContain(
        "woodland_league",
      ),
    );
    expect(screen.getByTestId("roster-save-success").textContent).toContain(
      "Règles spéciales : aucune",
    );
  });

  it("affiche l'échec d'enregistrement et ne confirme rien", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/me")) {
        return { ok: true, json: async () => ({ user: { roles: ["admin"] } }) };
      }
      if (init?.method === "PUT") {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: "budget: Expected number" }),
        };
      }
      return { ok: true, json: async () => ({ roster: ROSTER }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<EditRosterPage />);
    await waitFor(() =>
      expect(screen.getByTestId("roster-regional-leagues")).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Mettre à jour/i }));

    await waitFor(() =>
      expect(screen.getByText(/budget/)).toBeTruthy(),
    );
    expect(screen.queryByTestId("roster-save-success")).toBeNull();
  });
});
