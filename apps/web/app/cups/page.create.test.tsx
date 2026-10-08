/**
 * Création d'une coupe : le mode de saisie de la feuille de match. Une coupe
 * neuve naît en saisie SIMPLIFIÉE (pré-sélectionnée) ; le commissaire peut
 * choisir la saisie complète.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("../lib/api-client", () => ({
  apiRequest: vi.fn().mockResolvedValue({ teams: [] }),
  ApiClientError: class extends Error {},
}));

vi.mock("../lib/tournament-rulesets", () => ({
  useTournamentRulesets: () => ({ rulesets: [], bySlug: new Map() }),
}));

import CupsPage from "./page";

const fetchMock = vi.fn();

function json(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    if (url.endsWith("/auth/me")) return json({ user: { id: "u1" } });
    if (url.endsWith("/cup") && init?.method === "POST") {
      return json({ cup: { id: "cup-new" } });
    }
    if (url.endsWith("/cup")) return json({ cups: [] });
    return json({ rosters: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function createBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).endsWith("/cup") &&
      (init as { method?: string } | undefined)?.method === "POST",
  );
  expect(call).toBeTruthy();
  return JSON.parse((call![1] as { body: string }).body);
}

async function openForm() {
  render(<CupsPage />);
  fireEvent.click(await screen.findByText("Nouvelle coupe"));
  fireEvent.change(screen.getByLabelText(/Nom de la coupe/), {
    target: { value: "Coupe du Gouffre" },
  });
}

describe("création d'une coupe — mode de saisie de la feuille", () => {
  it("pré-sélectionne la saisie simplifiée et l'envoie", async () => {
    await openForm();
    expect(
      (screen.getByTestId("sheet-entry-mode-simplified") as HTMLInputElement)
        .checked,
    ).toBe(true);

    fireEvent.submit(screen.getByLabelText(/Nom de la coupe/).closest("form")!);

    await waitFor(() => expect(createBody().sheetEntryMode).toBe("simplified"));
  });

  it("envoie la saisie complète quand le commissaire la choisit", async () => {
    await openForm();
    fireEvent.click(screen.getByTestId("sheet-entry-mode-full"));

    fireEvent.submit(screen.getByLabelText(/Nom de la coupe/).closest("form")!);

    await waitFor(() => expect(createBody().sheetEntryMode).toBe("full"));
  });
});
