import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listBlogPosts = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useFeatureFlag", () => ({ useFeatureFlagOrOff: () => true }));
vi.mock("../../lib/competition-blog", async (orig) => ({
  ...(await orig<typeof import("../../lib/competition-blog")>()),
  listBlogPosts,
}));

import CompetitionBlogPage from "./CompetitionBlogPage";
import { makePost, MEMBER_VIEWER, READER_VIEWER } from "./fixtures.test-utils";

const LEAGUE = { kind: "league" as const, id: "l1" };
const list = (over = {}) => ({ pinned: [], posts: [], total: 0, page: 1, limit: 10, viewer: MEMBER_VIEWER, ...over });

beforeEach(() => {
  listBlogPosts.mockReset();
});

describe("CompetitionBlogPage", () => {
  it("un membre bascule sur ses brouillons", async () => {
    listBlogPosts.mockResolvedValue(list({ posts: [makePost()], total: 1 }));
    render(<CompetitionBlogPage competition={LEAGUE} />);
    await screen.findByTestId("blog-post-card");
    fireEvent.click(screen.getByRole("tab", { name: "Mes brouillons" }));
    await waitFor(() =>
      expect(listBlogPosts).toHaveBeenLastCalledWith(LEAGUE, { page: 1, limit: 10, drafts: true }),
    );
  });

  it("un lecteur n'a ni onglets ni bouton d'écriture", async () => {
    listBlogPosts.mockResolvedValue(list({ viewer: READER_VIEWER }));
    render(<CompetitionBlogPage competition={LEAGUE} />);
    await screen.findByTestId("blog-empty");
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByTestId("blog-write-button")).toBeNull();
  });

  it("pagination", async () => {
    listBlogPosts.mockResolvedValue(list({ posts: [makePost()], total: 25 }));
    render(<CompetitionBlogPage competition={LEAGUE} />);
    await screen.findByText("1 / 3");
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    await waitFor(() =>
      expect(listBlogPosts).toHaveBeenLastCalledWith(LEAGUE, { page: 2, limit: 10, drafts: false }),
    );
  });
});
