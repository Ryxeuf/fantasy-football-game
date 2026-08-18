/**
 * Admin — création d'un roster.
 *
 * L'écran n'avait aucun champ pour les ligues ni les règles spéciales :
 * il fallait créer le roster puis rouvrir sa fiche pour les renseigner,
 * alors que `POST /admin/data/rosters` accepte déjà les deux.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import NewRosterPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const originalFetch = global.fetch;

function mockFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes("/auth/me")) {
      return { ok: true, json: async () => ({ user: { roles: ["admin"] } }) };
    }
    return { ok: true, json: async () => ({ roster: { id: "r1" } }) };
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

/** Remplit les champs obligatoires du formulaire. */
function fillRequired() {
  fireEvent.change(document.querySelector('input[name="slug"]')!, {
    target: { value: "wood_elf" },
  });
  fireEvent.change(document.querySelector('input[name="name"]')!, {
    target: { value: "Elfes Sylvains" },
  });
  fireEvent.change(document.querySelector('input[name="nameEn"]')!, {
    target: { value: "Wood Elf" },
  });
  fireEvent.change(document.querySelector('input[name="budget"]')!, {
    target: { value: "1150" },
  });
}

describe("NewRosterPage — ligues à la création", () => {
  it("propose les ligues et les règles spéciales en cases à cocher", async () => {
    mockFetch();
    render(<NewRosterPage />);
    await waitFor(() =>
      expect(screen.getByTestId("roster-new-regional-leagues")).toBeTruthy(),
    );
    expect(screen.getByTestId("roster-new-special-rules")).toBeTruthy();
  });

  it("envoie les ligues cochées dans le POST de création", async () => {
    const fetchMock = mockFetch();
    render(<NewRosterPage />);
    await waitFor(() =>
      expect(screen.getByTestId("roster-new-regional-leagues")).toBeTruthy(),
    );

    fillRequired();
    fireEvent.click(
      screen.getByTestId("roster-new-regional-leagues-woodland_league"),
    );
    fireEvent.click(
      screen.getByTestId(
        "roster-new-regional-leagues-elven_kingdoms_league",
      ),
    );
    fireEvent.click(screen.getByText("Créer le roster"));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(
        true,
      ),
    );
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === "POST")!;
    const body = JSON.parse(String(post[1]?.body));
    expect(body.regionalRules).toEqual([
      "woodland_league",
      "elven_kingdoms_league",
    ]);
  });

  it("envoie null quand aucune ligue n'est cochée", async () => {
    const fetchMock = mockFetch();
    render(<NewRosterPage />);
    await waitFor(() =>
      expect(screen.getByTestId("roster-new-regional-leagues")).toBeTruthy(),
    );

    fillRequired();
    fireEvent.click(screen.getByText("Créer le roster"));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(
        true,
      ),
    );
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === "POST")!;
    const body = JSON.parse(String(post[1]?.body));
    expect(body.regionalRules).toBeNull();
    expect(body.specialRules).toBeNull();
  });
});
