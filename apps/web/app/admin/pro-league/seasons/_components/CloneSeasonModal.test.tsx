/**
 * Lot P.B.3 — Tests du CloneSeasonModal.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import CloneSeasonModal from "./CloneSeasonModal";

const defaultProps = {
  open: true,
  sourceSeasonId: "season-abc12345",
  sourceSeasonLabel: "Saison 2026 (in_progress)",
  loading: false,
  onClose: () => {},
  onConfirm: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CloneSeasonModal (Lot P.B.3)", () => {
  it("ne rend rien quand open=false", () => {
    const { container } = render(
      <CloneSeasonModal {...defaultProps} open={false} />,
    );
    expect(container.querySelector("[data-testid='clone-season-modal']")).toBeNull();
  });

  it("year default = currentYear + 1 a l'ouverture", () => {
    render(<CloneSeasonModal {...defaultProps} />);
    const input = screen.getByTestId("clone-year") as HTMLInputElement;
    expect(parseInt(input.value, 10)).toBe(new Date().getFullYear() + 1);
  });

  it("submit disabled si year hors bornes", () => {
    render(<CloneSeasonModal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("clone-year"), { target: { value: "1999" } });
    const btn = screen.getByTestId("clone-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("submit envoie year (driverKind omis si inherit)", async () => {
    const onConfirm = vi.fn();
    render(<CloneSeasonModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByTestId("clone-year"), { target: { value: "2027" } });
    fireEvent.click(screen.getByTestId("clone-submit"));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({ year: 2027 });
    });
  });

  it("submit envoie driverKind si selection explicite", async () => {
    const onConfirm = vi.fn();
    render(<CloneSeasonModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByTestId("clone-year"), { target: { value: "2027" } });
    fireEvent.click(screen.getByTestId("clone-driver-full"));
    fireEvent.click(screen.getByTestId("clone-submit"));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({ year: 2027, driverKind: "full" });
    });
  });

  it("loading=true desactive submit + label", () => {
    render(<CloneSeasonModal {...defaultProps} loading={true} />);
    const btn = screen.getByTestId("clone-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/clone/i);
  });

  it("reset year + driver entre 2 ouvertures", () => {
    const { rerender } = render(
      <CloneSeasonModal {...defaultProps} sourceSeasonId="s1" />,
    );
    fireEvent.change(screen.getByTestId("clone-year"), { target: { value: "2030" } });
    fireEvent.click(screen.getByTestId("clone-driver-hybrid"));

    rerender(<CloneSeasonModal {...defaultProps} sourceSeasonId="s2" />);
    const input = screen.getByTestId("clone-year") as HTMLInputElement;
    // Default revient a currentYear + 1.
    expect(parseInt(input.value, 10)).toBe(new Date().getFullYear() + 1);
    // Driver revient a "inherit".
    const inheritBtn = screen.getByTestId("clone-driver-inherit");
    expect(inheritBtn.className).toMatch(/bg-nuffle-gold/);
  });

  it("bouton Annuler appelle onClose", () => {
    const onClose = vi.fn();
    render(<CloneSeasonModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /^annuler$/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
