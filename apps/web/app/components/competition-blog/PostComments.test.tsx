import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ listBlogComments: vi.fn(), createBlogComment: vi.fn() }));
vi.mock("../../lib/competition-blog", async (orig) => ({
  ...(await orig<typeof import("../../lib/competition-blog")>()),
  ...api,
}));

import PostComments from "./PostComments";
import { MEMBER_VIEWER, READER_VIEWER } from "./fixtures.test-utils";

const LEAGUE = { kind: "league" as const, id: "l1" };
const comment = (over = {}) => ({
  id: "c1",
  body: "Bien joué",
  createdAt: "2027-03-12T10:00:00.000Z",
  editedAt: null,
  author: { id: "u2", coachName: "Morg" },
  hidden: null,
  viewer: { canEdit: false, canDelete: false },
  ...over,
});

beforeEach(() => {
  api.listBlogComments.mockReset();
  api.createBlogComment.mockReset();
});

describe("PostComments", () => {
  it("un membre commente", async () => {
    api.listBlogComments.mockResolvedValue({ comments: [comment()], total: 1, page: 1, limit: 50, viewer: MEMBER_VIEWER });
    api.createBlogComment.mockResolvedValue(comment({ id: "c2", body: "Merci !" }));
    render(<PostComments competition={LEAGUE} postId="p1" viewer={MEMBER_VIEWER} />);
    await screen.findByText("Bien joué");
    fireEvent.change(screen.getByLabelText("Votre commentaire"), { target: { value: "Merci !" } });
    fireEvent.click(screen.getByRole("button", { name: "Commenter" }));
    await screen.findByText("Merci !");
    expect(api.createBlogComment).toHaveBeenCalledWith(LEAGUE, "p1", "Merci !");
    expect(screen.getByText("💬 Commentaires (2)")).toBeTruthy();
  });

  it("un lecteur n'a pas de formulaire", async () => {
    api.listBlogComments.mockResolvedValue({ comments: [], total: 0, page: 1, limit: 50, viewer: READER_VIEWER });
    render(<PostComments competition={LEAGUE} postId="p1" viewer={READER_VIEWER} />);
    await waitFor(() => expect(api.listBlogComments).toHaveBeenCalled());
    expect(screen.queryByTestId("post-comment-form")).toBeNull();
    expect(screen.getByText(/réservés aux coachs/)).toBeTruthy();
  });

  it("commentaire masqué : raison affichée à son auteur", async () => {
    api.listBlogComments.mockResolvedValue({
      comments: [comment({ hidden: { reason: "blocklist:slur-2", at: "" }, viewer: { canEdit: true, canDelete: true } })],
      total: 1,
      page: 1,
      limit: 50,
      viewer: MEMBER_VIEWER,
    });
    render(<PostComments competition={LEAGUE} postId="p1" viewer={MEMBER_VIEWER} />);
    expect(await screen.findByText(/Masqué automatiquement/)).toBeTruthy();
    expect(screen.getByText("Modifier")).toBeTruthy();
  });
});
