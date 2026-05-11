/**
 * Tests pour `OnboardingModal` (Sprint O — Lot O.B.3).
 *
 * Conditions d'affichage :
 *   - `userCreatedAt` recent (< 24h).
 *   - `teamsCount === 0`.
 *   - Flag localStorage `onboarding_dismissed_v1` absent.
 *
 * Conditions de masquage :
 *   - `userCreatedAt` null / undefined / invalide.
 *   - Compte > 24h.
 *   - `teamsCount > 0`.
 *   - Flag dismiss deja set.
 *
 * Au click sur un CTA ou skip ou X, le flag est set.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import OnboardingModal from "./OnboardingModal";

beforeEach(() => {
  window.localStorage.clear();
});

const RECENT = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
const OLD = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48h ago

describe("OnboardingModal — Lot O.B.3", () => {
  it("s'affiche pour un nouveau coach (createdAt < 24h, 0 equipes)", () => {
    render(<OnboardingModal userCreatedAt={RECENT} teamsCount={0} />);
    expect(screen.getByTestId("onboarding-modal")).toBeTruthy();
    expect(screen.getByTestId("onboarding-cta-team")).toBeTruthy();
    expect(screen.getByTestId("onboarding-cta-tutorial")).toBeTruthy();
    expect(screen.getByTestId("onboarding-cta-pro-league")).toBeTruthy();
  });

  it("ne s'affiche pas si l'user a deja au moins une equipe", () => {
    render(<OnboardingModal userCreatedAt={RECENT} teamsCount={1} />);
    expect(screen.queryByTestId("onboarding-modal")).toBeNull();
  });

  it("ne s'affiche pas si le compte a plus de 24h", () => {
    render(<OnboardingModal userCreatedAt={OLD} teamsCount={0} />);
    expect(screen.queryByTestId("onboarding-modal")).toBeNull();
  });

  it("ne s'affiche pas si userCreatedAt est null ou invalide", () => {
    const { rerender } = render(
      <OnboardingModal userCreatedAt={null} teamsCount={0} />,
    );
    expect(screen.queryByTestId("onboarding-modal")).toBeNull();

    rerender(
      <OnboardingModal userCreatedAt="not-a-date" teamsCount={0} />,
    );
    expect(screen.queryByTestId("onboarding-modal")).toBeNull();
  });

  it("ne s'affiche pas si le flag dismiss est deja set", () => {
    window.localStorage.setItem("onboarding_dismissed_v1", "1");
    render(<OnboardingModal userCreatedAt={RECENT} teamsCount={0} />);
    expect(screen.queryByTestId("onboarding-modal")).toBeNull();
  });

  it("le bouton 'Plus tard' ferme le modal et set le flag dismiss", () => {
    render(<OnboardingModal userCreatedAt={RECENT} teamsCount={0} />);
    fireEvent.click(screen.getByTestId("onboarding-skip"));
    expect(screen.queryByTestId("onboarding-modal")).toBeNull();
    expect(window.localStorage.getItem("onboarding_dismissed_v1")).toBe("1");
  });

  it("le bouton X (fermer) ferme et set le flag dismiss", () => {
    render(<OnboardingModal userCreatedAt={RECENT} teamsCount={0} />);
    fireEvent.click(screen.getByTestId("onboarding-close"));
    expect(screen.queryByTestId("onboarding-modal")).toBeNull();
    expect(window.localStorage.getItem("onboarding_dismissed_v1")).toBe("1");
  });

  it("click sur un CTA ferme aussi le modal (et permet navigation)", () => {
    render(<OnboardingModal userCreatedAt={RECENT} teamsCount={0} />);
    fireEvent.click(screen.getByTestId("onboarding-cta-team"));
    // Le modal disparait du DOM apres dismiss.
    expect(screen.queryByTestId("onboarding-modal")).toBeNull();
    expect(window.localStorage.getItem("onboarding_dismissed_v1")).toBe("1");
  });
});
