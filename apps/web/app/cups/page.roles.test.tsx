/**
 * `/cups` : rôles LUS dans `viewerRoles` (servi par `GET /cup`) au lieu
 * d'être reconstruits par `/team/mine`, et « Toutes / Les miennes » transmis
 * au serveur (change OpenSpec `my-competitions`, tâche 6.3).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const replaceMock = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: replaceMock }),
  usePathname: () => "/cups",
  useSearchParams: () => new URLSearchParams(search),
}));

const apiRequestMock = vi.fn();
vi.mock("../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

vi.mock("../lib/tournament-rulesets", () => ({
  useTournamentRulesets: () => ({ rulesets: [], bySlug: new Map() }),
}));

import CupsPage from "./page";
import { cupRolesFromApi } from "./cup-roles";
import { LanguageProvider } from "../contexts/LanguageContext";

const fetchMock = vi.fn();

function json(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function cup(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    name: `Coupe ${id}`,
    description: null,
    ruleset: "season_3",
    format: "bb11",
    creator: { id: "someone", coachName: "Grim", email: "" },
    creatorId: "someone",
    validated: false,
    isPublic: true,
    status: "ouverte",
    participantCount: 0,
    participants: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

let cupsBody: unknown = { cups: [] };

beforeEach(() => {
  vi.resetAllMocks();
  search = "";
  cupsBody = { cups: [] };
  apiRequestMock.mockResolvedValue({ teams: [] });
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith("/auth/me")) return json({ user: { id: "u1" } });
    if (url.includes("/cup")) return json(cupsBody);
    return json({ rosters: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <LanguageProvider>
      <CupsPage />
    </LanguageProvider>,
  );
}

function cupCalls(): string[] {
  return fetchMock.mock.calls
    .map(([u]) => String(u))
    .filter((u) => /\/cup(\?|$)/.test(u));
}

describe("cupRolesFromApi (pur)", () => {
  it("lit viewerRoles", () => {
    expect(
      cupRolesFromApi(
        {
          creatorId: "x",
          viewerRoles: { commissioner: true, participant: "active", teams: [] },
        },
        "u1",
      ),
    ).toEqual({ isCreator: true, hasTeamParticipating: true });
  });

  it("champ absent : créateur par l'id, participation inconnue", () => {
    expect(cupRolesFromApi({ creatorId: "u1" }, "u1")).toEqual({
      isCreator: true,
      hasTeamParticipating: false,
    });
  });
});

describe("/cups — rôles et scope", () => {
  it("badges « Créateur » et « Inscrit » issus de l'API, sans /team/mine pour les rôles", async () => {
    cupsBody = {
      cups: [
        cup("c1", {
          viewerRoles: { commissioner: true, participant: null, teams: [] },
        }),
        cup("c2", {
          viewerRoles: {
            commissioner: false,
            participant: "active",
            teams: [{ id: "t1", name: "Gobs" }],
          },
        }),
        cup("c3", {
          viewerRoles: { commissioner: false, participant: null, teams: [] },
        }),
      ],
    };
    renderPage();

    expect(await screen.findByTestId("cup-role-creator-c1")).toBeTruthy();
    expect(screen.getByTestId("cup-role-registered-c2").textContent).toBe(
      "Inscrit",
    );
    expect(screen.queryByTestId("cup-role-creator-c3")).toBeNull();
    expect(screen.queryByTestId("cup-role-registered-c3")).toBeNull();
    // `/team/mine` ne sert plus qu'au formulaire de création (une fois).
    const teamMineCalls = apiRequestMock.mock.calls.filter(
      ([path]) => path === "/team/mine",
    );
    expect(teamMineCalls).toHaveLength(1);
  });

  it("défaut « Toutes » : GET /cup sans scope", async () => {
    renderPage();
    await waitFor(() => expect(cupCalls().length).toBeGreaterThan(0));
    expect(cupCalls()[0]).toMatch(/\/cup$/);
    expect(
      (await screen.findByTestId("cups-scope-all")).getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
  });

  it("?scope=mine : scope=mine dans l'appel, état vide dédié", async () => {
    search = "scope=mine";
    renderPage();
    await waitFor(() => expect(cupCalls().length).toBeGreaterThan(0));
    expect(cupCalls()[0]).toMatch(/\/cup\?scope=mine$/);
    expect((await screen.findByTestId("cups-empty")).textContent).toMatch(
      /aucune compétition/i,
    );
  });

  it("le sélecteur écrit l'URL", async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId("cups-scope-mine"));
    expect(replaceMock).toHaveBeenCalledWith("/cups?scope=mine", {
      scroll: false,
    });
  });
});
