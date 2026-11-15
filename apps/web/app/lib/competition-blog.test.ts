import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("./api-client", () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));

import {
  authorLabel,
  blogApiBase,
  blogPagePath,
  blogPostPagePath,
  competitionPagePath,
  hiddenReasonLabel,
  listBlogPosts,
  toggleReaction,
  uploadBlogImage,
} from "./competition-blog";

const LEAGUE = { kind: "league" as const, id: "l1" };
const CUP = { kind: "cup" as const, id: "c1" };

beforeEach(() => {
  apiRequest.mockReset();
});

describe("chemins", () => {
  it("API et pages dérivées de la famille", () => {
    expect(blogApiBase(LEAGUE)).toBe("/api/competitions/leagues/l1/blog");
    expect(blogApiBase(CUP)).toBe("/api/competitions/cups/c1/blog");
    expect(blogPagePath(CUP, "/new")).toBe("/cups/c1/blog/new");
    expect(blogPostPagePath(LEAGUE, "p1")).toBe("/leagues/l1/blog/p1");
    expect(competitionPagePath(CUP)).toBe("/cups/c1");
  });
});

describe("appels", () => {
  it("liste : brouillons et pagination en query", async () => {
    apiRequest.mockResolvedValue({});
    await listBlogPosts(LEAGUE, { page: 2, limit: 10, drafts: true });
    expect(apiRequest).toHaveBeenCalledWith("/api/competitions/leagues/l1/blog/posts?page=2&limit=10&drafts=mine");
  });

  it("réaction : PUT pour poser, DELETE pour retirer", async () => {
    apiRequest.mockResolvedValue({ reactions: {} });
    await toggleReaction(CUP, "p1", "fire", true);
    await toggleReaction(CUP, "p1", "fire", false);
    expect(apiRequest.mock.calls.map((c) => (c[1] as RequestInit).method)).toEqual(["PUT", "DELETE"]);
  });

  it("image : refusée avant l'envoi si trop lourde", async () => {
    const big = new File([new Uint8Array(3 * 1024 * 1024 + 1)], "x.png", { type: "image/png" });
    await expect(uploadBlogImage(LEAGUE, big)).rejects.toThrow(/3 Mo/);
    expect(apiRequest).not.toHaveBeenCalled();
  });
});

describe("libellés", () => {
  it("auteur supprimé", () => {
    expect(authorLabel(null)).toBe("Coach supprimé");
  });
  it("raison de masquage", () => {
    expect(hiddenReasonLabel({ reason: "blocklist:slur-1", at: "" })).toMatch(/automatiquement/);
    expect(hiddenReasonLabel({ reason: "hors sujet", at: "" })).toBe("Masqué par la modération : hors sujet");
    expect(hiddenReasonLabel({ reason: null, at: "" })).toBe("Masqué par la modération");
  });
});
