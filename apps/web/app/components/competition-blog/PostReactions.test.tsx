import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toggleReaction = vi.hoisted(() => vi.fn());
vi.mock("../../lib/competition-blog", async (orig) => ({
  ...(await orig<typeof import("../../lib/competition-blog")>()),
  toggleReaction,
}));

import PostReactions from "./PostReactions";
import { EMPTY_REACTIONS } from "./fixtures.test-utils";

const CUP = { kind: "cup" as const, id: "c1" };

beforeEach(() => {
  toggleReaction.mockReset();
});

describe("PostReactions", () => {
  it("un membre bascule une réaction", async () => {
    toggleReaction.mockResolvedValue({ counts: { ...EMPTY_REACTIONS.counts, fire: 1 }, mine: ["fire"] });
    render(<PostReactions competition={CUP} postId="p1" initial={EMPTY_REACTIONS} canReact />);
    fireEvent.click(screen.getByTestId("post-reaction-fire"));
    await waitFor(() =>
      expect(screen.getByTestId("post-reaction-fire").getAttribute("aria-pressed")).toBe("true"),
    );
    expect(toggleReaction).toHaveBeenCalledWith(CUP, "p1", "fire", true);
  });

  it("un lecteur ne voit que les réactions posées, sans pouvoir cliquer", () => {
    render(
      <PostReactions
        competition={CUP}
        postId="p1"
        initial={{ counts: { ...EMPTY_REACTIONS.counts, skull: 2 }, mine: [] }}
        canReact={false}
      />,
    );
    expect(screen.queryByTestId("post-reaction-fire")).toBeNull();
    expect((screen.getByTestId("post-reaction-skull") as HTMLButtonElement).disabled).toBe(true);
  });
});
