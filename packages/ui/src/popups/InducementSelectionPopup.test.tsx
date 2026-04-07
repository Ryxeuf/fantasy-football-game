import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InducementSelectionPopup from "./InducementSelectionPopup";
import type { InducementDefinition } from "@bb/game-engine";

const makeCatalogue = (): InducementDefinition[] => [
  {
    slug: "extra_team_training",
    displayName: "Extra Team Training",
    displayNameFr: "Entraînement supplémentaire",
    baseCost: 100_000,
    maxQuantity: 4,
    description: "+1 Team Re-roll for the match per purchase.",
  },
  {
    slug: "bloodweiser_kegs",
    displayName: "Bloodweiser Kegs",
    displayNameFr: "Fûts de Bloodweiser",
    baseCost: 50_000,
    maxQuantity: 2,
    description: "+1 to KO recovery rolls for each keg purchased.",
  },
  {
    slug: "wizard",
    displayName: "Wizard",
    displayNameFr: "Magicien",
    baseCost: 150_000,
    maxQuantity: 1,
    description: "Once per match, cast Fireball or Lightning Bolt.",
  },
];

describe("InducementSelectionPopup", () => {
  const defaultProps = {
    catalogue: makeCatalogue(),
    budget: 200_000,
    teamName: "Reikland Reavers",
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
  };

  it("renders the popup with team name and budget", () => {
    render(<InducementSelectionPopup {...defaultProps} />);
    expect(screen.getByText(/Inducements/)).toBeTruthy();
    expect(screen.getByText(/Reikland Reavers/)).toBeTruthy();
    expect(screen.getByText(/200 000/)).toBeTruthy();
  });

  it("displays all catalogue items", () => {
    render(<InducementSelectionPopup {...defaultProps} />);
    expect(screen.getByText("Extra Team Training")).toBeTruthy();
    expect(screen.getByText("Bloodweiser Kegs")).toBeTruthy();
    expect(screen.getByText("Wizard")).toBeTruthy();
  });

  it("shows cost for each inducement", () => {
    render(<InducementSelectionPopup {...defaultProps} />);
    expect(screen.getByText(/100 000 gp — max 4/)).toBeTruthy();
    expect(screen.getByText(/50 000 gp — max 2/)).toBeTruthy();
    expect(screen.getByText(/150 000 gp — max 1/)).toBeTruthy();
  });

  it("calls onSkip when skip button is clicked", () => {
    const onSkip = vi.fn();
    render(<InducementSelectionPopup {...defaultProps} onSkip={onSkip} />);
    fireEvent.click(screen.getByText("Passer"));
    expect(onSkip).toHaveBeenCalled();
  });

  it("calls onConfirm with empty selection when confirming without picking", () => {
    const onConfirm = vi.fn();
    render(<InducementSelectionPopup {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("Confirmer"));
    expect(onConfirm).toHaveBeenCalledWith({ items: [] });
  });

  it("increments quantity when + is clicked and calls onConfirm with selection", () => {
    const onConfirm = vi.fn();
    render(<InducementSelectionPopup {...defaultProps} onConfirm={onConfirm} />);

    // Click + next to Bloodweiser Kegs (50k, within 200k budget)
    const addButtons = screen.getAllByText("+");
    // Bloodweiser Kegs is index 1 in the catalogue
    fireEvent.click(addButtons[1]);

    fireEvent.click(screen.getByText("Confirmer"));
    expect(onConfirm).toHaveBeenCalledWith({
      items: [{ slug: "bloodweiser_kegs", quantity: 1 }],
    });
  });

  it("decrements quantity when - is clicked", () => {
    const onConfirm = vi.fn();
    render(<InducementSelectionPopup {...defaultProps} onConfirm={onConfirm} />);

    const addButtons = screen.getAllByText("+");
    // Add 2 Bloodweiser Kegs
    fireEvent.click(addButtons[1]);
    fireEvent.click(addButtons[1]);

    // Remove 1
    const removeButtons = screen.getAllByText("-");
    fireEvent.click(removeButtons[1]);

    fireEvent.click(screen.getByText("Confirmer"));
    expect(onConfirm).toHaveBeenCalledWith({
      items: [{ slug: "bloodweiser_kegs", quantity: 1 }],
    });
  });

  it("prevents exceeding budget", () => {
    render(<InducementSelectionPopup {...defaultProps} budget={100_000} />);

    // Add Extra Team Training (100k) — fills budget
    const addButtons = screen.getAllByText("+");
    fireEvent.click(addButtons[0]);

    // Try to add Bloodweiser Kegs (50k) — would exceed 100k budget
    // The + button for kegs should be disabled
    fireEvent.click(addButtons[1]);

    // Budget should show 100k spent, not 150k
    expect(screen.getByText(/100 000 \/ 100 000/)).toBeTruthy();
  });

  it("prevents exceeding maxQuantity", () => {
    const onConfirm = vi.fn();
    render(<InducementSelectionPopup {...defaultProps} budget={500_000} onConfirm={onConfirm} />);

    // Wizard has maxQuantity 1 — click + twice
    const addButtons = screen.getAllByText("+");
    fireEvent.click(addButtons[2]); // wizard
    fireEvent.click(addButtons[2]); // should be ignored

    fireEvent.click(screen.getByText("Confirmer"));
    expect(onConfirm).toHaveBeenCalledWith({
      items: [{ slug: "wizard", quantity: 1 }],
    });
  });

  it("updates remaining budget display when items are selected", () => {
    render(<InducementSelectionPopup {...defaultProps} />);

    const addButtons = screen.getAllByText("+");
    fireEvent.click(addButtons[1]); // Add Bloodweiser Kegs (50k)

    expect(screen.getByText(/50 000 \/ 200 000/)).toBeTruthy();
  });
});
