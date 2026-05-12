/**
 * Tests pour GazetteCommentsThread.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { GazetteCommentsThread } from "./GazetteCommentsThread";

const originalFetch = global.fetch;

const commentFixture = {
  id: "c1",
  articleId: "a1",
  userId: "u-author",
  userName: "Alice",
  userEmail: "a@x.com",
  body: "Awesome match!",
  createdAt: "2026-05-20T10:00:00.000Z",
  flagged: false,
  deleted: false,
  flagReason: null,
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

/** Helper: setup mock for /auth/me + GET comments. */
function setupAuthAndComments(
  user: { id: string } | null,
  comments: any[],
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  // 1) /auth/me
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ user }),
  } as unknown as Response);
  // 2) GET comments
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ comments }),
  } as unknown as Response);
  return fetchMock;
}

describe("GazetteCommentsThread", () => {
  it("affiche la liste des commentaires", async () => {
    global.fetch = setupAuthAndComments({ id: "u-other" }, [
      commentFixture,
    ]) as unknown as typeof fetch;

    render(<GazetteCommentsThread articleId="a1" />);

    await waitFor(() => {
      expect(screen.getByTestId("comment-c1")).toBeTruthy();
    });
    expect(screen.getByTestId("comment-body-c1").textContent).toBe(
      "Awesome match!",
    );
  });

  it("affiche message empty si 0 comments", async () => {
    global.fetch = setupAuthAndComments(
      { id: "u-other" },
      [],
    ) as unknown as typeof fetch;

    render(<GazetteCommentsThread articleId="a1" />);

    await waitFor(() => {
      expect(screen.getByTestId("comments-empty-a1")).toBeTruthy();
    });
  });

  it("affiche bouton supprimer pour son propre commentaire", async () => {
    global.fetch = setupAuthAndComments({ id: "u-author" }, [
      commentFixture,
    ]) as unknown as typeof fetch;

    render(<GazetteCommentsThread articleId="a1" />);

    await waitFor(() => {
      expect(screen.getByTestId("comment-delete-c1")).toBeTruthy();
    });
    expect(screen.queryByTestId("comment-flag-c1")).toBeNull();
  });

  it("affiche bouton reporter pour les autres commentaires", async () => {
    global.fetch = setupAuthAndComments({ id: "u-other" }, [
      commentFixture,
    ]) as unknown as typeof fetch;

    render(<GazetteCommentsThread articleId="a1" />);

    await waitFor(() => {
      expect(screen.getByTestId("comment-flag-c1")).toBeTruthy();
    });
    expect(screen.queryByTestId("comment-delete-c1")).toBeNull();
  });

  it("masque le form si non authentifie", async () => {
    global.fetch = setupAuthAndComments(
      null,
      [],
    ) as unknown as typeof fetch;

    render(<GazetteCommentsThread articleId="a1" />);

    await waitFor(() => {
      expect(screen.getByTestId("comments-empty-a1")).toBeTruthy();
    });
    expect(screen.queryByTestId("comments-form-a1")).toBeNull();
    expect(screen.getByText(/Connectez-vous/)).toBeTruthy();
  });

  it("submit un commentaire + reload", async () => {
    const fetchMock = setupAuthAndComments({ id: "u-other" }, []);
    // POST submit
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comment: commentFixture }),
    } as unknown as Response);
    // GET reload
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comments: [commentFixture] }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<GazetteCommentsThread articleId="a1" />);
    await waitFor(() => screen.getByTestId("comments-form-a1"));

    fireEvent.change(screen.getByTestId("comments-input-a1"), {
      target: { value: "Great match" },
    });
    fireEvent.click(screen.getByTestId("comments-submit-a1"));

    await waitFor(() => {
      expect(screen.getByTestId("comment-c1")).toBeTruthy();
    });
    const submitCall = fetchMock.mock.calls[2];
    expect(JSON.parse(submitCall[1].body as string)).toEqual({
      body: "Great match",
    });
  });

  it("affiche un commentaire flagged avec badge si vu par l'auteur", async () => {
    const flaggedComment = {
      ...commentFixture,
      flagged: true,
      flagReason: "blocklist:slur-1",
    };
    global.fetch = setupAuthAndComments({ id: "u-author" }, [
      flaggedComment,
    ]) as unknown as typeof fetch;

    render(<GazetteCommentsThread articleId="a1" />);

    await waitFor(() => {
      expect(screen.getByTestId("comment-c1")).toBeTruthy();
    });
    expect(screen.getByTestId("comment-c1").textContent).toMatch(/flagged/);
  });
});
