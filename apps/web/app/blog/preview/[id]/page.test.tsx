/**
 * Tests de l'aperçu admin d'un article (`/blog/preview/[id]`).
 *
 * L'aperçu rend un article — y compris un brouillon non publié — dans le
 * composant partagé `BlogArticle` (rendu final), avec une bannière indiquant
 * le statut. La donnée provient de l'API admin (`getAdminBlogPost`), donc un
 * non-admin reçoit une erreur et ne voit jamais le contenu.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import BlogPreviewPage from "./page";
import { getAdminBlogPost } from "../../../admin/blog/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "post-1" }),
}));

vi.mock("../../../admin/blog/api", () => ({
  getAdminBlogPost: vi.fn(),
}));

const mockGet = vi.mocked(getAdminBlogPost);

const draftPost = {
  id: "post-1",
  slug: "mon-brouillon",
  title: "Mon brouillon secret",
  excerpt: "Un chapeau d’article",
  status: "draft" as const,
  publishedAt: null,
  createdAt: "2026-06-01T10:00:00.000Z",
  updatedAt: "2026-06-02T10:00:00.000Z",
  coverImageUrl: null,
  contentHtml: "<p>Contenu du brouillon</p>",
  authorId: "u-1",
  author: { id: "u-1", coachName: "Coach Nuffle" },
};

describe("BlogPreviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rend le contenu d’un brouillon avec la bannière « Brouillon — non publié »", async () => {
    mockGet.mockResolvedValue(draftPost);
    render(<BlogPreviewPage />);

    await waitFor(() =>
      expect(screen.getByText("Mon brouillon secret")).toBeTruthy(),
    );
    expect(screen.getByText("Contenu du brouillon")).toBeTruthy();
    expect(screen.getByText("Brouillon — non publié")).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith("post-1");
  });

  it("rend la pastille « Publié » et le lien vers la page publique pour un article publié", async () => {
    mockGet.mockResolvedValue({
      ...draftPost,
      status: "published",
      publishedAt: "2026-06-03T10:00:00.000Z",
    });
    render(<BlogPreviewPage />);

    await waitFor(() => expect(screen.getByText("Publié")).toBeTruthy());
    const publicLink = screen.getByText("Voir la page publique");
    expect(publicLink.getAttribute("href")).toBe("/blog/mon-brouillon");
  });

  it("affiche un message d’erreur si l’API refuse (non-admin)", async () => {
    mockGet.mockRejectedValue(new Error("Accès refusé"));
    render(<BlogPreviewPage />);

    await waitFor(() =>
      expect(screen.getByText("Accès refusé")).toBeTruthy(),
    );
    expect(screen.queryByText("Mon brouillon secret")).toBeNull();
  });
});
