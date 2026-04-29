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
}));

import { findUserByCoachName } from "../services/user-lookup";
import { resolveReceiverIdFromBody } from "./friends";

const mockedLookup = vi.mocked(findUserByCoachName);

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
