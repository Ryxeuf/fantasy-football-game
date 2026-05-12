/**
 * Tests unitaires du service pro-gazette-comments.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proGazetteArticle: { findUnique: vi.fn() },
    proGazetteComment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  CommentsError,
  MAX_BODY_LENGTH,
  detectBlocklist,
  createComment,
  listComments,
  flagComment,
  unflagComment,
  softDeleteComment,
  restoreComment,
  adminListComments,
} from "./pro-gazette-comments";

const mockedPrisma = prisma as unknown as {
  proGazetteArticle: { findUnique: ReturnType<typeof vi.fn> };
  proGazetteComment: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.resetAllMocks();
});

const userBrief = { name: "Alice", email: "a@x.com" };

function commentRow(over: Partial<any> = {}) {
  return {
    id: over.id ?? "c1",
    articleId: over.articleId ?? "a1",
    userId: over.userId ?? "u1",
    body: over.body ?? "Hello",
    createdAt: over.createdAt ?? new Date("2026-05-20T10:00:00Z"),
    flaggedAt: over.flaggedAt ?? null,
    flagReason: over.flagReason ?? null,
    deletedAt: over.deletedAt ?? null,
    user: over.user ?? userBrief,
  };
}

describe("detectBlocklist", () => {
  it("retourne null pour body propre", () => {
    expect(detectBlocklist("Hello, what a great match!")).toBeNull();
  });
  it("detecte slur classique (variante 1)", () => {
    expect(detectBlocklist("Hey nigger")).toBe("slur-1");
  });
  it("detecte slur avec separator", () => {
    expect(detectBlocklist("you f-a-g-g-o-t")).toBe("slur-2");
  });
  it("case-insensitive", () => {
    expect(detectBlocklist("REGARD: RETARD")).toBe("slur-3");
  });
  it("ne match pas un substring innocent (boundary check)", () => {
    expect(detectBlocklist("regarding")).toBeNull();
    expect(detectBlocklist("retardation event")).toBeNull(); // pas de word boundary suffix
  });
});

describe("createComment", () => {
  it("BODY_EMPTY si vide", async () => {
    await expect(
      createComment({ articleId: "a1", userId: "u1", body: "   " }),
    ).rejects.toMatchObject({ code: "BODY_EMPTY" });
  });

  it("BODY_TOO_LONG si > 500", async () => {
    await expect(
      createComment({
        articleId: "a1",
        userId: "u1",
        body: "a".repeat(MAX_BODY_LENGTH + 1),
      }),
    ).rejects.toMatchObject({ code: "BODY_TOO_LONG" });
  });

  it("ARTICLE_NOT_FOUND si article inexistant", async () => {
    mockedPrisma.proGazetteArticle.findUnique.mockResolvedValueOnce(null);
    await expect(
      createComment({ articleId: "ghost", userId: "u1", body: "ok" }),
    ).rejects.toMatchObject({ code: "ARTICLE_NOT_FOUND" });
  });

  it("cree comment non-flagged si body propre", async () => {
    mockedPrisma.proGazetteArticle.findUnique.mockResolvedValueOnce({
      id: "a1",
    });
    mockedPrisma.proGazetteComment.create.mockResolvedValueOnce(
      commentRow({ body: "Awesome match" }),
    );

    const out = await createComment({
      articleId: "a1",
      userId: "u1",
      body: "Awesome match",
    });

    expect(out.flagged).toBe(false);
    const arg = mockedPrisma.proGazetteComment.create.mock.calls[0][0];
    expect(arg.data.flaggedAt).toBeNull();
    expect(arg.data.flagReason).toBeNull();
  });

  it("auto-flag si body match blocklist", async () => {
    mockedPrisma.proGazetteArticle.findUnique.mockResolvedValueOnce({
      id: "a1",
    });
    mockedPrisma.proGazetteComment.create.mockResolvedValueOnce(
      commentRow({
        body: "nigger",
        flaggedAt: new Date(),
        flagReason: "blocklist:slur-1",
      }),
    );

    const out = await createComment({
      articleId: "a1",
      userId: "u1",
      body: "nigger",
    });

    expect(out.flagged).toBe(true);
    expect(out.flagReason).toBe("blocklist:slur-1");
    const arg = mockedPrisma.proGazetteComment.create.mock.calls[0][0];
    expect(arg.data.flaggedAt).toBeInstanceOf(Date);
    expect(arg.data.flagReason).toMatch(/blocklist:slur-/);
  });

  it("trim le body avant validation", async () => {
    mockedPrisma.proGazetteArticle.findUnique.mockResolvedValueOnce({
      id: "a1",
    });
    mockedPrisma.proGazetteComment.create.mockResolvedValueOnce(
      commentRow({ body: "ok" }),
    );

    await createComment({ articleId: "a1", userId: "u1", body: "   ok   " });
    const arg = mockedPrisma.proGazetteComment.create.mock.calls[0][0];
    expect(arg.data.body).toBe("ok");
  });
});

describe("listComments", () => {
  it("masque les deleted pour non-admin", async () => {
    mockedPrisma.proGazetteComment.findMany.mockResolvedValueOnce([
      commentRow({ id: "c1" }),
      commentRow({ id: "c2", deletedAt: new Date() }),
    ]);
    const out = await listComments("a1", { currentUserId: "u1" });
    expect(out.map((c) => c.id)).toEqual(["c1"]);
  });

  it("affiche les deleted pour admin", async () => {
    mockedPrisma.proGazetteComment.findMany.mockResolvedValueOnce([
      commentRow({ id: "c1" }),
      commentRow({ id: "c2", deletedAt: new Date() }),
    ]);
    const out = await listComments("a1", { isAdmin: true });
    expect(out.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("masque les flagged pour les autres users", async () => {
    mockedPrisma.proGazetteComment.findMany.mockResolvedValueOnce([
      commentRow({
        id: "c1",
        userId: "u-author",
        flaggedAt: new Date(),
        flagReason: "blocklist:slur-1",
      }),
    ]);
    const out = await listComments("a1", { currentUserId: "u-other" });
    expect(out).toEqual([]);
  });

  it("affiche les flagged pour l'auteur", async () => {
    mockedPrisma.proGazetteComment.findMany.mockResolvedValueOnce([
      commentRow({
        id: "c1",
        userId: "u-author",
        flaggedAt: new Date(),
        flagReason: "blocklist:slur-1",
      }),
    ]);
    const out = await listComments("a1", { currentUserId: "u-author" });
    expect(out.map((c) => c.id)).toEqual(["c1"]);
  });

  it("affiche les flagged pour admin", async () => {
    mockedPrisma.proGazetteComment.findMany.mockResolvedValueOnce([
      commentRow({
        id: "c1",
        flaggedAt: new Date(),
        flagReason: "x",
      }),
    ]);
    const out = await listComments("a1", { isAdmin: true });
    expect(out.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("flagComment", () => {
  it("404 si comment introuvable", async () => {
    mockedPrisma.proGazetteComment.findUnique.mockResolvedValueOnce(null);
    await expect(
      flagComment({ commentId: "x", reason: "user:report" }),
    ).rejects.toMatchObject({ code: "COMMENT_NOT_FOUND" });
  });

  it("set flaggedAt + reason", async () => {
    mockedPrisma.proGazetteComment.findUnique.mockResolvedValueOnce({
      id: "c1",
    });
    mockedPrisma.proGazetteComment.update.mockResolvedValueOnce(
      commentRow({
        id: "c1",
        flaggedAt: new Date(),
        flagReason: "admin:spam",
      }),
    );
    const out = await flagComment({ commentId: "c1", reason: "admin:spam" });
    expect(out.flagged).toBe(true);
    expect(out.flagReason).toBe("admin:spam");
  });
});

describe("unflagComment", () => {
  it("404 si comment introuvable", async () => {
    mockedPrisma.proGazetteComment.findUnique.mockResolvedValueOnce(null);
    await expect(unflagComment("x")).rejects.toMatchObject({
      code: "COMMENT_NOT_FOUND",
    });
  });

  it("clear flaggedAt + reason", async () => {
    mockedPrisma.proGazetteComment.findUnique.mockResolvedValueOnce({
      id: "c1",
    });
    mockedPrisma.proGazetteComment.update.mockResolvedValueOnce(
      commentRow({ id: "c1" }),
    );
    const out = await unflagComment("c1");
    expect(out.flagged).toBe(false);
    expect(out.flagReason).toBeNull();
  });
});

describe("softDeleteComment", () => {
  it("404 si comment introuvable", async () => {
    mockedPrisma.proGazetteComment.findUnique.mockResolvedValueOnce(null);
    await expect(
      softDeleteComment({
        commentId: "x",
        byUserId: "u1",
        isAdmin: false,
      }),
    ).rejects.toMatchObject({ code: "COMMENT_NOT_FOUND" });
  });

  it("NOT_OWNER si pas auteur et pas admin", async () => {
    mockedPrisma.proGazetteComment.findUnique.mockResolvedValueOnce({
      id: "c1",
      userId: "u-author",
      deletedAt: null,
    });
    await expect(
      softDeleteComment({
        commentId: "c1",
        byUserId: "u-other",
        isAdmin: false,
      }),
    ).rejects.toMatchObject({ code: "NOT_OWNER" });
  });

  it("ALREADY_DELETED si deja supprime", async () => {
    mockedPrisma.proGazetteComment.findUnique.mockResolvedValueOnce({
      id: "c1",
      userId: "u-author",
      deletedAt: new Date(),
    });
    await expect(
      softDeleteComment({
        commentId: "c1",
        byUserId: "u-author",
        isAdmin: false,
      }),
    ).rejects.toMatchObject({ code: "ALREADY_DELETED" });
  });

  it("auteur peut supprimer son comment", async () => {
    mockedPrisma.proGazetteComment.findUnique.mockResolvedValueOnce({
      id: "c1",
      userId: "u-author",
      deletedAt: null,
    });
    mockedPrisma.proGazetteComment.update.mockResolvedValueOnce(
      commentRow({ id: "c1", userId: "u-author", deletedAt: new Date() }),
    );
    const out = await softDeleteComment({
      commentId: "c1",
      byUserId: "u-author",
      isAdmin: false,
    });
    expect(out.deleted).toBe(true);
  });

  it("admin peut supprimer n'importe quel comment", async () => {
    mockedPrisma.proGazetteComment.findUnique.mockResolvedValueOnce({
      id: "c1",
      userId: "u-author",
      deletedAt: null,
    });
    mockedPrisma.proGazetteComment.update.mockResolvedValueOnce(
      commentRow({ id: "c1", deletedAt: new Date() }),
    );
    const out = await softDeleteComment({
      commentId: "c1",
      byUserId: "u-admin",
      isAdmin: true,
    });
    expect(out.deleted).toBe(true);
  });
});

describe("restoreComment", () => {
  it("clear deletedAt", async () => {
    mockedPrisma.proGazetteComment.findUnique.mockResolvedValueOnce({
      id: "c1",
    });
    mockedPrisma.proGazetteComment.update.mockResolvedValueOnce(
      commentRow({ id: "c1" }),
    );
    const out = await restoreComment("c1");
    expect(out.deleted).toBe(false);
  });
});

describe("adminListComments", () => {
  it("filter=flagged renvoie uniquement les flagged", async () => {
    mockedPrisma.proGazetteComment.findMany.mockResolvedValueOnce([
      commentRow({ id: "c1", flaggedAt: new Date() }),
    ]);
    await adminListComments("flagged", 50);
    const arg = mockedPrisma.proGazetteComment.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ flaggedAt: { not: null } });
  });

  it("filter=deleted renvoie uniquement les deleted", async () => {
    mockedPrisma.proGazetteComment.findMany.mockResolvedValueOnce([]);
    await adminListComments("deleted");
    const arg = mockedPrisma.proGazetteComment.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ deletedAt: { not: null } });
  });

  it("filter=all renvoie tout (where {})", async () => {
    mockedPrisma.proGazetteComment.findMany.mockResolvedValueOnce([]);
    await adminListComments("all");
    const arg = mockedPrisma.proGazetteComment.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({});
  });

  it("cap a 500", async () => {
    mockedPrisma.proGazetteComment.findMany.mockResolvedValueOnce([]);
    await adminListComments("flagged", 99999);
    const arg = mockedPrisma.proGazetteComment.findMany.mock.calls[0][0];
    expect(arg.take).toBe(500);
  });
});
