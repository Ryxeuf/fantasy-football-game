/**
 * Lot P.B.1 — Tests du BetRefundModal.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import BetRefundModal from "./BetRefundModal";

const pendingBet = {
  id: "bet-pending123",
  stake: 100,
  status: "pending",
  selection: "home",
};
const wonBet = { ...pendingBet, id: "bet-won-1", status: "won" };

const defaultProps = {
  open: true,
  bet: pendingBet,
  loading: false,
  onClose: () => {},
  onConfirm: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BetRefundModal (Lot P.B.1)", () => {
  it("ne rend rien quand open=false", () => {
    const { container } = render(
      <BetRefundModal {...defaultProps} open={false} />,
    );
    expect(
      container.querySelector("[data-testid='bet-refund-modal']"),
    ).toBeNull();
  });

  it("ne rend rien quand bet=null", () => {
    const { container } = render(<BetRefundModal {...defaultProps} bet={null} />);
    expect(
      container.querySelector("[data-testid='bet-refund-modal']"),
    ).toBeNull();
  });

  it("affiche les infos du bet (id, stake, selection, status)", () => {
    const { container } = render(<BetRefundModal {...defaultProps} />);
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/home/);
    expect(txt).toMatch(/100/);
    // Le status "pending" est rendu dans un span dedie ; on cherche
    // le span exact pour eviter de matcher la regex sur d'autres
    // elements (placeholder textarea, etc.).
    expect(container.querySelector("span.text-blue-700")?.textContent).toBe(
      "pending",
    );
  });

  it("affiche le warning post-settlement pour bet 'won'", () => {
    render(<BetRefundModal {...defaultProps} bet={wonBet} />);
    expect(screen.getByTestId("post-settlement-warning")).toBeTruthy();
  });

  it("pas de warning pour bet pending", () => {
    render(<BetRefundModal {...defaultProps} bet={pendingBet} />);
    expect(screen.queryByTestId("post-settlement-warning")).toBeNull();
  });

  it("submit desactive si raison < 3 chars", () => {
    render(<BetRefundModal {...defaultProps} />);
    const btn = screen.getByTestId("refund-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("refund-reason"), {
      target: { value: "ab" },
    });
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("refund-reason"), {
      target: { value: "abc" },
    });
    expect(btn.disabled).toBe(false);
  });

  it("submit envoie la raison trim", async () => {
    const onConfirm = vi.fn();
    render(<BetRefundModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByTestId("refund-reason"), {
      target: { value: "  exploit detected  " },
    });
    fireEvent.click(screen.getByTestId("refund-submit"));
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({ reason: "exploit detected" }),
    );
  });

  it("loading=true desactive submit", () => {
    render(<BetRefundModal {...defaultProps} loading={true} />);
    fireEvent.change(screen.getByTestId("refund-reason"), {
      target: { value: "valid reason" },
    });
    const btn = screen.getByTestId("refund-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/envoi/i);
  });

  it("reset raison entre deux bets", () => {
    const { rerender } = render(
      <BetRefundModal {...defaultProps} bet={pendingBet} />,
    );
    fireEvent.change(screen.getByTestId("refund-reason"), {
      target: { value: "first reason" },
    });
    rerender(
      <BetRefundModal
        {...defaultProps}
        bet={{ ...pendingBet, id: "bet-pending-2" }}
      />,
    );
    expect(
      (screen.getByTestId("refund-reason") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("bouton Annuler appelle onClose", () => {
    const onClose = vi.fn();
    render(<BetRefundModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /^annuler$/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
