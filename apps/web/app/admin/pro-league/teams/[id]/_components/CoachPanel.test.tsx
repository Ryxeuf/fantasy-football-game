import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import CoachPanel from "./CoachPanel";
import { COACH_PARAMETERS, diffProfiles } from "./coach-parameters";

const originalFetch = global.fetch;

function profile(overrides: Record<string, number> = {}): Record<string, number> {
  const base: Record<string, number> = {};
  for (const p of COACH_PARAMETERS) base[p.key] = 50;
  return { ...base, ...overrides };
}

const coachFixture = {
  id: "coach-1",
  name: "Grishnak Ironjaw",
  philosophy: "Cogneur, patient",
  profile: profile({ bashIndex: 82, pace: 44 }),
  anchorProfile: profile({ bashIndex: 80, pace: 45 }),
  experience: 3,
  updatedAt: "2026-10-05T00:00:00.000Z",
};

const memoryFixture = [
  {
    id: "m1",
    matchId: "match-1",
    summary: "4 drives, 2 TD marqués, 1 encaissé, 2 turnovers. Le coach ajuste : bashIndex +2.",
    changes: [
      { parameter: "bashIndex", before: 80, after: 82, reason: "« blitz-train » rapporte sur 4 drives (EMA +0,55) → bashIndex +2" },
      { parameter: "pace", before: 45, after: 44, reason: "rappel vers l'ancre (45) → pace −1" },
    ],
    createdAt: "2026-10-04T00:00:00.000Z",
  },
];

type FetchCall = { url: string; init?: RequestInit };

function mockFetch(responses: Record<string, unknown> = {}): FetchCall[] {
  const calls: FetchCall[] = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const key = `${init?.method ?? "GET"} ${url.replace(/^.*\/admin/, "/admin")}`;
    const body = responses[key];
    if (body instanceof Error) {
      return { ok: false, status: 500, json: async () => ({ error: body.message }) } as unknown as Response;
    }
    if (body === undefined) {
      return { ok: false, status: 404, json: async () => ({ error: "not mocked" }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "dummy-token", setItem: vi.fn(), removeItem: vi.fn() },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

/**
 * Le web ne dépend pas de `@bb/sim-engine` : la liste des paramètres est
 * relue dans la SOURCE du moteur (`TACTICAL_PROFILE_PARAMETERS`) pour que
 * tout ajout d'un paramètre fasse échouer ce test.
 */
function engineParameters(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    path.resolve(here, "../../../../../../../../packages/sim-engine/src/tactics/tactical-profile.ts"),
    "utf8",
  );
  const block = /TACTICAL_PROFILE_PARAMETERS = \[([\s\S]*?)\] as const/.exec(src);
  if (!block) throw new Error("TACTICAL_PROFILE_PARAMETERS introuvable dans le moteur");
  return [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
}

describe("COACH_PARAMETERS", () => {
  it("couvre exactement les 15 paramètres du TacticalProfile du moteur", () => {
    const engine = engineParameters();
    expect(engine).toHaveLength(15);
    expect(COACH_PARAMETERS.map((p) => p.key).sort()).toEqual([...engine].sort());
  });

  it("diffProfiles ne rend que les paramètres modifiés", () => {
    expect(diffProfiles(profile(), profile({ pace: 60 }))).toEqual({ pace: 60 });
    expect(diffProfiles(profile(), profile())).toEqual({});
  });
});

describe("CoachPanel", () => {
  it("charge le coach et le journal, montre l'ancre et le profil vivant", async () => {
    mockFetch({
      "GET /admin/pro-league/teams/t1/coach": { coach: coachFixture },
      "GET /admin/pro-league/teams/t1/coach/memory?limit=10": { memory: memoryFixture },
    });
    render(<CoachPanel teamId="t1" />);
    await waitFor(() => expect(screen.getByTestId("coach-name")).toBeTruthy());
    expect((screen.getByTestId("coach-name") as HTMLInputElement).value).toBe("Grishnak Ironjaw");
    expect(screen.getByTestId("coach-experience").textContent).toBe("3");
    expect((screen.getByTestId("coach-anchor-bashIndex") as HTMLInputElement).value).toBe("80");
    expect(screen.getByTestId("coach-living-bashIndex").textContent).toBe("82");
    expect(screen.getByTestId("coach-dirty").textContent).toMatch(/Aucune modification/);
    expect(screen.getByTestId("coach-memory").querySelectorAll("li").length).toBeGreaterThan(0);
    // Les rappels vers l'ancre ne sont pas listés comme raisons.
    expect(screen.queryByText(/rappel vers l'ancre/)).toBeNull();
    expect(screen.getByText(/« blitz-train » rapporte/)).toBeTruthy();
  });

  it("n'envoie que les paramètres d'ancre modifiés", async () => {
    const calls = mockFetch({
      "GET /admin/pro-league/teams/t1/coach": { coach: coachFixture },
      "GET /admin/pro-league/teams/t1/coach/memory?limit=10": { memory: [] },
      "PATCH /admin/pro-league/teams/t1/coach": {
        coach: { ...coachFixture, anchorProfile: profile({ bashIndex: 80, pace: 70 }), profile: profile({ bashIndex: 80, pace: 70 }) },
      },
    });
    render(<CoachPanel teamId="t1" />);
    await waitFor(() => expect(screen.getByTestId("coach-anchor-pace")).toBeTruthy());
    expect(screen.getByTestId("coach-memory-empty")).toBeTruthy();
    expect((screen.getByTestId("coach-save") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByTestId("coach-anchor-pace"), { target: { value: "70" } });
    expect(screen.getByTestId("coach-dirty").textContent).toMatch(/non enregistrées/);
    fireEvent.click(screen.getByTestId("coach-save"));

    await waitFor(() => expect(calls.some((c) => c.init?.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.init?.method === "PATCH")!;
    expect(JSON.parse(String(patch.init?.body))).toEqual({ profile: { pace: 70 } });
    await waitFor(() => expect(screen.getByTestId("coach-living-pace").textContent).toBe("70"));
  });

  it("réinitialise après confirmation et recharge", async () => {
    const calls = mockFetch({
      "GET /admin/pro-league/teams/t1/coach": { coach: coachFixture },
      "GET /admin/pro-league/teams/t1/coach/memory?limit=10": { memory: [] },
      "POST /admin/pro-league/teams/t1/coach/reset": { coach: { ...coachFixture, experience: 0 } },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CoachPanel teamId="t1" />);
    await waitFor(() => expect(screen.getByTestId("coach-reset")).toBeTruthy());
    fireEvent.click(screen.getByTestId("coach-reset"));
    await waitFor(() => expect(calls.some((c) => c.init?.method === "POST")).toBe(true));
    await waitFor(() => expect(screen.getByText(/Coach réinitialisé/)).toBeTruthy());
    expect(calls.filter((c) => c.url.endsWith("/coach") && (c.init?.method ?? "GET") === "GET")).toHaveLength(2);
  });

  it("affiche l'erreur serveur sans casser la page", async () => {
    mockFetch({ "GET /admin/pro-league/teams/t1/coach": new Error("boom") });
    render(<CoachPanel teamId="t1" />);
    await waitFor(() => expect(screen.getByTestId("coach-error")).toBeTruthy());
    expect(screen.getByTestId("coach-error").textContent).toBe("boom");
  });
});
