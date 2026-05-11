/**
 * Tests du CreateSeasonModal.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import CreateSeasonModal from "./CreateSeasonModal";

const defaultProps = {
  open: true,
  loading: false,
  onClose: () => {},
  onConfirm: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CreateSeasonModal", () => {
  it("ne rend rien si open=false", () => {
    const { container } = render(
      <CreateSeasonModal {...defaultProps} open={false} />,
    );
    expect(
      container.querySelector("[data-testid='create-season-modal']"),
    ).toBeNull();
  });

  it("year default = currentYear, autoSchedule default = true", () => {
    render(<CreateSeasonModal {...defaultProps} />);
    const input = screen.getByTestId("create-year") as HTMLInputElement;
    expect(parseInt(input.value, 10)).toBe(new Date().getFullYear());
    const cb = screen.getByTestId("create-auto-schedule") as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });

  it("submit envoie year + driverKind + autoSchedule", async () => {
    const onConfirm = vi.fn();
    render(<CreateSeasonModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByTestId("create-year"), {
      target: { value: "2027" },
    });
    fireEvent.click(screen.getByTestId("create-driver-full"));
    fireEvent.click(screen.getByTestId("create-auto-schedule")); // uncheck
    fireEvent.click(screen.getByTestId("create-submit"));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        year: 2027,
        driverKind: "full",
        autoSchedule: false,
      });
    });
  });

  it("submit disabled si year hors bornes (<2020)", () => {
    render(<CreateSeasonModal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("create-year"), {
      target: { value: "1999" },
    });
    const btn = screen.getByTestId("create-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("loading=true desactive submit + label", () => {
    render(<CreateSeasonModal {...defaultProps} loading={true} />);
    const btn = screen.getByTestId("create-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/creation/i);
  });

  it("reset year + autoSchedule entre 2 ouvertures", () => {
    const { rerender } = render(
      <CreateSeasonModal {...defaultProps} open={true} />,
    );
    fireEvent.change(screen.getByTestId("create-year"), {
      target: { value: "2030" },
    });
    fireEvent.click(screen.getByTestId("create-auto-schedule")); // uncheck

    rerender(<CreateSeasonModal {...defaultProps} open={false} />);
    rerender(<CreateSeasonModal {...defaultProps} open={true} />);

    const input = screen.getByTestId("create-year") as HTMLInputElement;
    expect(parseInt(input.value, 10)).toBe(new Date().getFullYear());
    const cb = screen.getByTestId("create-auto-schedule") as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });

  it("bouton Annuler appelle onClose", () => {
    const onClose = vi.fn();
    render(<CreateSeasonModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /^annuler$/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
