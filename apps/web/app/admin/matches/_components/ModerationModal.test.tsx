/**
 * Lot P.B.4 — Tests du modal de moderation (forfait + cancel).
 *
 * Couvre : ouverture, fermeture, choix du winnerSide en mode forfeit,
 * minimum reason validation, payload envoye, etat loading, reset entre
 * deux ouvertures successives.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ModerationModal from "./ModerationModal";

const defaultProps = {
  open: true,
  matchId: "match-abcdef12",
  teamALabel: "Reikland Reavers",
  teamBLabel: "Skavenblight Scramblers",
  loading: false,
  onClose: () => {},
  onConfirm: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ModerationModal (Lot P.B.4)", () => {
  it("ne rend rien quand open=false", () => {
    const { container } = render(
      <ModerationModal {...defaultProps} mode="forfeit" open={false} />,
    );
    expect(container.querySelector("[data-testid='moderation-modal']")).toBeNull();
  });

  it("rend les radios A/B en mode forfeit avec les noms d'equipes", () => {
    render(<ModerationModal {...defaultProps} mode="forfeit" />);
    expect(screen.getByText("Reikland Reavers")).toBeTruthy();
    expect(screen.getByText("Skavenblight Scramblers")).toBeTruthy();
    expect(screen.getByTestId("winner-side-A")).toBeTruthy();
    expect(screen.getByTestId("winner-side-B")).toBeTruthy();
  });

  it("ne rend pas de winnerSide en mode cancel", () => {
    render(<ModerationModal {...defaultProps} mode="cancel" />);
    expect(screen.queryByTestId("winner-side-A")).toBeNull();
    expect(screen.queryByTestId("winner-side-B")).toBeNull();
  });

  it("submit desactive tant que la raison < 3 chars", () => {
    render(<ModerationModal {...defaultProps} mode="forfeit" />);
    const submit = screen.getByTestId("moderation-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByTestId("moderation-reason"), {
      target: { value: "ab" },
    });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByTestId("moderation-reason"), {
      target: { value: "abc" },
    });
    expect(submit.disabled).toBe(false);
  });

  it("submit envoie reason + winnerSide en mode forfeit", async () => {
    const onConfirm = vi.fn();
    render(
      <ModerationModal
        {...defaultProps}
        mode="forfeit"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByTestId("winner-side-B"));
    fireEvent.change(screen.getByTestId("moderation-reason"), {
      target: { value: "no-show 30min" },
    });
    fireEvent.click(screen.getByTestId("moderation-submit"));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        reason: "no-show 30min",
        winnerSide: "B",
      });
    });
  });

  it("submit envoie seulement reason en mode cancel", async () => {
    const onConfirm = vi.fn();
    render(
      <ModerationModal
        {...defaultProps}
        mode="cancel"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByTestId("moderation-reason"), {
      target: { value: "exploit bug critique" },
    });
    fireEvent.click(screen.getByTestId("moderation-submit"));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        reason: "exploit bug critique",
      });
    });
  });

  it("trim la raison avant envoi", async () => {
    const onConfirm = vi.fn();
    render(
      <ModerationModal
        {...defaultProps}
        mode="cancel"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByTestId("moderation-reason"), {
      target: { value: "  exploit bug  " },
    });
    fireEvent.click(screen.getByTestId("moderation-submit"));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({ reason: "exploit bug" });
    });
  });

  it("submit desactive quand loading=true", () => {
    render(
      <ModerationModal {...defaultProps} mode="forfeit" loading={true} />,
    );
    fireEvent.change(screen.getByTestId("moderation-reason"), {
      target: { value: "valid reason" },
    });
    const submit = screen.getByTestId("moderation-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toMatch(/envoi/i);
  });

  it("bouton Annuler appelle onClose", () => {
    const onClose = vi.fn();
    render(
      <ModerationModal {...defaultProps} mode="forfeit" onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^annuler$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("reset reason+winnerSide quand on switche de match", () => {
    const { rerender } = render(
      <ModerationModal {...defaultProps} mode="forfeit" matchId="m1" />,
    );
    fireEvent.change(screen.getByTestId("moderation-reason"), {
      target: { value: "first reason" },
    });
    fireEvent.click(screen.getByTestId("winner-side-B"));

    // Bascule sur un autre match : le state doit etre reset.
    rerender(
      <ModerationModal {...defaultProps} mode="forfeit" matchId="m2" />,
    );
    const textarea = screen.getByTestId(
      "moderation-reason",
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
    const winnerA = screen.getByTestId("winner-side-A") as HTMLInputElement;
    expect(winnerA.checked).toBe(true);
  });
});
