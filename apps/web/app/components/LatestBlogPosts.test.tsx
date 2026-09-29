import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../lib/api-client", () => ({
  apiRequest: vi.fn(async () => ({
    posts: [
      { id: "a", slug: "avec-image", title: "Avec image", excerpt: "Extrait A", coverImageUrl: "/a.png", publishedAt: "2026-09-20T00:00:00Z", authorName: "Nuffle" },
      { id: "b", slug: "sans-image", title: "Sans image", excerpt: "Extrait B", coverImageUrl: null, publishedAt: null, authorName: null },
    ],
    total: 2, page: 1, limit: 3,
  })),
}));

import { LanguageProvider } from "../contexts/LanguageContext";
import LatestBlogPosts from "./LatestBlogPosts";

describe("LatestBlogPosts (home)", () => {
  it("liste les articles avec leur lien", async () => {
    render(<LanguageProvider><LatestBlogPosts /></LanguageProvider>);
    const title = await screen.findByText("Avec image");
    expect(title.closest("a")?.getAttribute("href")).toBe("/blog/avec-image");
  });

  it("reserve vignettes et extraits aux ecrans >= sm (liste compacte sur mobile)", async () => {
    render(<LanguageProvider><LatestBlogPosts /></LanguageProvider>);
    await screen.findByText("Sans image");
    const covers = screen.getAllByTestId("blog-cover");
    const excerpts = screen.getAllByTestId("blog-excerpt");
    expect(covers).toHaveLength(2);
    for (const el of [...covers, ...excerpts]) {
      expect(el.className).toMatch(/(^|\s)hidden(\s|$)/);
      expect(el.className).toMatch(/sm:(block|flex)/);
    }
  });
});
