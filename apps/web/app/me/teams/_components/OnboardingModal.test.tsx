/**
 * Tests pour `OnboardingModal` — porte d'entrée de l'assistant d'onboarding.
 *
 * Le composant ne fait que la décision d'affichage + la persistance du skip ;
 * l'UI réelle (wizard 3 étapes) est mockée ici pour isoler la logique de gate.
 *
 * Conditions d'affichage :
 *   - `teamsCount === 0`.
 *   - Flag localStorage `onboarding_first_team_dismissed_v1` absent.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// Stub du wizard : expose un testid + un bouton qui appelle onDismiss.
vi.mock("./onboarding/FirstTeamWizard", () => ({
  default: ({ onDismiss }: { onDismiss: () => void }) => (
    <div data-testid="onboarding-wizard">
      <button data-testid="stub-dismiss" onClick={onDismiss}>
        dismiss
      </button>
    </div>
  ),
}));

import OnboardingModal from "./OnboardingModal";
import { ONBOARDING_DISMISS_KEY } from "./onboarding/onboarding-logic";

beforeEach(() => {
  window.localStorage.clear();
});

describe("OnboardingModal — gate", () => {
  it("affiche l'assistant pour un coach sans équipe", () => {
    render(<OnboardingModal teamsCount={0} />);
    expect(screen.getByTestId("onboarding-wizard")).toBeTruthy();
  });

  it("ne s'affiche pas si le coach a déjà une équipe", () => {
    render(<OnboardingModal teamsCount={2} />);
    expect(screen.queryByTestId("onboarding-wizard")).toBeNull();
  });

  it("ne s'affiche pas si le flag de skip est déjà présent", () => {
    window.localStorage.setItem(ONBOARDING_DISMISS_KEY, "1");
    render(<OnboardingModal teamsCount={0} />);
    expect(screen.queryByTestId("onboarding-wizard")).toBeNull();
  });

  it("le skip ferme l'assistant et persiste le flag", () => {
    render(<OnboardingModal teamsCount={0} />);
    fireEvent.click(screen.getByTestId("stub-dismiss"));
    expect(screen.queryByTestId("onboarding-wizard")).toBeNull();
    expect(window.localStorage.getItem(ONBOARDING_DISMISS_KEY)).toBe("1");
  });

  it("reste compatible avec la prop héritée userCreatedAt", () => {
    render(
      <OnboardingModal
        userCreatedAt={new Date().toISOString()}
        teamsCount={0}
      />,
    );
    expect(screen.getByTestId("onboarding-wizard")).toBeTruthy();
  });
});
