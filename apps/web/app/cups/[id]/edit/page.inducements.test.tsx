/**
 * Édition d'une coupe : le commissaire administre ses coups de pouce (régime
 * et liste) tant que les inscriptions sont ouvertes, par la route des règles.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cup-1" }),
  useRouter: () => ({ push, back: vi.fn() }),
}));

const apiRequest = vi.fn();
vi.mock("../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  ApiClientError: class extends Error {},
}));

import CupEditPage from "./page";

const NAF_DEFINITION = {
  slug: "naf_world_cup_2027",
  shortLabel: "NAF WC 2027",
  starPlayerSppTax: [],
  allowedInducements: [
    { slug: "team_mascot", cost: 25_000 },
    { slug: "bloodweiser_kegs", cost: 50_000, max: 2 },
    { slug: "bribe", cost: 100_000 },
  ],
};

function cup(over: Record<string, unknown> = {}) {
  return {
    id: "cup-1",
    name: "Coupe NAF",
    isPublic: true,
    status: "ouverte",
    isCreator: true,
    validated: false,
    format: "bb11",
    tournamentRuleset: "naf_world_cup_2027",
    rulesConfig: { inducementMode: "build", allowedInducements: null },
    ...over,
  };
}

function serve(cupRow: Record<string, unknown>) {
  apiRequest.mockImplementation(async (path: string) => {
    if (path.startsWith("/api/tournament-rulesets")) {
      return { rulesets: [{ slug: NAF_DEFINITION.slug, enabled: true, definition: NAF_DEFINITION }] };
    }
    if (path === "/cup/cup-1") return { cup: cupRow };
    return {};
  });
}

const box = (slug: string) =>
  within(screen.getByTestId(`cup-allowed-inducements-${slug}`)).getByRole(
    "checkbox",
  ) as HTMLInputElement;

function rulesPatch(): Record<string, unknown> | undefined {
  const call = apiRequest.mock.calls.find(([path]) => path === "/cup/cup-1/rules");
  return call ? JSON.parse((call[1] as { body: string }).body) : undefined;
}

beforeEach(() => {
  apiRequest.mockReset();
  push.mockReset();
});

describe("édition d'une coupe — coups de pouce", () => {
  it("sous règlement : retire un coup de pouce, en ajoute un, enregistre la liste", async () => {
    serve(cup());
    render(<CupEditPage />);
    await waitFor(() => expect(box("bribe").checked).toBe(true));
    expect(box("weather_mage").checked).toBe(false);

    fireEvent.click(box("bribe"));
    fireEvent.click(box("weather_mage"));
    fireEvent.click(screen.getByTestId("cup-edit-submit"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/cups/cup-1"));
    const body = rulesPatch();
    expect(body).toBeDefined();
    expect(body).not.toHaveProperty("inducementMode");
    expect([...(body!.allowedInducements as string[])].sort()).toEqual([
      "bloodweiser_kegs",
      "team_mascot",
      "weather_mage",
    ]);
  });

  it("revenir à la liste du règlement enregistre l'absence de liste", async () => {
    serve(cup({ rulesConfig: { inducementMode: "build", allowedInducements: ["team_mascot"] } }));
    render(<CupEditPage />);
    await waitFor(() => expect(box("team_mascot").checked).toBe(true));
    expect(box("bribe").checked).toBe(false);

    fireEvent.click(screen.getByTestId("cup-allowed-inducements-reset"));
    fireEvent.click(screen.getByTestId("cup-edit-submit"));

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(rulesPatch()).toEqual({ allowedInducements: null });
  });

  it("rien changé : aucun appel à la route des règles", async () => {
    serve(cup());
    render(<CupEditPage />);
    await waitFor(() => expect(box("bribe").checked).toBe(true));

    fireEvent.click(screen.getByTestId("cup-edit-submit"));

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(rulesPatch()).toBeUndefined();
  });

  it("sans règlement : passer en « Aucun » enregistre le mode", async () => {
    serve(cup({ tournamentRuleset: null, rulesConfig: { inducementMode: "match", allowedInducements: null } }));
    render(<CupEditPage />);
    fireEvent.click(await screen.findByTestId("cup-inducement-mode-none"));
    fireEvent.click(screen.getByTestId("cup-edit-submit"));

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(rulesPatch()).toEqual({ inducementMode: "none" });
  });

  it("inscriptions closes : lecture seule, avec la raison, et rien d'envoyé", async () => {
    serve(
      cup({
        validated: true,
        status: "en_cours",
        rulesConfig: { inducementMode: "build", allowedInducements: ["team_mascot", "weather_mage"] },
      }),
    );
    render(<CupEditPage />);
    expect(await screen.findByTestId("cup-edit-inducements-locked")).toBeTruthy();
    expect(screen.queryByTestId("cup-allowed-inducements")).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId("cup-allowed-inducements-display").textContent).toMatch(
        /\+ Mage Météo/,
      ),
    );

    fireEvent.click(screen.getByTestId("cup-edit-submit"));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(rulesPatch()).toBeUndefined();
  });
});
