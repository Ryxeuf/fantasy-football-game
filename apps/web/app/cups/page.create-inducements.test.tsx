/**
 * Création d'une coupe : régime des coups de pouce. BB11 ⇒ `build`
 * présélectionné ; Sept ⇒ pas de `build` ; règlement ⇒ `build` imposé et
 * grisé, sans liste autorisée. Le choix et la liste partent dans le POST.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("../lib/api-client", () => ({
  apiRequest: vi.fn().mockResolvedValue({ teams: [] }),
  ApiClientError: class extends Error {},
}));

const NAF = {
  slug: "naf_world_cup_2027",
  definition: {
    edition: "season_3",
    format: "bb11",
    nameFr: "NAF World Cup 2027",
    shortLabel: "NAF WC 2027",
  },
};

vi.mock("../lib/tournament-rulesets", () => ({
  useTournamentRulesets: () => ({
    rulesets: [NAF],
    bySlug: new Map([[NAF.slug, NAF.definition]]),
  }),
}));

import CupsPage from "./page";

const fetchMock = vi.fn();

function json(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
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

const radio = (mode: string) =>
  screen.queryByTestId(`cup-inducement-mode-${mode}`) as HTMLInputElement | null;

function submit() {
  fireEvent.submit(screen.getByLabelText(/Nom de la coupe/).closest("form")!);
}

describe("création d'une coupe — coups de pouce", () => {
  it("BB11 : `build` présélectionné, envoyé sans liste", async () => {
    await openForm();
    expect(radio("build")?.checked).toBe(true);
    expect(radio("match")).toBeTruthy();
    expect(radio("none")).toBeTruthy();
    expect(screen.getByTestId("cup-allowed-inducements")).toBeTruthy();

    submit();
    await waitFor(() => expect(createBody().inducementMode).toBe("build"));
    expect(createBody().allowedInducements).toBeUndefined();
  });

  it("envoie la liste autorisée cochée", async () => {
    await openForm();
    fireEvent.click(radio("match")!);
    fireEvent.click(
      within(screen.getByTestId("cup-allowed-inducements-team_mascot")).getByRole(
        "checkbox",
      ),
    );

    submit();
    await waitFor(() => expect(createBody().inducementMode).toBe("match"));
    expect(createBody().allowedInducements).toEqual(["team_mascot"]);
  });

  it("`none` : pas de liste, rien d'envoyé pour elle", async () => {
    await openForm();
    fireEvent.click(radio("none")!);
    expect(screen.queryByTestId("cup-allowed-inducements")).toBeNull();

    submit();
    await waitFor(() => expect(createBody().inducementMode).toBe("none"));
    expect(createBody().allowedInducements).toBeUndefined();
  });

  it("Sept : `build` absent, l'avant-match prend le relais", async () => {
    await openForm();
    fireEvent.change(screen.getByTestId("cup-format-select"), {
      target: { value: "sevens" },
    });
    await waitFor(() => expect(radio("build")).toBeNull());
    expect(radio("match")?.checked).toBe(true);

    submit();
    await waitFor(() => expect(createBody().inducementMode).toBe("match"));
  });

  it("règlement : `build` imposé, grisé, sans liste autorisée", async () => {
    await openForm();
    fireEvent.change(screen.getByTestId("cup-tournament-ruleset-select"), {
      target: { value: NAF.slug },
    });
    await waitFor(() =>
      expect(screen.getByTestId("cup-inducement-mode-locked").textContent).toMatch(
        /NAF WC 2027/,
      ),
    );
    expect(radio("build")?.checked).toBe(true);
    expect(radio("build")?.disabled).toBe(true);
    expect(radio("match")).toBeNull();
    expect(screen.queryByTestId("cup-allowed-inducements")).toBeNull();

    submit();
    await waitFor(() => expect(createBody().inducementMode).toBe("build"));
    expect(createBody().allowedInducements).toBeUndefined();
  });
});
