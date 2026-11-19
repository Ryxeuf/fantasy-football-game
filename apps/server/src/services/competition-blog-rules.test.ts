import { describe, expect, it } from "vitest";
import {
  blogPermissions,
  canDeleteComment,
  canDeletePost,
  canEditComment,
  canEditPost,
  canSeeComment,
  canSeePost,
  comparePosts,
  excerptFromHtml,
  isPostOpenForInteraction,
  isReactionKind,
  summarizeReactions,
  type BlogViewerContext,
} from "./competition-blog-rules";

const base: BlogViewerContext = {
  userId: "u1",
  isAdmin: false,
  isCommissioner: false,
  participant: null,
  archived: false,
};

describe("blogPermissions", () => {
  it.each<[string, Partial<BlogViewerContext>, boolean, boolean, boolean]>([
    // label, contexte, isMember, canWrite, canModerate
    ["commissaire sans équipe", { isCommissioner: true }, true, true, true],
    ["équipe active", { participant: "active" }, true, true, false],
    ["équipe retirée", { participant: "withdrawn" }, false, false, false],
    ["ancienne saison", { participant: "former" }, false, false, false],
    ["lecteur sans lien", {}, false, false, false],
    ["anonyme", { userId: null }, false, false, false],
    ["anonyme « actif » (impossible)", { userId: null, participant: "active" }, false, false, false],
    ["admin non membre", { isAdmin: true }, false, true, true],
    ["membre, compétition archivée", { participant: "active", archived: true }, true, false, false],
    ["commissaire, archivée", { isCommissioner: true, archived: true }, true, false, true],
    ["admin, archivée", { isAdmin: true, archived: true }, false, false, true],
  ])("%s", (_label, over, isMember, canWrite, canModerate) => {
    const perms = blogPermissions({ ...base, ...over });
    expect(perms.isMember).toBe(isMember);
    expect(perms.canWrite).toBe(canWrite);
    expect(perms.canReact).toBe(canWrite);
    expect(perms.canComment).toBe(canWrite);
    expect(perms.canModerate).toBe(canModerate);
  });
});

const published = { authorId: "a", status: "published", hiddenAt: null, deletedAt: null };
const draft = { ...published, status: "draft" };
const hidden = { ...published, hiddenAt: new Date() };
const deleted = { ...published, deletedAt: new Date() };
const reader = { canModerate: false };
const mod = { canModerate: true };

describe("canSeePost", () => {
  it("publié : tout le monde, anonyme compris", () => {
    expect(canSeePost(published, null, reader)).toBe(true);
  });
  it("brouillon : l'auteur seul, pas même le modérateur", () => {
    expect(canSeePost(draft, "a", reader)).toBe(true);
    expect(canSeePost(draft, "b", mod)).toBe(false);
  });
  it("masqué : auteur et modérateurs", () => {
    expect(canSeePost(hidden, "a", reader)).toBe(true);
    expect(canSeePost(hidden, "b", mod)).toBe(true);
    expect(canSeePost(hidden, "b", reader)).toBe(false);
  });
  it("supprimé : personne", () => {
    expect(canSeePost(deleted, "a", mod)).toBe(false);
  });
  it("auteur supprimé : publié reste lisible, brouillon invisible", () => {
    expect(canSeePost({ ...published, authorId: null }, null, reader)).toBe(true);
    expect(canSeePost({ ...draft, authorId: null }, null, reader)).toBe(false);
  });
});

describe("interactions", () => {
  it("seul un article publié, visible et présent s'ouvre aux réactions", () => {
    expect(isPostOpenForInteraction(published)).toBe(true);
    expect(isPostOpenForInteraction(draft)).toBe(false);
    expect(isPostOpenForInteraction(hidden)).toBe(false);
    expect(isPostOpenForInteraction(deleted)).toBe(false);
  });
});

describe("droits d'édition et de suppression", () => {
  it("l'auteur édite tant qu'il peut écrire", () => {
    expect(canEditPost(published, "a", { canWrite: true })).toBe(true);
    expect(canEditPost(published, "a", { canWrite: false })).toBe(false);
    expect(canEditPost(published, "b", { canWrite: true })).toBe(false);
  });
  it("l'auteur supprime toujours ; un modérateur aussi", () => {
    expect(canDeletePost(published, "a", reader)).toBe(true);
    expect(canDeletePost(published, "b", mod)).toBe(true);
    expect(canDeletePost(published, "b", reader)).toBe(false);
    expect(canDeletePost(deleted, "a", mod)).toBe(false);
  });
  it("commentaires : même partage", () => {
    const c = { authorId: "a", hiddenAt: null, deletedAt: null };
    expect(canEditComment(c, "a", { canComment: true })).toBe(true);
    expect(canEditComment(c, "a", { canComment: false })).toBe(false);
    expect(canDeleteComment(c, "a", reader)).toBe(true);
    expect(canDeleteComment(c, "b", mod)).toBe(true);
    expect(canDeleteComment(c, "b", reader)).toBe(false);
  });
  it("commentaire masqué : auteur et modérateurs", () => {
    const c = { authorId: "a", hiddenAt: new Date(), deletedAt: null };
    expect(canSeeComment(c, "a", reader)).toBe(true);
    expect(canSeeComment(c, "b", mod)).toBe(true);
    expect(canSeeComment(c, "b", reader)).toBe(false);
    expect(canSeeComment({ ...c, deletedAt: new Date() }, "a", mod)).toBe(false);
  });
});

describe("comparePosts", () => {
  const d = (s: string) => new Date(s);
  it("épinglés d'abord, puis publication décroissante", () => {
    const rows = [
      { id: "old", pinnedAt: null, publishedAt: d("2026-01-01") },
      { id: "new", pinnedAt: null, publishedAt: d("2026-03-01") },
      { id: "pinned", pinnedAt: d("2026-02-01"), publishedAt: d("2025-01-01") },
      { id: "pinned-later", pinnedAt: d("2026-04-01"), publishedAt: d("2025-01-01") },
    ];
    expect([...rows].sort(comparePosts).map((r) => r.id)).toEqual([
      "pinned-later",
      "pinned",
      "new",
      "old",
    ]);
  });
});

describe("excerptFromHtml", () => {
  it("retire les balises et décode les entités courantes", () => {
    expect(excerptFromHtml("<h2>Titre</h2><p>Les &amp; orques <strong>gagnent</strong></p>")).toBe(
      "Titre Les & orques gagnent",
    );
  });
  it("tronque avec une ellipse", () => {
    const out = excerptFromHtml(`<p>${"a".repeat(400)}</p>`, 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("réactions", () => {
  it("catalogue fixe", () => {
    expect(isReactionKind("fire")).toBe(true);
    expect(isReactionKind("poop")).toBe(false);
    expect(isReactionKind(3)).toBe(false);
  });
  it("résumé : comptes complets, types inconnus ignorés, ordre du catalogue", () => {
    const s = summarizeReactions(
      [
        { kind: "fire", count: 2 },
        { kind: "skull", count: 1 },
        { kind: "poop", count: 9 },
      ],
      ["skull", "fire"],
    );
    expect(s.counts).toEqual({ like: 0, love: 0, laugh: 0, wow: 0, fire: 2, skull: 1 });
    expect(s.mine).toEqual(["fire", "skull"]);
  });
});
