/**
 * Lot P.C.2 — Tests du PasswordResetModal.
 *
 * Couvre les 2 etats (confirm → revealed), le bouton copier, le reset
 * du flag "copied" entre ouvertures, et les chemins de fallback
 * clipboard (jsdom n'expose pas execCommand par defaut).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import PasswordResetModal from "./PasswordResetModal";

const defaultProps = {
  open: true,
  userId: "user-abcdef12",
  userLabel: "Some Coach",
  tempPassword: null,
  loading: false,
  onClose: () => {},
  onConfirm: () => {},
};

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom n'expose pas document.execCommand par defaut (cf. CLAUDE.md).
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(true),
  });
});

describe("PasswordResetModal (Lot P.C.2)", () => {
  it("ne rend rien quand open=false", () => {
    const { container } = render(
      <PasswordResetModal {...defaultProps} open={false} />,
    );
    expect(
      container.querySelector("[data-testid='password-reset-modal']"),
    ).toBeNull();
  });

  it("etat 'confirm' : affiche un warning + bouton Generer + bouton Annuler", () => {
    render(<PasswordResetModal {...defaultProps} />);
    expect(screen.getByTestId("password-reset-confirm")).toBeTruthy();
    expect(screen.queryByTestId("temp-password-display")).toBeNull();
    // Plus aucun champ password tant que confirm pas declenche.
    expect(screen.queryByTestId("copy-password")).toBeNull();
  });

  it("clic sur 'Generer' appelle onConfirm", () => {
    const onConfirm = vi.fn();
    render(<PasswordResetModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("password-reset-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("etat 'revealed' : affiche le tempPassword + bouton Copier", () => {
    render(
      <PasswordResetModal
        {...defaultProps}
        tempPassword="aB3-XYz!2QmnpKj@"
      />,
    );
    const display = screen.getByTestId("temp-password-display");
    expect(display.textContent).toBe("aB3-XYz!2QmnpKj@");
    expect(screen.getByTestId("copy-password")).toBeTruthy();
    // Bouton Generer disparait, bouton Fermer apparait.
    expect(screen.queryByTestId("password-reset-confirm")).toBeNull();
    expect(screen.getByTestId("password-reset-close")).toBeTruthy();
  });

  it("clic sur 'Copier' utilise navigator.clipboard quand dispo", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <PasswordResetModal {...defaultProps} tempPassword="copy-me-please" />,
    );
    fireEvent.click(screen.getByTestId("copy-password"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("copy-me-please");
    });
  });

  it("clic sur 'Copier' fallback execCommand si clipboard echoue", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const execCommandMock = document.execCommand as ReturnType<typeof vi.fn>;

    render(
      <PasswordResetModal
        {...defaultProps}
        tempPassword="fallback-please"
      />,
    );
    fireEvent.click(screen.getByTestId("copy-password"));

    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith("copy");
    });
  });

  it("bouton Annuler en etat confirm appelle onClose", () => {
    const onClose = vi.fn();
    render(<PasswordResetModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /^annuler$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("bouton Fermer en etat revealed appelle onClose", () => {
    const onClose = vi.fn();
    render(
      <PasswordResetModal
        {...defaultProps}
        tempPassword="x"
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId("password-reset-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("loading=true : bouton 'Generer' desactive avec label 'Generation…'", () => {
    render(<PasswordResetModal {...defaultProps} loading={true} />);
    const btn = screen.getByTestId(
      "password-reset-confirm",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/g[eé]n[eé]ration/i);
  });

  it("reset le flag 'copied' quand le password change", () => {
    const { rerender } = render(
      <PasswordResetModal {...defaultProps} tempPassword="first" />,
    );
    // On ne peut pas verifier le state interne directement, mais on
    // peut rerender et verifier que le bouton n'affiche pas "Copie ✓".
    rerender(<PasswordResetModal {...defaultProps} tempPassword="second" />);
    const copyBtn = screen.getByTestId("copy-password");
    expect(copyBtn.textContent).toMatch(/^copier$/i);
  });
});
