import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InducementSelector from "./InducementSelector";
import type { InducementDefinition, InducementSlug } from "@bb/game-engine";

// Mock LanguageContext
vi.mock("../contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      inducements: {
        title: "Inducements",
        pettyCash: "Petty Cash",
        budget: "Budget",
        remaining: "Remaining",
        totalCost: "Total cost",
        confirm: "Confirm Selection",
        skip: "Skip (no inducements)",
        noBudget: "No budget available",
        maxReached: "Max quantity reached",
        description: "Description",
        quantity: "Qty",
        cost: "Cost",
        starPlayers: "Star Players",
        waitingOpponent: "Waiting for opponent...",
        selectInducements: "Select your inducements",
      },
      teams: {
        kpo: "K po",
      },
    },
    language: "fr",
  }),
}));

const MOCK_CATALOGUE: InducementDefinition[] = [
  {
    slug: "extra_team_training" as InducementSlug,
    displayName: "Extra Team Training",
    displayNameFr: "Entraînement supplémentaire",
    baseCost: 100_000,
    maxQuantity: 4,
    description: "+1 Team Re-roll for the match per purchase.",
  },
  {
    slug: "bloodweiser_kegs" as InducementSlug,
    displayName: "Bloodweiser Kegs",
    displayNameFr: "Fûts de Bloodweiser",
    baseCost: 50_000,
    maxQuantity: 2,
    description: "+1 to KO recovery rolls for each keg purchased.",
  },
  {
    slug: "wizard" as InducementSlug,
    displayName: "Wizard",
    displayNameFr: "Magicien",
    baseCost: 150_000,
    maxQuantity: 1,
    description: "Once per match, cast Fireball or Lightning Bolt.",
  },
];

describe("InducementSelector", () => {
  const defaultProps = {
    catalogue: MOCK_CATALOGUE,
    budget: 200_000,
    pettyCash: 150_000,
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
    disabled: false,
    teamName: "Skaven",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the inducement catalogue with French names", () => {
    render(<InducementSelector {...defaultProps} />);
    // French names because lang="fr" in mock
    expect(screen.getByText("Entraînement supplémentaire")).toBeDefined();
    expect(screen.getByText("Fûts de Bloodweiser")).toBeDefined();
    expect(screen.getByText("Magicien")).toBeDefined();
  });

  it("shows the budget information", () => {
    render(<InducementSelector {...defaultProps} />);
    // Budget 200K, Petty Cash 150K — both rendered in text
    expect(screen.getByText("Budget")).toBeDefined();
    expect(screen.getByText("Petty Cash")).toBeDefined();
  });

  it("allows adding an inducement and updates quantity", () => {
    render(<InducementSelector {...defaultProps} />);
    const addButtons = screen.getAllByRole("button", { name: "+" });
    fireEvent.click(addButtons[0]); // Add Extra Team Training
    // Quantity should now show 1
    const quantities = screen.getAllByText("1");
    expect(quantities.length).toBeGreaterThan(0);
  });

  it("enforces max quantity", () => {
    render(
      <InducementSelector
        {...defaultProps}
        budget={1_000_000}
        catalogue={[MOCK_CATALOGUE[2]]} // Wizard, max 1
      />,
    );
    const addButton = screen.getByRole("button", { name: "+" });
    fireEvent.click(addButton); // Add wizard (max 1)
    // Button should be disabled after reaching max
    expect(addButton.hasAttribute("disabled")).toBe(true);
  });

  it("enforces budget limit", () => {
    render(
      <InducementSelector
        {...defaultProps}
        budget={100_000}
        catalogue={[MOCK_CATALOGUE[2]]} // Wizard costs 150K
      />,
    );
    const addButton = screen.getByRole("button", { name: "+" });
    // Wizard costs 150K but budget is 100K — button should be disabled
    expect(addButton.hasAttribute("disabled")).toBe(true);
  });

  it("calls onConfirm with selected items", () => {
    render(<InducementSelector {...defaultProps} />);
    const addButtons = screen.getAllByRole("button", { name: "+" });
    fireEvent.click(addButtons[0]); // Add Extra Team Training

    const confirmButton = screen.getByText("Confirm Selection");
    fireEvent.click(confirmButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledWith({
      items: [{ slug: "extra_team_training", quantity: 1 }],
    });
  });

  it("calls onSkip when skip button is clicked", () => {
    render(<InducementSelector {...defaultProps} />);
    const skipButton = screen.getByText("Skip (no inducements)");
    fireEvent.click(skipButton);
    expect(defaultProps.onSkip).toHaveBeenCalled();
  });

  it("allows removing an inducement", () => {
    render(<InducementSelector {...defaultProps} />);
    const addButtons = screen.getAllByRole("button", { name: "+" });
    fireEvent.click(addButtons[0]); // Add Extra Team Training

    // There are multiple "-" buttons (one per catalogue item), find the one that's enabled
    const removeButtons = screen.getAllByRole("button", { name: "-" });
    const enabledRemoveBtn = removeButtons.find((btn) => !btn.hasAttribute("disabled"));
    expect(enabledRemoveBtn).toBeDefined();
    fireEvent.click(enabledRemoveBtn!);

    // Confirm with empty selection
    const confirmButton = screen.getByText("Confirm Selection");
    fireEvent.click(confirmButton);
    expect(defaultProps.onConfirm).toHaveBeenCalledWith({ items: [] });
  });

  it("disables add buttons when disabled prop is true", () => {
    render(<InducementSelector {...defaultProps} disabled={true} />);
    const addButtons = screen.getAllByRole("button", { name: "+" });
    addButtons.forEach((btn) => expect(btn.hasAttribute("disabled")).toBe(true));
  });

  it("shows noBudget message when budget is 0", () => {
    render(<InducementSelector {...defaultProps} budget={0} pettyCash={0} />);
    expect(screen.getByText("No budget available")).toBeDefined();
  });
});
