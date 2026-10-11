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
    allowedInducements: [
      { slug: "team_mascot", cost: 25_000 },
      { slug: "bloodweiser_kegs", cost: 50_000, max: 2 },
      { slug: "bribe", cost: 100_000 },
    ],
  },
};

vi.mock("../lib/tournament-rulesets", () => ({
  useTournamentRulesets: () => ({
    rulesets: [NAF],
    bySlug: new Map([[NAF.slug, NAF.definition]]),
  }),
}));

import CupsPage from "./page";
import { ALLOWED_INDUCEMENT_OPTIONS } from "../components/AllowedInducementsField";

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

const box = (slug: string) =>
  within(screen.getByTestId(`cup-allowed-inducements-${slug}`)).getByRole(
    "checkbox",
  ) as HTMLInputElement;

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

  it("sans règlement, tout est coché : décocher interdit, et part dans le POST", async () => {
    await openForm();
    fireEvent.click(radio("match")!);
    expect(box("team_mascot").checked).toBe(true);
    expect(box("weather_mage").checked).toBe(true);
    fireEvent.click(box("team_mascot"));

    submit();
    await waitFor(() => expect(createBody().inducementMode).toBe("match"));
    const sent = createBody().allowedInducements as string[];
    expect(sent).not.toContain("team_mascot");
    expect(sent).toContain("weather_mage");
  });

  it("tout décocher : aucun coup de pouce, envoyé comme liste vide", async () => {
    await openForm();
    for (const slug of ALLOWED_INDUCEMENT_OPTIONS.map((o) => o.slug)) {
      fireEvent.click(box(slug));
    }
    expect(screen.getByTestId("cup-allowed-inducements-empty")).toBeTruthy();

    submit();
    await waitFor(() => expect(createBody().allowedInducements).toEqual([]));
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

  it("règlement : la liste du règlement est cochée ; retirer et ajouter part dans le POST", async () => {
    await openForm();
    fireEvent.change(screen.getByTestId("cup-tournament-ruleset-select"), {
      target: { value: NAF.slug },
    });
    await waitFor(() => expect(box("bribe").checked).toBe(true));
    expect(box("team_mascot").checked).toBe(true);
    expect(box("weather_mage").checked).toBe(false);
    expect(
      screen.getByTestId("cup-allowed-inducements-team_mascot-badge").textContent,
    ).toMatch(/NAF WC 2027 · 25k/);

    fireEvent.click(box("bribe"));
    fireEvent.click(box("weather_mage"));

    submit();
    await waitFor(() => expect(createBody().inducementMode).toBe("build"));
    expect([...(createBody().allowedInducements as string[])].sort()).toEqual(
      ["bloodweiser_kegs", "team_mascot", "weather_mage"],
    );
  });

  it("règlement : revenir à la liste du règlement n'envoie aucune liste", async () => {
    await openForm();
    fireEvent.change(screen.getByTestId("cup-tournament-ruleset-select"), {
      target: { value: NAF.slug },
    });
    await waitFor(() => expect(box("bribe").checked).toBe(true));
    fireEvent.click(box("bribe"));
    fireEvent.click(screen.getByTestId("cup-allowed-inducements-reset"));
    expect(box("bribe").checked).toBe(true);
    expect(screen.queryByTestId("cup-allowed-inducements-reset")).toBeNull();

    submit();
    await waitFor(() => expect(createBody().inducementMode).toBe("build"));
    expect(createBody().allowedInducements).toBeUndefined();
  });

  it("règlement : `build` imposé et grisé", async () => {
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
    expect(screen.getByTestId("cup-allowed-inducements")).toBeTruthy();

    submit();
    await waitFor(() => expect(createBody().inducementMode).toBe("build"));
    expect(createBody().allowedInducements).toBeUndefined();
  });
});
