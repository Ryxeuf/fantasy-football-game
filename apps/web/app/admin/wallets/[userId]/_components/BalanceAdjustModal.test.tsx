/**
 * Lot P.B.1 — Tests du BalanceAdjustModal.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import BalanceAdjustModal from "./BalanceAdjustModal";

const defaultProps = {
  open: true,
  userId: "user-abc12345",
  userLabel: "Coach Test",
  currentBalance: 1000,
  loading: false,
  onClose: () => {},
  onConfirm: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BalanceAdjustModal (Lot P.B.1)", () => {
  it("ne rend rien quand open=false", () => {
    const { container } = render(
      <BalanceAdjustModal {...defaultProps} open={false} />,
    );
    expect(
      container.querySelector("[data-testid='balance-adjust-modal']"),
    ).toBeNull();
  });

  it("affiche le solde actuel", () => {
    render(<BalanceAdjustModal {...defaultProps} currentBalance={1234} />);
    expect(screen.getByText(/1[  ]234/)).toBeTruthy();
  });

  it("preview du nouveau solde quand delta valide", () => {
    render(<BalanceAdjustModal {...defaultProps} currentBalance={1000} />);
    fireEvent.change(screen.getByTestId("balance-delta"), {
      target: { value: "500" },
    });
    expect(screen.getByTestId("new-balance-preview").textContent).toMatch(/1[  ]500/);
  });

  it("submit desactive quand delta=0", () => {
    render(<BalanceAdjustModal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("balance-delta"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByTestId("balance-reason"), {
      target: { value: "valid reason" },
    });
    const btn = screen.getByTestId("balance-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("submit desactive quand delta hors bornes (> 10M)", () => {
    render(<BalanceAdjustModal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("balance-delta"), {
      target: { value: "20000000" },
    });
    fireEvent.change(screen.getByTestId("balance-reason"), {
      target: { value: "valid reason" },
    });
    const btn = screen.getByTestId("balance-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("submit desactive si raison trop courte", () => {
    render(<BalanceAdjustModal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("balance-delta"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByTestId("balance-reason"), {
      target: { value: "ab" },
    });
    const btn = screen.getByTestId("balance-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("submit envoie payload signe + raison trim", async () => {
    const onConfirm = vi.fn();
    render(<BalanceAdjustModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByTestId("balance-delta"), {
      target: { value: "-200" },
    });
    fireEvent.change(screen.getByTestId("balance-reason"), {
      target: { value: "  fraud detection  " },
    });
    fireEvent.click(screen.getByTestId("balance-submit"));
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({
        delta: -200,
        reason: "fraud detection",
      }),
    );
  });

  it("change bouton couleur selon signe du delta", () => {
    render(<BalanceAdjustModal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("balance-delta"), {
      target: { value: "-50" },
    });
    fireEvent.change(screen.getByTestId("balance-reason"), {
      target: { value: "valid reason" },
    });
    const btn = screen.getByTestId("balance-submit");
    expect(btn.className).toMatch(/bg-red-600/);

    fireEvent.change(screen.getByTestId("balance-delta"), {
      target: { value: "50" },
    });
    expect(btn.className).toMatch(/bg-green-600/);
  });

  it("loading=true desactive submit + change label", () => {
    render(<BalanceAdjustModal {...defaultProps} loading={true} />);
    fireEvent.change(screen.getByTestId("balance-delta"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByTestId("balance-reason"), {
      target: { value: "valid reason" },
    });
    const btn = screen.getByTestId("balance-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/envoi/i);
  });

  it("reset delta + raison entre deux ouvertures", () => {
    const { rerender } = render(
      <BalanceAdjustModal {...defaultProps} userId="u1" />,
    );
    fireEvent.change(screen.getByTestId("balance-delta"), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByTestId("balance-reason"), {
      target: { value: "first reason" },
    });
    rerender(<BalanceAdjustModal {...defaultProps} userId="u2" />);
    expect((screen.getByTestId("balance-delta") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("balance-reason") as HTMLTextAreaElement).value).toBe("");
  });

  it("bouton Annuler appelle onClose", () => {
    const onClose = vi.fn();
    render(<BalanceAdjustModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /^annuler$/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
