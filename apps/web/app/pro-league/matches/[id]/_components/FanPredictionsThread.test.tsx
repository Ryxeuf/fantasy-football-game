/**
 * Tests pour FanPredictionsThread.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { FanPredictionsThread } from "./FanPredictionsThread";

const originalFetch = global.fetch;

const predictionFixture = {
  id: "p1",
  matchId: "m1",
  userId: "u-other",
  userName: "Alice",
  userEmail: "a@x.com",
  body: "Buf gagne 3-1",
  score: null as null,
  createdAt: "2026-05-21T10:00:00.000Z",
  scoredAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  global.confirm = vi.fn(() => true);
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

function setup(
  user: { id: string } | null,
  predictions: any[],
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ user }),
  } as unknown as Response);
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ predictions }),
  } as unknown as Response);
  return fetchMock;
}

describe("FanPredictionsThread", () => {
  it("affiche la liste des predictions", async () => {
    global.fetch = setup({ id: "u1" }, [
      predictionFixture,
    ]) as unknown as typeof fetch;

    render(<FanPredictionsThread matchId="m1" matchStatus="scheduled" />);

    await waitFor(() => {
      expect(screen.getByTestId("fan-pred-p1")).toBeTruthy();
    });
    expect(screen.getByTestId("fan-pred-body-p1").textContent).toBe(
      "Buf gagne 3-1",
    );
  });

  it("badge ⭐ Seer pour score=perfect", async () => {
    global.fetch = setup({ id: "u1" }, [
      { ...predictionFixture, score: "perfect" },
    ]) as unknown as typeof fetch;

    render(<FanPredictionsThread matchId="m1" matchStatus="completed" />);

    await waitFor(() => {
      expect(screen.getByTestId("fan-pred-badge-p1")).toBeTruthy();
    });
    expect(screen.getByTestId("fan-pred-badge-p1").textContent).toMatch(
      /Seer/,
    );
  });

  it("badge ✓ Winner pour score=winner", async () => {
    global.fetch = setup({ id: "u1" }, [
      { ...predictionFixture, score: "winner" },
    ]) as unknown as typeof fetch;

    render(<FanPredictionsThread matchId="m1" matchStatus="completed" />);

    await waitFor(() => {
      expect(screen.getByTestId("fan-pred-badge-p1")).toBeTruthy();
    });
    expect(screen.getByTestId("fan-pred-badge-p1").textContent).toMatch(
      /Winner/,
    );
  });

  it("badge ✗ Wrong pour score=wrong", async () => {
    global.fetch = setup({ id: "u1" }, [
      { ...predictionFixture, score: "wrong" },
    ]) as unknown as typeof fetch;

    render(<FanPredictionsThread matchId="m1" matchStatus="completed" />);

    await waitFor(() => {
      expect(screen.getByTestId("fan-pred-badge-p1")).toBeTruthy();
    });
    expect(screen.getByTestId("fan-pred-badge-p1").textContent).toMatch(
      /Wrong/,
    );
  });

  it("affiche form pour user auth sur match scheduled", async () => {
    global.fetch = setup({ id: "u1" }, []) as unknown as typeof fetch;

    render(<FanPredictionsThread matchId="m1" matchStatus="scheduled" />);

    await waitFor(() => {
      expect(screen.getByTestId("fan-pred-form")).toBeTruthy();
    });
  });

  it("masque le form si match completed", async () => {
    global.fetch = setup({ id: "u1" }, []) as unknown as typeof fetch;

    render(<FanPredictionsThread matchId="m1" matchStatus="completed" />);

    await waitFor(() => {
      expect(screen.getByTestId("fan-pred-empty")).toBeTruthy();
    });
    expect(screen.queryByTestId("fan-pred-form")).toBeNull();
    expect(screen.getByTestId("fan-pred-closed-note")).toBeTruthy();
  });

  it("masque le form si non authentifie", async () => {
    global.fetch = setup(null, []) as unknown as typeof fetch;

    render(<FanPredictionsThread matchId="m1" matchStatus="scheduled" />);

    await waitFor(() => {
      expect(screen.getByText(/Connectez-vous/)).toBeTruthy();
    });
    expect(screen.queryByTestId("fan-pred-form")).toBeNull();
  });

  it("submit une prediction + reload", async () => {
    const fetchMock = setup({ id: "u1" }, []);
    // POST
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        prediction: predictionFixture,
        isUpdate: false,
      }),
    } as unknown as Response);
    // Reload
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ predictions: [predictionFixture] }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<FanPredictionsThread matchId="m1" matchStatus="scheduled" />);
    await waitFor(() => screen.getByTestId("fan-pred-form"));

    fireEvent.change(screen.getByTestId("fan-pred-input"), {
      target: { value: "Buf 3-1" },
    });
    fireEvent.click(screen.getByTestId("fan-pred-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("fan-pred-p1")).toBeTruthy();
    });
    const submitCall = fetchMock.mock.calls[2];
    expect(JSON.parse(submitCall[1].body as string)).toEqual({
      body: "Buf 3-1",
    });
  });

  it("affiche bouton 'Supprimer la mienne' si mon pred existe", async () => {
    global.fetch = setup({ id: "u-other" }, [
      predictionFixture,
    ]) as unknown as typeof fetch;

    render(<FanPredictionsThread matchId="m1" matchStatus="scheduled" />);

    await waitFor(() => {
      expect(screen.getByTestId("fan-pred-delete-mine")).toBeTruthy();
    });
  });

  it("message empty si 0 predictions", async () => {
    global.fetch = setup({ id: "u1" }, []) as unknown as typeof fetch;

    render(<FanPredictionsThread matchId="m1" matchStatus="completed" />);

    await waitFor(() => {
      expect(screen.getByTestId("fan-pred-empty")).toBeTruthy();
    });
  });
});
