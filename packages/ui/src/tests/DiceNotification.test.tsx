import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { DiceNotificationDemo } from "../components/DiceNotificationDemo";
import { ToastProvider, useToast } from "../components/Toaster";

// Mock du game-engine
vi.mock("@bb/game-engine", () => ({
  useDiceNotifications: () => ({
    showDiceResult: vi.fn(),
    showBlockDiceResult: vi.fn(),
    showCustomDiceResult: vi.fn(),
  }),
  setDiceNotificationCallback: vi.fn(),
  setBlockDiceNotificationCallback: vi.fn(),
  makeRNG: () => () => 0.5, // Mock RNG qui retourne toujours 0.5
}));

const renderWithToastProvider = (component: React.ReactElement) => {
  return render(<ToastProvider>{component}</ToastProvider>);
};

describe("DiceNotificationDemo", () => {
  it("devrait rendre le composant de démonstration", () => {
    renderWithToastProvider(<DiceNotificationDemo />);

    expect(
      screen.getByText("Test des Notifications de Dés"),
    ).toBeInTheDocument();
    expect(screen.getByText("D6")).toBeInTheDocument();
    expect(screen.getByText("2D6")).toBeInTheDocument();
    expect(screen.getByText("Esquive")).toBeInTheDocument();
    expect(screen.getByText("Ramassage")).toBeInTheDocument();
    expect(screen.getByText("Armure")).toBeInTheDocument();
    expect(screen.getByText("Blocage")).toBeInTheDocument();
  });

  it("devrait avoir des boutons cliquables", () => {
    renderWithToastProvider(<DiceNotificationDemo />);

    const d6Button = screen.getByText("D6");
    const blockButton = screen.getByText("Blocage");

    expect(d6Button).toBeEnabled();
    expect(blockButton).toBeEnabled();
  });

  it("devrait afficher les instructions", () => {
    renderWithToastProvider(<DiceNotificationDemo />);

    expect(
      screen.getByText(/Cliquez sur les boutons pour tester/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Les notifications apparaîtront en haut à droite/),
    ).toBeInTheDocument();
  });
});

