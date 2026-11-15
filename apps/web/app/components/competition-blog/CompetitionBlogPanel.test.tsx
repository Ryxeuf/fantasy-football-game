import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ on: true }));
const listBlogPosts = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useFeatureFlag", () => ({ useFeatureFlagOrOff: () => flag.on }));
vi.mock("../../lib/competition-blog", async (orig) => ({
  ...(await orig<typeof import("../../lib/competition-blog")>()),
  listBlogPosts,
}));

import CompetitionBlogPanel from "./CompetitionBlogPanel";
import { makePost, MEMBER_VIEWER, READER_VIEWER } from "./fixtures.test-utils";

const LEAGUE = { kind: "league" as const, id: "l1" };

beforeEach(() => {
  flag.on = true;
  listBlogPosts.mockReset();
});

describe("CompetitionBlogPanel", () => {
  it("flag éteint : aucun bloc, aucune requête", () => {
    flag.on = false;
    const { container } = render(<CompetitionBlogPanel competition={LEAGUE} />);
    expect(container.innerHTML).toBe("");
    expect(listBlogPosts).not.toHaveBeenCalled();
  });

  it("trois derniers articles, épinglés d'abord, lien vers le blog", async () => {
    listBlogPosts.mockResolvedValue({
      pinned: [makePost({ id: "pin", title: "Règlement", pinned: true })],
      posts: [makePost({ id: "a", title: "A" }), makePost({ id: "b", title: "B" }), makePost({ id: "c", title: "C" })],
      total: 3,
      page: 1,
      limit: 3,
      viewer: MEMBER_VIEWER,
    });
    render(<CompetitionBlogPanel competition={LEAGUE} />);
    const cards = await screen.findAllByTestId("blog-post-card");
    expect(cards.map((c) => c.querySelector("h3")?.textContent)).toEqual(["Règlement", "A", "B"]);
    expect((screen.getByText("Tout le blog").closest("a"))?.getAttribute("href")).toBe("/leagues/l1/blog");
    expect((screen.getByTestId("blog-write-button"))?.getAttribute("href")).toBe("/leagues/l1/blog/new");
  });

  it("lecteur : pas de bouton d'écriture", async () => {
    listBlogPosts.mockResolvedValue({ pinned: [], posts: [], total: 0, page: 1, limit: 3, viewer: READER_VIEWER });
    render(<CompetitionBlogPanel competition={LEAGUE} />);
    await screen.findByTestId("competition-blog-panel");
    expect(screen.queryByTestId("blog-write-button")).toBeNull();
    expect(screen.getByText(/Aucun article/)).toBeTruthy();
  });

  it("compétition invisible (404) : le bloc disparaît", async () => {
    listBlogPosts.mockRejectedValue(new Error("Ligue introuvable"));
    const { container } = render(<CompetitionBlogPanel competition={LEAGUE} />);
    await waitFor(() => expect(listBlogPosts).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });
});
