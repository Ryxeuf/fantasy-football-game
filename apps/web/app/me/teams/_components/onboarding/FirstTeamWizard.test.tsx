/**
 * Tests composant de l'assistant `FirstTeamWizard`.
 *
 * On mock le routeur Next, `apiRequest` (name-generator + create) et
 * `fetch` (liste des races publiques). Le flux nominal vérifie :
 * race → nom → confirmation → POST + redirection ?welcome=1.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("../../../../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "../../../../lib/api-client";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import FirstTeamWizard from "./FirstTeamWizard";

const mockedApiRequest = apiRequest as unknown as ReturnType<typeof vi.fn>;

const ROSTERS = {
  rosters: [
    { slug: "human", name: "Humains", tier: "1" },
    { slug: "orc", name: "Orcs", tier: "1" },
    { slug: "dwarf", name: "Nains", tier: "1" },
    { slug: "lizardmen", name: "Hommes-lézards", tier: "1" },
    { slug: "wood_elf", name: "Elfes Sylvains", tier: "2" },
  ],
};

function renderWizard(onDismiss = vi.fn()) {
  return render(
    <LanguageProvider>
      <FirstTeamWizard onDismiss={onDismiss} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  // fetch -> liste des races
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ROSTERS,
  }) as unknown as typeof fetch;
  // apiRequest -> name-generator (GET) puis create (POST)
  mockedApiRequest.mockImplementation((path: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      return Promise.resolve({ team: { id: "team-123" } });
    }
    return Promise.resolve({ name: "Reikland Reavers" });
  });
});

describe("FirstTeamWizard", () => {
  it("affiche les races recommandées une fois chargées", async () => {
    renderWizard();
    await waitFor(() =>
      expect(screen.getByTestId("onboarding-race-human")).toBeTruthy(),
    );
    // wood_elf n'est pas recommandé -> masqué tant qu'on n'a pas tout déplié.
    expect(screen.queryByTestId("onboarding-race-wood_elf")).toBeNull();
  });

  it("dévoile toutes les races via le toggle", async () => {
    renderWizard();
    await waitFor(() => screen.getByTestId("onboarding-race-human"));
    fireEvent.click(screen.getByTestId("onboarding-toggle-all"));
    expect(screen.getByTestId("onboarding-race-wood_elf")).toBeTruthy();
  });

  it("parcourt race → nom → confirmation → création + redirection", async () => {
    const onDismiss = vi.fn();
    renderWizard(onDismiss);
    await waitFor(() => screen.getByTestId("onboarding-race-orc"));

    // Étape 1 : sélection en 1 clic -> étape nom + nom pré-rempli.
    fireEvent.click(screen.getByTestId("onboarding-race-orc"));
    await waitFor(() =>
      expect(screen.getByTestId("onboarding-name-input")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(
        (screen.getByTestId("onboarding-name-input") as HTMLInputElement).value,
      ).toBe("Reikland Reavers"),
    );

    // Étape 2 -> staff (facultatif, rien pris) -> confirmation.
    fireEvent.click(screen.getByTestId("onboarding-next"));
    expect(screen.getByTestId("onboarding-staff-step")).toBeTruthy();
    fireEvent.click(screen.getByTestId("onboarding-next"));
    expect(screen.getByTestId("onboarding-confirm-step")).toBeTruthy();

    // Étape 3 : création.
    fireEvent.click(screen.getByTestId("onboarding-create"));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/me/teams/team-123?welcome=1"),
    );

    // POST envoyé avec le bon roster.
    const postCall = mockedApiRequest.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(postCall?.[0]).toBe("/team/create-from-roster");
    const sent = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(sent).toMatchObject({
      roster: "orc",
      name: "Reikland Reavers",
    });
    // Aucun staff pris : la création reste celle d'avant l'étape Staff.
    expect(sent).not.toHaveProperty("dedicatedFans");
    expect(sent).not.toHaveProperty("rerolls");
    expect(onDismiss).toHaveBeenCalled();
  });

  it("achète fans et relances à l'étape Staff, avec coût et budget restant", async () => {
    // Détail du roster orc : 11 Orc Linemen à 50k => 550k sur 1000k.
    global.fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          url.includes("/api/rosters/orc")
            ? {
                roster: {
                  positions: [
                    {
                      slug: "orc_lineman",
                      displayName: "Lineman",
                      cost: 50,
                      min: 0,
                      max: 16,
                      ma: 5,
                      st: 3,
                      ag: 3,
                      pa: 4,
                      av: 10,
                      skills: "",
                    },
                  ],
                },
              }
            : ROSTERS,
      }),
    ) as unknown as typeof fetch;
    renderWizard();
    await waitFor(() => screen.getByTestId("onboarding-race-orc"));
    fireEvent.click(screen.getByTestId("onboarding-race-orc"));
    await waitFor(() =>
      expect(
        (screen.getByTestId("onboarding-name-input") as HTMLInputElement).value,
      ).toBe("Reikland Reavers"),
    );
    fireEvent.click(screen.getByTestId("onboarding-next"));

    // Budget restant affiché une fois les positions chargées.
    await waitFor(() =>
      expect(screen.getByTestId("onboarding-staff-remaining").textContent).toContain("450"),
    );
    // Rappel : le premier fan n'est offert qu'à l'inscription en ligue.
    expect(screen.getByTestId("onboarding-staff-fans-hint").textContent).toMatch(/ligue/);

    fireEvent.click(screen.getByTestId("onboarding-staff-fans-inc"));
    fireEvent.click(screen.getByTestId("onboarding-staff-fans-inc"));
    fireEvent.click(screen.getByTestId("onboarding-staff-rerolls-inc"));
    expect(screen.getByTestId("onboarding-staff-fans-value").textContent).toBe("2");
    expect(screen.getByTestId("onboarding-staff-cost").textContent).not.toMatch(/^0/);

    fireEvent.click(screen.getByTestId("onboarding-next"));
    expect(screen.getByTestId("onboarding-confirm-step").textContent).toMatch(/2 fan/);
    fireEvent.click(screen.getByTestId("onboarding-create"));
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    const postCall = mockedApiRequest.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse((postCall?.[1] as RequestInit).body as string)).toMatchObject({
      roster: "orc",
      dedicatedFans: 2,
      rerolls: 1,
    });
  });

  it("régénère le nom au clic sur le dé", async () => {
    renderWizard();
    await waitFor(() => screen.getByTestId("onboarding-race-human"));
    fireEvent.click(screen.getByTestId("onboarding-race-human"));
    await waitFor(() => screen.getByTestId("onboarding-regenerate"));
    mockedApiRequest.mockResolvedValueOnce({ name: "Altdorf Avengers" });
    fireEvent.click(screen.getByTestId("onboarding-regenerate"));
    await waitFor(() =>
      expect(
        (screen.getByTestId("onboarding-name-input") as HTMLInputElement).value,
      ).toBe("Altdorf Avengers"),
    );
  });

  it("permet de skipper via 'Plus tard'", async () => {
    const onDismiss = vi.fn();
    renderWizard(onDismiss);
    await waitFor(() => screen.getByTestId("onboarding-race-human"));
    fireEvent.click(screen.getByTestId("onboarding-skip"));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("affiche une erreur si le chargement des races échoue", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    renderWizard();
    await waitFor(() =>
      expect(screen.getByTestId("onboarding-races-error")).toBeTruthy(),
    );
  });
});
