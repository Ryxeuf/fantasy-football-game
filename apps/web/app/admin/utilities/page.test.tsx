/**
 * Tests de la page admin/utilities.
 *
 * Couvre : rendu de la card seed-pro-league, exécution succès (fetch
 * réussi + message), gestion d'erreur (fetch failed), état loading.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import AdminUtilitiesPage from "./page";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => "dummy-token",
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("AdminUtilitiesPage", () => {
  it("rend la card 'Reseed Pro League'", () => {
    render(<AdminUtilitiesPage />);
    expect(screen.getByTestId("utility-seed-pro-league")).toBeTruthy();
    expect(screen.getByText(/Reseed Pro League/i)).toBeTruthy();
    expect(screen.getByTestId("utility-run-seed-pro-league")).toBeTruthy();
  });

  it("clic sur Executer → POST endpoint + display success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        durationMs: 42,
        leagueCount: 1,
        teamCount: 16,
        message: "Pro League re-seed OK en 42ms. 16 equipes, 1 ligue(s).",
      }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminUtilitiesPage />);
    fireEvent.click(screen.getByTestId("utility-run-seed-pro-league"));

    await waitFor(() => {
      expect(
        screen.getByTestId("utility-success-seed-pro-league"),
      ).toBeTruthy();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/utilities/seed/pro-league"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(
      screen.getByTestId("utility-success-seed-pro-league").textContent,
    ).toMatch(/16 equipes/);
  });

  it("display error si fetch echoue", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "seed failed" }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminUtilitiesPage />);
    fireEvent.click(screen.getByTestId("utility-run-seed-pro-league"));

    await waitFor(() => {
      expect(screen.getByTestId("utility-error-seed-pro-league")).toBeTruthy();
    });
    expect(
      screen.getByTestId("utility-error-seed-pro-league").textContent,
    ).toMatch(/seed failed/);
  });

  it("bouton desactive pendant l'execution", async () => {
    // Promise qui ne resout jamais pour observer l'etat loading.
    let resolve: (v: any) => void = () => {};
    global.fetch = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    ) as unknown as typeof fetch;

    render(<AdminUtilitiesPage />);
    const btn = screen.getByTestId(
      "utility-run-seed-pro-league",
    ) as HTMLButtonElement;
    fireEvent.click(btn);

    await waitFor(() => {
      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toMatch(/execution/i);
    });

    // Cleanup pour pas laisser de Promise pending.
    resolve({
      ok: true,
      json: async () => ({ ok: true, message: "done" }),
    });
  });
});
