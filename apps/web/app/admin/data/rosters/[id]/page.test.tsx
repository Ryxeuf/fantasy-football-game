/**
 * Admin — fiche d'un roster (formulaire d'édition en ligne).
 *
 * Cet écran gardait un champ texte libre pour les ligues régionales alors
 * que la page `/edit` était passée en cases à cocher. Il utilise désormais
 * la même grille, alimentée par les ligues effectives renvoyées par l'API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import AdminRosterDetailPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
  regionalRules: ["elven_kingdoms_league", "woodland_league"],
  regionalRulesSource: "roster-defaults",
  specialRules: null,
  naf: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  positions: [],
  staffConfigs: [],
};

const originalFetch = global.fetch;

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

/** Ouvre le formulaire d'édition en ligne. */
async function openEditor() {
  render(<AdminRosterDetailPage />);
  await waitFor(() =>
    expect(screen.getByText(/Modifier/)).toBeTruthy(),
  );
  fireEvent.click(screen.getByText(/Modifier/));
  await waitFor(() =>
    expect(screen.getByTestId("roster-detail-regional-leagues")).toBeTruthy(),
  );
}

describe("AdminRosterDetailPage — ligues en cases à cocher", () => {
  it("coche les ligues effectives renvoyées par l'API", async () => {
    mockFetch();
    await openEditor();

    const checked = (slug: string) =>
      (
        screen.getByTestId(
          `roster-detail-regional-leagues-${slug}`,
        ) as HTMLInputElement
      ).checked;
    expect(checked("elven_kingdoms_league")).toBe(true);
    expect(checked("woodland_league")).toBe(true);
    expect(checked("badlands_brawl")).toBe(false);
    // Plus de champ texte libre.
    expect(document.querySelector('input[name="regionalRules"]')).toBeNull();
    // Ligues héritées du catalogue : l'admin est prévenu.
    expect(
      screen.getByTestId("roster-detail-regional-leagues-inherited"),
    ).toBeTruthy();
  });

  it("envoie le tableau de slugs cochés à l'API", async () => {
    const fetchMock = mockFetch();
    await openEditor();

    fireEvent.click(
      screen.getByTestId("roster-detail-regional-leagues-woodland_league"),
    );
    fireEvent.click(screen.getByText("Mettre à jour"));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => c[1]?.method === "PUT")).toBe(
        true,
      ),
    );
    const put = fetchMock.mock.calls.find((c) => c[1]?.method === "PUT")!;
    const body = JSON.parse(String(put[1]?.body));
    expect(body.regionalRules).toEqual(["elven_kingdoms_league"]);
  });

  it("ne signale rien quand les ligues viennent de la base", async () => {
    mockFetch({ ...ROSTER, regionalRulesSource: "db" });
    await openEditor();
    expect(
      screen.queryByTestId("roster-detail-regional-leagues-inherited"),
    ).toBeNull();
  });
});
