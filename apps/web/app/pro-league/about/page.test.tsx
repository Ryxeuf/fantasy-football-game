/**
 * Sprint 1.F.4 — Tests page marketing `/pro-league/about`.
 *
 * Client component (apres i18n refonte). On verifie : presence des
 * sections cles + contenu critique (CTAs, disclaimer, FAQ items,
 * calendrier). Les rendus passent par LanguageProvider pour `t`.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { LanguageProvider } from "../../contexts/LanguageContext";
import ProLeagueAboutPage from "./page";

function renderPage(): ReturnType<typeof render> {
  return render(
    <LanguageProvider>
      <ProLeagueAboutPage />
    </LanguageProvider>,
  );
}

describe("ProLeagueAboutPage — sprint 1.F.4", () => {
  it("rend le hero avec titre + CTAs principaux", () => {
    renderPage();
    expect(screen.getByTestId("about-hero")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1 }).textContent,
    ).toMatch(/Pro League/i);
    // CTAs hero
    expect(
      screen.getByRole("link", { name: /Voir le hub/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Classement live/i }),
    ).toBeTruthy();
  });

  it("rend la section 'Comment ca marche' avec 4 etapes ordonnees", () => {
    renderPage();
    const section = screen.getByTestId("about-howitworks");
    const items = section.querySelectorAll("li");
    expect(items.length).toBe(4);
    expect(section.textContent).toMatch(/Simulation d.terministe/i);
    expect(section.textContent).toMatch(/Diffusion live SSE/i);
    expect(section.textContent).toMatch(/Paris en Crowns/i);
    expect(section.textContent).toMatch(/Gazette LLM/i);
  });

  it("rend 4 feature cards avec liens vers les sub-pages cles", () => {
    renderPage();
    const cards = screen.getAllByTestId("about-feature-card");
    expect(cards.length).toBe(4);
    // Chaque card a son CTA
    expect(
      screen.getByRole("link", { name: /Voir la prochaine journ.e/i }),
    ).toHaveProperty("href");
    expect(
      screen.getByRole("link", { name: /Leaderboard parieurs/i }),
    ).toHaveProperty("href");
    expect(
      screen.getByRole("link", { name: /Lire l'.dition du jour/i }),
    ).toHaveProperty("href");
    expect(
      screen.getByRole("link", { name: /Hall of Fame/i }),
    ).toHaveProperty("href");
  });

  it("rend la table calendrier avec >= 4 slots", () => {
    renderPage();
    const rows = screen.getAllByTestId("about-schedule-row");
    expect(rows.length).toBeGreaterThanOrEqual(4);
    // Mardi 21h doit apparaitre (kickoff)
    const rowsText = rows.map((r) => r.textContent ?? "").join(" ");
    expect(rowsText).toMatch(/Mardi/i);
    expect(rowsText).toMatch(/21h00/);
  });

  it("rend la FAQ avec >= 6 items", () => {
    renderPage();
    const items = screen.getAllByTestId("about-faq-item");
    expect(items.length).toBeGreaterThanOrEqual(6);
    // Verifie le contenu critique
    const allText = items.map((i) => i.textContent ?? "").join(" ");
    expect(allText).toMatch(/Pro League/i);
    expect(allText).toMatch(/Crowns/i);
    expect(allText).toMatch(/argent r.el/i);
  });

  it("FAQ items sont en details collapsibles (summary present)", () => {
    renderPage();
    const items = screen.getAllByTestId("about-faq-item");
    for (const item of items) {
      expect(item.querySelector("summary")).not.toBeNull();
    }
  });

  it("affiche le disclaimer 'no real money' en evidence", () => {
    renderPage();
    const disclaimer = screen.getByTestId("about-disclaimer");
    expect(disclaimer.getAttribute("role")).toBe("note");
    expect(disclaimer.getAttribute("aria-label")).toMatch(/disclaimer/i);
    expect(disclaimer.textContent).toMatch(/argent r.el/i);
    expect(disclaimer.textContent).toMatch(/cashout/i);
  });

  it("expose un lien retour vers /pro-league", () => {
    renderPage();
    const backLinks = screen.getAllByRole("link", { name: /Hub/i });
    expect(backLinks.length).toBeGreaterThanOrEqual(1);
    expect(backLinks[0].getAttribute("href")).toBe("/pro-league");
  });

  it("rend sans throw (smoke)", () => {
    expect(() => renderPage()).not.toThrow();
  });
});
