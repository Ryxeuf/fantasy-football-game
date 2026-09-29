import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "f1" }),
}));

vi.mock("../../../lib/featureFlags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/featureFlags")>();
  return {
    ...actual,
    adminListFlags: vi.fn(),
    adminListFlagUsers: vi.fn(),
    adminAddFlagUser: vi.fn(),
    adminRemoveFlagUser: vi.fn(),
  };
});

import AdminFeatureFlagDetailPage from "./page";
import {
  adminListFlagUsers,
  adminListFlags,
  adminRemoveFlagUser,
  type FeatureFlagUser,
} from "../../../lib/featureFlags";

const LONG_EMAIL = "commissaire.general.tres.long@exemple-de-domaine.fr";

function override(userId: string, email: string): FeatureFlagUser {
  return { id: `o-${userId}`, userId, email, coachName: "Coach", createdAt: "2026-09-20T10:00:00.000Z" };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(adminListFlags).mockResolvedValue([
    {
      id: "f1",
      key: "home_news_ticker",
      description: null,
      enabled: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      userOverrideCount: 2,
    },
  ]);
  vi.mocked(adminListFlagUsers).mockResolvedValue([
    override("u1", LONG_EMAIL),
    override("u2", "coach@exemple.fr"),
  ]);
});

describe("AdminFeatureFlagDetailPage — overrides sur mobile", () => {
  it("liste les overrides sans tableau, chacun avec son bouton Retirer", async () => {
    const { container } = render(<AdminFeatureFlagDetailPage />);

    const row = await screen.findByTestId("flag-override-u1");
    // Le tableau rejetait « Retirer » hors de la carte sur mobile.
    expect(container.querySelector("table")).toBeNull();
    expect(row.textContent).toContain(LONG_EMAIL);
    expect(
      within(row).getByRole("button", { name: `Retirer l'override de ${LONG_EMAIL}` }),
    ).toBeTruthy();
    expect(screen.getByTestId("flag-override-u2")).toBeTruthy();
  });

  it("retire un override", async () => {
    vi.mocked(adminRemoveFlagUser).mockResolvedValue(undefined);
    render(<AdminFeatureFlagDetailPage />);

    const row = await screen.findByTestId("flag-override-u1");
    fireEvent.click(within(row).getByRole("button", { name: /Retirer/ }));

    await waitFor(() => expect(screen.queryByTestId("flag-override-u1")).toBeNull());
    expect(adminRemoveFlagUser).toHaveBeenCalledWith("f1", "u1");
    expect(screen.getByTestId("flag-override-u2")).toBeTruthy();
  });
});
