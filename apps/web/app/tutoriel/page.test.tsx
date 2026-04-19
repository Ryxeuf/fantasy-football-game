import { describe, it, expect } from "vitest";
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
});
