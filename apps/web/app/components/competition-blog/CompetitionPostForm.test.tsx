import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => ({ createBlogPost: vi.fn(), getBlogPost: vi.fn(), updateBlogPost: vi.fn() }));
vi.mock("../../hooks/useFeatureFlag", () => ({ useFeatureFlagOrOff: () => true }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back: vi.fn() }) }));
vi.mock("../../lib/competition-blog", async (orig) => ({
  ...(await orig<typeof import("../../lib/competition-blog")>()),
  ...api,
}));
// Tiptap ne se monte pas dans jsdom : un textarea suffit à piloter le formulaire.
vi.mock("./RichTextEditor", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="Contenu de l'article" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import CompetitionPostForm, { isEmptyEditorHtml } from "./CompetitionPostForm";
import { makePost } from "./fixtures.test-utils";

const LEAGUE = { kind: "league" as const, id: "l1" };

beforeEach(() => {
  push.mockReset();
  Object.values(api).forEach((m) => m.mockReset());
});

describe("isEmptyEditorHtml", () => {
  it("paragraphe vide = vide ; image seule = contenu", () => {
    expect(isEmptyEditorHtml("<p></p>")).toBe(true);
    expect(isEmptyEditorHtml('<p><img src="/x.png"></p>')).toBe(false);
  });
});

describe("CompetitionPostForm", () => {
  it("publie un nouvel article puis ouvre sa page", async () => {
    api.createBlogPost.mockResolvedValue(makePost({ id: "new1" }));
    render(<CompetitionPostForm competition={LEAGUE} />);
    const publish = screen.getByRole("button", { name: "Publier" });
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/Compte rendu/), { target: { value: "Bilan J3" } });
    fireEvent.change(screen.getByLabelText("Contenu de l'article"), { target: { value: "<p>Texte</p>" } });
    fireEvent.click(publish);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/leagues/l1/blog/new1"));
    expect(api.createBlogPost).toHaveBeenCalledWith(LEAGUE, {
      title: "Bilan J3",
      contentHtml: "<p>Texte</p>",
      coverImageUrl: null,
      publish: true,
    });
  });

  it("brouillon : publish false", async () => {
    api.createBlogPost.mockResolvedValue(makePost({ id: "d1", status: "draft" }));
    render(<CompetitionPostForm competition={LEAGUE} />);
    fireEvent.change(screen.getByPlaceholderText(/Compte rendu/), { target: { value: "WIP" } });
    fireEvent.change(screen.getByLabelText("Contenu de l'article"), { target: { value: "<p>x</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => expect(api.createBlogPost).toHaveBeenCalled());
    expect(api.createBlogPost.mock.calls[0][1]).toMatchObject({ publish: false });
  });

  it("édition refusée si le serveur ne l'accorde pas", async () => {
    api.getBlogPost.mockResolvedValue({ post: makePost({ viewer: { canEdit: false, canDelete: false } }) });
    render(<CompetitionPostForm competition={LEAGUE} postId="p1" />);
    expect(await screen.findByText(/ne pouvez pas modifier/)).toBeTruthy();
  });

  it("édition : préremplie, enregistrée par PATCH", async () => {
    api.getBlogPost.mockResolvedValue({ post: makePost({ viewer: { canEdit: true, canDelete: true } }) });
    api.updateBlogPost.mockResolvedValue(makePost());
    render(<CompetitionPostForm competition={LEAGUE} postId="p1" />);
    const title = await screen.findByDisplayValue("Compte rendu");
    fireEvent.change(title, { target: { value: "Compte rendu (corrigé)" } });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer les modifications/ }));
    await waitFor(() => expect(api.updateBlogPost).toHaveBeenCalled());
    expect(api.updateBlogPost.mock.calls[0][2]).toMatchObject({ title: "Compte rendu (corrigé)" });
  });
});
