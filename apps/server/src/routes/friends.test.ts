/**
 * Tests pour `resolveReceiverIdFromBody` (S26.4b).
 *
 * Le helper est extrait de la route `POST /friends` pour permettre
 * un test unitaire sans monter Express. Il accepte un body
 * `{ receiverId?: string, username?: string }` (un seul exclusif —
 * garantie cote schema Zod) et retourne le userId resolu.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/user-lookup", () => ({
  findUserByCoachName: vi.fn(),
  searchUsersByCoachName: vi.fn(),
}));

vi.mock("../services/friend-suggestions", () => ({
  suggestFriendsByElo: vi.fn(),
}));

import {
  findUserByCoachName,
  searchUsersByCoachName,
} from "../services/user-lookup";
import { suggestFriendsByElo } from "../services/friend-suggestions";
import {
  handleFriendSuggestions,
  handleSearchUsers,
  resolveReceiverIdFromBody,
} from "./friends";
import type { AuthenticatedRequest } from "../middleware/authUser";
import type { Response } from "express";

const mockedLookup = vi.mocked(findUserByCoachName);
const mockedSearch = vi.mocked(searchUsersByCoachName);
const mockedSuggest = vi.mocked(suggestFriendsByElo);

function buildRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("resolveReceiverIdFromBody (S26.4b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns receiverId directly when provided (no DB call)", async () => {
    const id = await resolveReceiverIdFromBody({ receiverId: "u-1" });
    expect(id).toBe("u-1");
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it("looks up the user via findUserByCoachName when only username is provided", async () => {
    mockedLookup.mockResolvedValue({ id: "u-42", coachName: "Alice" });
    const id = await resolveReceiverIdFromBody({ username: "@alice" });
    expect(mockedLookup).toHaveBeenCalledWith("@alice");
    expect(id).toBe("u-42");
  });

  it("throws a 'introuvable' error (404-mapped) when the username does not exist", async () => {
    mockedLookup.mockResolvedValue(null);
    await expect(
      resolveReceiverIdFromBody({ username: "@ghost" }),
    ).rejects.toThrow(/introuvable/i);
  });

  it("prefers receiverId when both are provided (defensive — schema rejects this in practice)", async () => {
    const id = await resolveReceiverIdFromBody({
      receiverId: "u-1",
      username: "@alice",
    });
    expect(id).toBe("u-1");
    expect(mockedLookup).not.toHaveBeenCalled();
  });
});

describe("handleSearchUsers (S26.4c)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 + ApiResponse with the search results", async () => {
    mockedSearch.mockResolvedValue([
      { id: "u-1", coachName: "Alice" },
      { id: "u-2", coachName: "Aline" },
    ]);

    const req = {
      query: { q: "ali" },
      user: { id: "caller" },
    } as unknown as AuthenticatedRequest;
    const res = buildRes();
    await handleSearchUsers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        results: [
          { id: "u-1", coachName: "Alice" },
          { id: "u-2", coachName: "Aline" },
        ],
      },
    });
    expect(mockedSearch).toHaveBeenCalledWith("ali", undefined);
  });

  it("forwards the parsed limit query param when provided", async () => {
    mockedSearch.mockResolvedValue([]);
    const req = {
      query: { q: "ali", limit: "5" },
      user: { id: "caller" },
    } as unknown as AuthenticatedRequest;
    const res = buildRes();
    await handleSearchUsers(req, res);
    expect(mockedSearch).toHaveBeenCalledWith("ali", 5);
  });

  it("returns 200 with empty results when q is empty (delegated to service)", async () => {
    mockedSearch.mockResolvedValue([]);
    const req = {
      query: {},
      user: { id: "caller" },
    } as unknown as AuthenticatedRequest;
    const res = buildRes();
    await handleSearchUsers(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: { results: [] } });
  });

  it("returns 500 when the service throws", async () => {
    mockedSearch.mockRejectedValue(new Error("DB down"));
    const req = {
      query: { q: "ali" },
      user: { id: "caller" },
    } as unknown as AuthenticatedRequest;
    const res = buildRes();
    await handleSearchUsers(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});

describe("handleFriendSuggestions (S26.5a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 + ApiResponse with the suggestions list", async () => {
    mockedSuggest.mockResolvedValue([
      { id: "u-1", coachName: "Alice", eloRating: 1205, eloDelta: 5 },
    ]);
    const req = {
      query: {},
      user: { id: "u-self" },
    } as unknown as AuthenticatedRequest;
    const res = buildRes();
    await handleFriendSuggestions(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        suggestions: [
          { id: "u-1", coachName: "Alice", eloRating: 1205, eloDelta: 5 },
        ],
      },
    });
    expect(mockedSuggest).toHaveBeenCalledWith("u-self", undefined, undefined);
  });

  it("forwards the parsed range and limit query params", async () => {
    mockedSuggest.mockResolvedValue([]);
    const req = {
      query: { range: "150", limit: "20" },
      user: { id: "u-self" },
    } as unknown as AuthenticatedRequest;
    const res = buildRes();
    await handleFriendSuggestions(req, res);
    expect(mockedSuggest).toHaveBeenCalledWith("u-self", 150, 20);
  });

  it("clamps a negative range to 0", async () => {
    mockedSuggest.mockResolvedValue([]);
    const req = {
      query: { range: "-50" },
      user: { id: "u-self" },
    } as unknown as AuthenticatedRequest;
    const res = buildRes();
    await handleFriendSuggestions(req, res);
    expect(mockedSuggest).toHaveBeenCalledWith("u-self", 0, undefined);
  });

  it("returns 500 when the service throws", async () => {
    mockedSuggest.mockRejectedValue(new Error("DB down"));
    const req = {
      query: {},
      user: { id: "u-self" },
    } as unknown as AuthenticatedRequest;
    const res = buildRes();
    await handleFriendSuggestions(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});
