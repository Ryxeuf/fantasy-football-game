/**
 * Console admin — fiche d'une coupe : patch minimal, visibilité, statut.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ id: "c1" }),
}));

import AdminCupManagePage from "./page";
import { buildCupPatch, toCupForm, type AdminCupDetail } from "./cup-form";

const CUP: AdminCupDetail = {
  id: "c1",
  name: "Coupe du Chaos",
  description: "Desc",
  creator: { id: "u1", coachName: "Coach" },
  ruleset: "season_3",
  format: "bb11",
  validated: true,
  isPublic: false,
  status: "en_cours",
  participantCount: 1,
  participants: [
    {
      id: "t1",
      name: "Les Rats",
      roster: "skaven",
      owner: { id: "u2", coachName: "Ratman" },
    },
  ],
  scoringConfig: {
    winPoints: 1000,
    drawPoints: 400,
    lossPoints: 0,
    forfeitPoints: -100,
    touchdownPoints: 5,
    blockCasualtyPoints: 3,
    foulCasualtyPoints: 2,
    passPoints: 2,
  },
  playoffSize: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn(() => "token"),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  },
});

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

function routeFetch() {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/auth/me")) {
      return Promise.resolve(
        jsonOk({ user: { id: "admin-1", roles: ["admin"] } }),
      );
    }
    if (init?.method && init.method !== "GET") {
      return Promise.resolve(jsonOk({ cup: {} }));
    }
    return Promise.resolve(jsonOk({ cup: CUP }));
  });
}

function writes() {
  return mockFetch.mock.calls.filter(
    (c) => c[1]?.method && c[1].method !== "GET",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildCupPatch", () => {
  it("ne renvoie que les champs modifiés", () => {
    const form = toCupForm(CUP);
    expect(buildCupPatch(CUP, form)).toEqual({ patch: {}, error: null });
    expect(
      buildCupPatch(CUP, {
        ...form,
        playoffSize: 4,
        scoring: { ...form.scoring, passPoints: "3" },
      }).patch,
    ).toEqual({ playoffSize: 4, passPoints: 3 });
  });

  it("refuse un nom vide ou un point non entier", () => {
    const form = toCupForm(CUP);
    expect(buildCupPatch(CUP, { ...form, name: "" }).error).toBeTruthy();
    expect(
      buildCupPatch(CUP, {
        ...form,
        scoring: { ...form.scoring, winPoints: "1.5" },
      }).error,
    ).toBeTruthy();
  });
});

describe("Fiche admin d'une coupe", () => {
  it("enregistre uniquement le barème modifié", async () => {
    routeFetch();
    render(<AdminCupManagePage />);
    fireEvent.change(await screen.findByTestId("admin-cup-scoring-winPoints"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByTestId("admin-cup-save"));
    await waitFor(() => {
      const call = writes()[0];
      expect(String(call?.[0])).toMatch(/\/cup\/c1$/);
      expect(call?.[1]?.method).toBe("PATCH");
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ winPoints: 3 });
    });
  });

  it("rend une coupe privée publique", async () => {
    routeFetch();
    render(<AdminCupManagePage />);
    const toggle = await screen.findByTestId("admin-cup-visibility");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(JSON.parse(String(writes()[0]?.[1]?.body))).toEqual({
        isPublic: true,
      });
    });
  });

  it("force le statut via POST /cup/:id/status", async () => {
    routeFetch();
    render(<AdminCupManagePage />);
    fireEvent.change(await screen.findByTestId("admin-cup-status"), {
      target: { value: "terminee" },
    });
    await waitFor(() => {
      const call = writes()[0];
      expect(String(call?.[0])).toContain("/cup/c1/status");
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        status: "terminee",
      });
    });
  });
});
