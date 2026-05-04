/**
 * S27.1c — Tests de la page calendrier `/cups/monthly`.
 *
 * Page publique qui consomme `GET /cup/monthly` (S27.1b) et liste les
 * Nuffle Cup mensuelles ordonnees `monthlyYear DESC, monthlyMonth DESC`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MonthlyCupsPage from "./page";
import { LanguageProvider } from "../../contexts/LanguageContext";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: vi.fn<(key: string) => string | null>(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

function renderPage() {
  return render(
    <LanguageProvider>
      <MonthlyCupsPage />
    </LanguageProvider>,
  );
}

const cupsPayload = {
  cups: [
    {
      id: "cup-april-2026",
      name: "Nuffle Cup Avril 2026",
      monthlyYear: 2026,
      monthlyMonth: 4,
      status: "ouverte",
      isPublic: true,
    },
    {
      id: "cup-march-2026",
      name: "Nuffle Cup Mars 2026",
      monthlyYear: 2026,
      monthlyMonth: 3,
      status: "terminee",
      isPublic: true,
    },
  ],
};

describe("MonthlyCupsPage (S27.1c)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it("affiche un etat de chargement initial", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("monthly-cups-loading")).toBeTruthy();
  });

  it("affiche les cups apres fetch reussi", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: cupsPayload }),
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("monthly-cups-list")).toBeTruthy(),
    );
    expect(screen.getByText("Nuffle Cup Avril 2026")).toBeTruthy();
    expect(screen.getByText("Nuffle Cup Mars 2026")).toBeTruthy();
  });

  it("liste les cups dans l'ordre renvoye par l'API", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: cupsPayload }),
    });
    renderPage();
    await waitFor(() => screen.getByTestId("monthly-cups-list"));
    const items = screen.getAllByTestId(/^monthly-cup-item-/);
    expect(items[0].getAttribute("data-testid")).toBe(
      "monthly-cup-item-cup-april-2026",
    );
    expect(items[1].getAttribute("data-testid")).toBe(
      "monthly-cup-item-cup-march-2026",
    );
  });

  it("lie chaque cup a sa page detail /cups/{id}", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: cupsPayload }),
    });
    renderPage();
    await waitFor(() => screen.getByTestId("monthly-cups-list"));
    const links = screen.getAllByRole("link");
    expect(
      links.some((a) =>
        (a as HTMLAnchorElement).href.endsWith("/cups/cup-april-2026"),
      ),
    ).toBe(true);
  });

  it("affiche un empty state quand aucune cup n'est retournee", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { cups: [] } }),
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("monthly-cups-empty")).toBeTruthy(),
    );
  });

  it("affiche une erreur si l'API echoue", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "boom" }),
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("monthly-cups-error")).toBeTruthy(),
    );
  });

  it("appelle GET /cup/monthly", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: cupsPayload }),
    });
    renderPage();
    await waitFor(() => screen.getByTestId("monthly-cups-list"));
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toMatch(/\/cup\/monthly(\?|$)/);
  });
});
