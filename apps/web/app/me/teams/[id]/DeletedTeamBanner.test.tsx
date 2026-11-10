import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DeletedTeamBanner from "./DeletedTeamBanner";

describe("DeletedTeamBanner", () => {
  it("réserve le lien de restauration aux admins", () => {
    render(
      <DeletedTeamBanner
        teamId="t1"
        deletedAt="2026-08-25T12:00:00.000Z"
        isAdmin={false}
      />,
    );
    expect(screen.getByTestId("team-deleted-banner").textContent).toContain(
      "25/08/2026",
    );
    expect(screen.queryByTestId("team-deleted-restore-link")).toBeNull();
  });

  it("reste lisible avec une date illisible", () => {
    render(<DeletedTeamBanner teamId="t1" deletedAt="???" isAdmin />);
    expect(screen.getByTestId("team-deleted-banner").textContent).toContain(
      "Équipe supprimée",
    );
    expect(screen.getByTestId("team-deleted-banner").textContent).not.toContain(
      "Invalid",
    );
  });
});
