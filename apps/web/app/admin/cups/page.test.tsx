/**
 * Console admin des coupes — liste `GET /admin/cups`, filtres serveur,
 * bascule de visibilité et suppression.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, prefetch: vi.fn() }),
}));

import AdminCupsPage from "./page";

const CUP = {
  id: "c1",
  name: "Coupe du Chaos",
  description: null,
  ruleset: "season_3",
  format: "bb11",
  status: "ouverte",
  validated: false,
  isPublic: true,
  creatorId: "u1",
  creator: { id: "u1", coachName: "Coach", email: "coach@x.io" },
  participantCount: 4,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
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
      return Promise.resolve(jsonOk({ success: true, data: {} }));
    }
    return Promise.resolve(
      jsonOk({
        success: true,
        data: {
          cups: [CUP],
          counts: {
            total: 3,
            status: { ouverte: 2, archivee: 1 },
            public: 2,
            private: 1,
          },
        },
        meta: { total: 1, limit: 100, page: 0 },
      }),
    );
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

describe("Console admin — coupes", () => {
  it("affiche les coupes (tableau et cartes) et les compteurs", async () => {
    routeFetch();
    render(<AdminCupsPage />);
    expect(await screen.findByTestId("admin-cup-row-c1")).toBeTruthy();
    expect(screen.getByTestId("admin-cup-card-c1").textContent).toContain(
      "coach@x.io",
    );
    expect(screen.getByText("Privées").parentElement?.textContent).toContain(
      "1",
    );
  });

  it("passe les filtres de statut et de visibilité au serveur", async () => {
    routeFetch();
    render(<AdminCupsPage />);
    fireEvent.change(await screen.findByTestId("admin-cups-status-filter"), {
      target: { value: "en_cours" },
    });
    fireEvent.change(screen.getByTestId("admin-cups-visibility-filter"), {
      target: { value: "private" },
    });
    await waitFor(() => {
      expect(
        mockFetch.mock.calls.some((c) => {
          const u = String(c[0]);
          return (
            u.includes("/admin/cups?") &&
            u.includes("status=en_cours") &&
            u.includes("visibility=private")
          );
        }),
      ).toBe(true);
    });
  });

  it("bascule la visibilité via PATCH /cup/:id", async () => {
    routeFetch();
    render(<AdminCupsPage />);
    fireEvent.click(await screen.findByTestId("admin-cup-visibility-c1"));
    await waitFor(() => {
      const call = writes()[0];
      expect(String(call?.[0])).toMatch(/\/cup\/c1$/);
      expect(call?.[1]?.method).toBe("PATCH");
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ isPublic: false });
    });
  });

  it("supprime une coupe après confirmation", async () => {
    routeFetch();
    window.confirm = vi.fn(() => true);
    render(<AdminCupsPage />);
    fireEvent.click((await screen.findAllByTestId("admin-cup-delete-c1"))[0]);
    await waitFor(() => {
      const call = writes().find((c) => c[1]?.method === "DELETE");
      expect(String(call?.[0])).toMatch(/\/cup\/c1$/);
    });
  });

  it("n'écrit rien si la suppression est annulée", async () => {
    routeFetch();
    window.confirm = vi.fn(() => false);
    render(<AdminCupsPage />);
    fireEvent.click((await screen.findAllByTestId("admin-cup-delete-c1"))[0]);
    expect(writes()).toHaveLength(0);
  });
});
