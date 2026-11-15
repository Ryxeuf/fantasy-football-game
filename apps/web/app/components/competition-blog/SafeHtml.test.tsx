import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SafeHtml from "./SafeHtml";

describe("SafeHtml", () => {
  it("assainit une seconde fois dans le navigateur", async () => {
    render(<SafeHtml html={'<p>ok</p><img src="x" onerror="alert(1)"><script>alert(2)</script>'} />);
    const node = await screen.findByTestId("blog-post-content");
    expect(node.innerHTML).toContain("<p>ok</p>");
    expect(node.innerHTML).not.toContain("onerror");
    expect(node.innerHTML).not.toContain("<script");
  });
});
