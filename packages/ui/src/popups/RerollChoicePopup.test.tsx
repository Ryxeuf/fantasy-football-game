import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RerollChoicePopup from "./RerollChoicePopup";

describe("RerollChoicePopup", () => {
  const defaultProps = {
    rollType: "dodge" as const,
    playerName: "Griff Oberwald",
    teamRerollsLeft: 2,
    onChoose: vi.fn(),
  };

  it("renders the popup with player name and roll type", () => {
    render(<RerollChoicePopup {...defaultProps} />);
    expect(screen.getByText("Relance disponible !")).toBeTruthy();
    expect(screen.getByText(/Griff Oberwald/)).toBeTruthy();
    expect(screen.getByText(/Esquive/)).toBeTruthy();
  });

  it("displays remaining rerolls count", () => {
    render(<RerollChoicePopup {...defaultProps} />);
    expect(screen.getByText(/Relances restantes : 2/)).toBeTruthy();
  });

  it("calls onChoose(true) when Relancer is clicked", () => {
    const onChoose = vi.fn();
    render(<RerollChoicePopup {...defaultProps} onChoose={onChoose} />);
    fireEvent.click(screen.getByText("Relancer"));
    expect(onChoose).toHaveBeenCalledWith(true);
  });

  it("calls onChoose(false) when Refuser is clicked", () => {
    const onChoose = vi.fn();
    render(<RerollChoicePopup {...defaultProps} onChoose={onChoose} />);
    fireEvent.click(screen.getByText("Refuser"));
    expect(onChoose).toHaveBeenCalledWith(false);
  });

  it("displays correct label for pickup roll type", () => {
    render(<RerollChoicePopup {...defaultProps} rollType="pickup" />);
    expect(screen.getByText(/Ramassage/)).toBeTruthy();
  });

  it("displays correct label for gfi roll type", () => {
    render(<RerollChoicePopup {...defaultProps} rollType="gfi" />);
    expect(screen.getByText(/Going For It/)).toBeTruthy();
  });
});
