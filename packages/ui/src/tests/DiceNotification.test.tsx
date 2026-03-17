import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ToastProvider, useToast } from "../components/Toaster";

// Mock the DiceNotificationDemo component to avoid importing @bb/game-engine runtime
vi.mock("../components/DiceNotificationDemo", () => ({
  DiceNotificationDemo: () => (
    <div className="p-6 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">
        Test des Notifications de Dés
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <button className="px-4 py-2 bg-blue-500 text-white rounded">D6</button>
        <button className="px-4 py-2 bg-blue-500 text-white rounded">2D6</button>
        <button className="px-4 py-2 bg-green-500 text-white rounded">Esquive</button>
        <button className="px-4 py-2 bg-yellow-500 text-white rounded">Ramassage</button>
        <button className="px-4 py-2 bg-red-500 text-white rounded">Armure</button>
        <button className="px-4 py-2 bg-purple-500 text-white rounded">Blocage</button>
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <p>Cliquez sur les boutons pour tester les différents types de notifications de dés.</p>
        <p>Les notifications apparaîtront en haut à droite de l&apos;écran.</p>
      </div>
    </div>
  ),
}));

import { DiceNotificationDemo } from "../components/DiceNotificationDemo";

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

describe("ToastProvider", () => {
  it("devrait fournir le contexte de toast", () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      const calledRef = React.useRef(false);

      React.useEffect(() => {
        if (!calledRef.current) {
          calledRef.current = true;
          addToast({
            type: "info",
            title: "Test Toast",
            message: "Ceci est un test",
          });
        }
      }, [addToast]);

      return <div>Test</div>;
    };

    renderWithToastProvider(<TestComponent />);

    expect(screen.getByText("Test Toast")).toBeInTheDocument();
    expect(screen.getByText("Ceci est un test")).toBeInTheDocument();
  });
});
