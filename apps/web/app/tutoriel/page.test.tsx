import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TutorielListPage from "./page";
import { LanguageProvider } from "../contexts/LanguageContext";

function renderWithProvider() {
  return render(
    <LanguageProvider>
      <TutorielListPage />
    </LanguageProvider>,
  );
}

describe("TutorielListPage — N.1 interactive tutorial listing", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders the page heading", () => {
    renderWithProvider();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });

  it("lists the intro tutorial with a Start link", () => {
    renderWithProvider();
    const link = screen.getByRole("link", { name: /commencer/i });
    expect(link.getAttribute("href")).toBe("/tutoriel/mon-premier-match");
  });

  it("shows the intro tutorial title", () => {
    renderWithProvider();
    expect(screen.getByText(/mon premier match/i)).toBeTruthy();
  });

  it("shows the completed badge when localStorage flags the tutorial as done (S26.1a)", async () => {
    window.localStorage.setItem(
      "nuffle.tutorial.progress.mon-premier-match",
      JSON.stringify({
        slug: "mon-premier-match",
        currentStepIndex: 5,
        completed: true,
        completedAt: "2026-04-29T00:00:00.000Z",
      }),
    );
    renderWithProvider();
    const badge = await screen.findByTestId(
      "tutorial-completed-badge-mon-premier-match",
    );
    expect(badge.textContent).toMatch(/premiere foulee/i);
    const link = screen.getByRole("link", { name: /revoir/i });
    expect(link.getAttribute("href")).toBe("/tutoriel/mon-premier-match");
  });
});
