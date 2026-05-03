import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CoachExportPdfButton from "./CoachExportPdfButton";
import type { CoachPublicProfile } from "./types";

const baseProfile: CoachPublicProfile = {
  id: "u-1",
  slug: "alpha",
  coachName: "Alpha",
  eloRating: 1500,
  isSupporter: false,
  supporterTier: null,
  memberSince: "2025-01-15T00:00:00.000Z",
  achievements: [],
  recentTeams: [],
};

describe("CoachExportPdfButton (S26.3o)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a button with an accessible label", () => {
    render(
      <CoachExportPdfButton profile={baseProfile} eloSnapshots={[]} />,
    );
    const btn = screen.getByRole("button");
    expect(btn.textContent).toMatch(/pdf/i);
  });

  it("calls the injected exporter with the profile + snapshots when clicked", async () => {
    const exporter = vi.fn().mockResolvedValue(undefined);
    render(
      <CoachExportPdfButton
        profile={baseProfile}
        eloSnapshots={[]}
        exporter={exporter}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(exporter).toHaveBeenCalledTimes(1);
    });
    expect(exporter.mock.calls[0][0]).toBe(baseProfile);
    expect(exporter.mock.calls[0][1]).toEqual([]);
  });

  it("disables itself while the export is in flight", async () => {
    let resolve!: () => void;
    const exporter = vi.fn(
      () => new Promise<void>((r) => {
        resolve = r;
      }),
    );
    render(
      <CoachExportPdfButton
        profile={baseProfile}
        eloSnapshots={[]}
        exporter={exporter}
      />,
    );
    const btn = screen.getByRole("button") as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.disabled).toBe(true);
    });
    resolve();
    await waitFor(() => {
      expect(btn.disabled).toBe(false);
    });
  });

  it("does not crash when the exporter rejects", async () => {
    const exporter = vi.fn().mockRejectedValue(new Error("boom"));
    render(
      <CoachExportPdfButton
        profile={baseProfile}
        eloSnapshots={[]}
        exporter={exporter}
      />,
    );
    const btn = screen.getByRole("button") as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.disabled).toBe(false);
    });
  });
});
