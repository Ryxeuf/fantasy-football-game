import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getBlogPost = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useFeatureFlag", () => ({ useFeatureFlagOrOff: () => true }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("../../lib/competition-blog", async (orig) => ({
  ...(await orig<typeof import("../../lib/competition-blog")>()),
  getBlogPost,
  listBlogComments: vi.fn(async () => ({ comments: [], total: 0, page: 1, limit: 50 })),
}));

import { ApiClientError } from "../../lib/api-client";
import CompetitionPostView from "./CompetitionPostView";
import { makePost, MEMBER_VIEWER, READER_VIEWER } from "./fixtures.test-utils";

const CUP = { kind: "cup" as const, id: "c1" };

beforeEach(() => {
  getBlogPost.mockReset();
});

describe("CompetitionPostView", () => {
  it("lecteur : article, réactions, commentaires, aucune action", async () => {
    getBlogPost.mockResolvedValue({ post: makePost(), viewer: READER_VIEWER });
    render(<CompetitionPostView competition={CUP} postId="p1" />);
    expect(await screen.findByRole("heading", { name: "Compte rendu" })).toBeTruthy();
    expect(screen.getByText(/Grombrindal · 12 mars 2027 · Saison 2/)).toBeTruthy();
    expect(screen.queryByTestId("post-moderation-menu")).toBeNull();
    expect(screen.getByTestId("post-comments")).toBeTruthy();
  });

  it("commissaire : épingler et masquer", async () => {
    getBlogPost.mockResolvedValue({
      post: makePost(),
      viewer: { ...MEMBER_VIEWER, canModerate: true },
    });
    render(<CompetitionPostView competition={CUP} postId="p1" />);
    await screen.findByTestId("post-moderation-menu");
    expect(screen.getByText("📌 Épingler")).toBeTruthy();
    expect(screen.getByText("🚫 Masquer")).toBeTruthy();
    expect(screen.queryByText("✏️ Modifier")).toBeNull();
  });

  it("auteur d'un article masqué : bandeau avec la raison, pas d'interactions", async () => {
    getBlogPost.mockResolvedValue({
      post: makePost({
        hidden: { reason: "hors sujet", at: "" },
        viewer: { canEdit: true, canDelete: true },
      }),
      viewer: MEMBER_VIEWER,
    });
    render(<CompetitionPostView competition={CUP} postId="p1" />);
    expect((await screen.findByTestId("post-hidden-banner")).textContent).toContain("hors sujet");
    expect((screen.getByText("✏️ Modifier").closest("a"))?.getAttribute("href")).toBe("/cups/c1/blog/p1/edit");
    expect(screen.queryByTestId("post-comments")).toBeNull();
  });

  it("404 : article introuvable", async () => {
    getBlogPost.mockRejectedValue(new ApiClientError("Article introuvable", 404));
    render(<CompetitionPostView competition={CUP} postId="nope" />);
    expect(await screen.findByText("Article introuvable.")).toBeTruthy();
  });
});
