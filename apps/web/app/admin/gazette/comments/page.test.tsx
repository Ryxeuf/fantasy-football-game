/**
 * Tests pour la page admin gazette comments.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import AdminGazetteCommentsPage from "./page";

const originalFetch = global.fetch;

const flaggedComment = {
  id: "c1",
  articleId: "a1",
  userId: "u1",
  userName: "Alice",
  userEmail: "a@x.com",
  body: "Bad word",
  createdAt: "2026-05-20T10:00:00.000Z",
  flagged: true,
  deleted: false,
  flagReason: "blocklist:slur-1",
};

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

describe("AdminGazetteCommentsPage", () => {
  it("liste les commentaires flagged par defaut", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comments: [flaggedComment] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminGazetteCommentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("admin-comments-list")).toBeTruthy();
    });
    expect(screen.getByTestId("admin-comment-c1")).toBeTruthy();
    expect(screen.getByTestId("admin-comment-body-c1").textContent).toBe(
      "Bad word",
    );
  });

  it("affiche les actions unflag + delete sur un flagged", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comments: [flaggedComment] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminGazetteCommentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("admin-comment-unflag-c1")).toBeTruthy();
    });
    expect(screen.getByTestId("admin-comment-delete-c1")).toBeTruthy();
  });

  it("affiche restore sur un deleted", async () => {
    const deleted = { ...flaggedComment, flagged: false, deleted: true };
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comments: [deleted] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminGazetteCommentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("admin-comment-restore-c1")).toBeTruthy();
    });
    expect(screen.queryByTestId("admin-comment-delete-c1")).toBeNull();
  });

  it("change de filter et reload", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comments: [flaggedComment] }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comments: [] }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminGazetteCommentsPage />);
    await waitFor(() => screen.getByTestId("admin-comments-list"));

    fireEvent.click(screen.getByTestId("admin-filter-deleted"));

    await waitFor(() => {
      expect(screen.getByTestId("admin-comments-empty")).toBeTruthy();
    });
    expect(fetchMock.mock.calls[1][0]).toMatch(/filter=deleted/);
  });

  it("delete appelle l'endpoint et reload", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comments: [flaggedComment] }),
    } as unknown as Response);
    // POST delete
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comment: { ...flaggedComment, deleted: true } }),
    } as unknown as Response);
    // Reload
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comments: [] }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminGazetteCommentsPage />);
    await waitFor(() => screen.getByTestId("admin-comment-delete-c1"));
    fireEvent.click(screen.getByTestId("admin-comment-delete-c1"));

    await waitFor(() => {
      expect(screen.getByTestId("admin-comments-message")).toBeTruthy();
    });
    expect(fetchMock.mock.calls[1][0]).toMatch(/c1\/delete/);
  });

  it("error si fetch echoue", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminGazetteCommentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("admin-comments-error")).toBeTruthy();
    });
  });
});
