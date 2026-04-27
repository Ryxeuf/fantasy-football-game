import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ActionPickerPopup from "./ActionPickerPopup";

describe("ActionPickerPopup", () => {
  const baseProps = {
    playerName: "Griff Oberwald",
    onPick: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders the player name", () => {
    render(
      <ActionPickerPopup
        {...baseProps}
        available={["MOVE", "BLOCK", "BLITZ", "PASS", "HANDOFF", "FOUL"]}
      />,
    );
    expect(screen.getByText("Griff Oberwald")).toBeTruthy();
  });

  it("renders all standard action labels", () => {
    render(
      <ActionPickerPopup
        {...baseProps}
        available={["MOVE", "BLOCK", "BLITZ", "PASS", "HANDOFF", "FOUL"]}
      />,
    );
    expect(screen.getByText("Mouvement")).toBeTruthy();
    expect(screen.getByText("Blocage")).toBeTruthy();
    expect(screen.getByText("Blitz")).toBeTruthy();
    expect(screen.getByText("Passe")).toBeTruthy();
    expect(screen.getByText("Transmission")).toBeTruthy();
    expect(screen.getByText("Faute")).toBeTruthy();
  });

  it("does NOT render THROW_TEAM_MATE button when not in available list", () => {
    render(
      <ActionPickerPopup
        {...baseProps}
        available={["MOVE", "BLOCK", "BLITZ", "PASS", "HANDOFF", "FOUL"]}
      />,
    );
    expect(screen.queryByText("Lancer coéquipier")).toBeNull();
  });

  it("renders THROW_TEAM_MATE button when listed in available", () => {
    render(
      <ActionPickerPopup
        {...baseProps}
        available={[
          "MOVE",
          "BLOCK",
          "BLITZ",
          "PASS",
          "HANDOFF",
          "FOUL",
          "THROW_TEAM_MATE",
        ]}
      />,
    );
    expect(screen.getByText("Lancer coéquipier")).toBeTruthy();
  });

  it("calls onPick with THROW_TEAM_MATE when button is clicked", () => {
    const onPick = vi.fn();
    render(
      <ActionPickerPopup
        {...baseProps}
        onPick={onPick}
        available={["MOVE", "THROW_TEAM_MATE"]}
      />,
    );
    fireEvent.click(screen.getByText("Lancer coéquipier"));
    expect(onPick).toHaveBeenCalledWith("THROW_TEAM_MATE");
  });

  it("calls onClose when cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <ActionPickerPopup
        {...baseProps}
        onClose={onClose}
        available={["MOVE", "BLOCK"]}
      />,
    );
    fireEvent.click(screen.getByText("Annuler"));
    expect(onClose).toHaveBeenCalled();
  });
});
