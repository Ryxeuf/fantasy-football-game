/**
 * Lot P.B.4 — Tests du BanUserModal.
 *
 * Couvre : preset durations (1/7/30/permanent), raison validation min,
 * payload envoye, etat loading, reset entre deux ouvertures.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import BanUserModal from "./BanUserModal";

const defaultProps = {
  open: true,
  userId: "user-abcdef12",
  userLabel: "coachname",
  loading: false,
  onClose: () => {},
  onConfirm: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BanUserModal (Lot P.B.4)", () => {
  it("ne rend rien quand open=false", () => {
    const { container } = render(
      <BanUserModal {...defaultProps} open={false} />,
    );
    expect(container.querySelector("[data-testid='ban-user-modal']")).toBeNull();
  });

  it("affiche les 4 preset durations + raison textarea", () => {
    render(<BanUserModal {...defaultProps} />);
    expect(screen.getByTestId("ban-duration-1")).toBeTruthy();
    expect(screen.getByTestId("ban-duration-7")).toBeTruthy();
    expect(screen.getByTestId("ban-duration-30")).toBeTruthy();
    expect(screen.getByTestId("ban-duration-0")).toBeTruthy();
    expect(screen.getByTestId("ban-reason")).toBeTruthy();
  });

  it("default duration = 7 jours", () => {
    render(<BanUserModal {...defaultProps} />);
    const btn7 = screen.getByTestId("ban-duration-7");
    expect(btn7.className).toMatch(/bg-red-600/);
  });

  it("submit envoie reason + durationDays selectionne", async () => {
    const onConfirm = vi.fn();
    render(<BanUserModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("ban-duration-30"));
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "exploit detecte" },
    });
    fireEvent.click(screen.getByTestId("ban-submit"));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        reason: "exploit detecte",
        durationDays: 30,
      });
    });
  });

  it("submit avec preset 'Permanent' envoie durationDays=0", async () => {
    const onConfirm = vi.fn();
    render(<BanUserModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("ban-duration-0"));
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "fraude grave" },
    });
    fireEvent.click(screen.getByTestId("ban-submit"));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        reason: "fraude grave",
        durationDays: 0,
      });
    });
  });

  it("submit desactive tant que reason < 3 chars", () => {
    render(<BanUserModal {...defaultProps} />);
    const submit = screen.getByTestId("ban-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "ab" },
    });
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "abc" },
    });
    expect(submit.disabled).toBe(false);
  });

  it("trim la raison avant envoi", async () => {
    const onConfirm = vi.fn();
    render(<BanUserModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "  toxic chat  " },
    });
    fireEvent.click(screen.getByTestId("ban-submit"));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        reason: "toxic chat",
        durationDays: 7,
      });
    });
  });

  it("submit desactive quand loading=true", () => {
    render(<BanUserModal {...defaultProps} loading={true} />);
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "valid" },
    });
    const submit = screen.getByTestId("ban-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toMatch(/envoi/i);
  });

  it("reset reason+duration entre deux ouvertures", () => {
    const { rerender } = render(
      <BanUserModal {...defaultProps} userId="u1" />,
    );
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "first reason" },
    });
    fireEvent.click(screen.getByTestId("ban-duration-30"));

    rerender(<BanUserModal {...defaultProps} userId="u2" />);

    const textarea = screen.getByTestId("ban-reason") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
    // Default revient a 7j.
    const btn7 = screen.getByTestId("ban-duration-7");
    expect(btn7.className).toMatch(/bg-red-600/);
  });

  it("bouton Annuler appelle onClose", () => {
    const onClose = vi.fn();
    render(<BanUserModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /^annuler$/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
