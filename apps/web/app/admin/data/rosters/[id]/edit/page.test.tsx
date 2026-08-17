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
  specialRules: null,
  naf: true,
  staffConfigs: [],
};

const originalFetch = global.fetch;

/** Réponses successives : /auth/me puis le roster. */
function mockFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/auth/me")) {
      return { ok: true, json: async () => ({ user: { roles: ["admin"] } }) };
    }
    if (init?.method === "PUT") {
      return { ok: true, json: async () => ({ roster: ROSTER }) };
    }
    return { ok: true, json: async () => ({ roster: ROSTER }) };
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
});
