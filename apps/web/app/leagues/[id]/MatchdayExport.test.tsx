import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { downloadMock } = vi.hoisted(() => ({
  downloadMock: vi.fn(() => Promise.resolve()),
}));
vi.mock("../../lib/competition-pdf/download", async (orig) => ({
  ...(await orig<typeof import("../../lib/competition-pdf/download")>()),
  downloadCompetitionPdf: downloadMock,
}));

import { LanguageProvider } from "../../contexts/LanguageContext";
import { MatchdayExport } from "./MatchdayExport";
import type { LeagueRoundDetail } from "./types";

function team(id: string, name: string) {
  return { id, teamId: `t-${id}`, team: { id: `t-${id}`, name, roster: "orc", ownerId: `o-${id}` } };
}

const round: LeagueRoundDetail = {
  id: "round-1",
  roundNumber: 1,
  name: "Ouverture",
  status: "scheduled",
  startDate: null,
  endDate: null,
  pairings: [
    {
      id: "p1",
      status: "played",
      scheduledAt: null,
      deadlineAt: null,
      homeParticipant: team("a", "Orcs"),
      awayParticipant: team("b", "Elfes"),
      match: { id: "m1", status: "completed", mode: "offline" },
    },
  ],
};

function renderExport() {
  render(
    <LanguageProvider>
      <MatchdayExport round={round} statusLabel={(p) => p.status} />
    </LanguageProvider>,
  );
}

describe("MatchdayExport (W-C)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ouvre la feuille imprimable au clic sur Exporter", () => {
    renderExport();
    expect(screen.queryByTestId("matchday-export-modal-round-1")).toBeNull();
    fireEvent.click(screen.getByTestId("round-export-round-1"));
    const modal = screen.getByTestId("matchday-export-modal-round-1");
    expect(modal).toBeTruthy();
    // La feuille liste le pairing.
    expect(modal.textContent).toContain("Orcs");
    expect(modal.textContent).toContain("Elfes");
  });

  it("genere le PDF de la journee (gabarit commun) au clic sur Télécharger PDF", () => {
    renderExport();
    fireEvent.click(screen.getByTestId("round-export-round-1"));
    fireEvent.click(screen.getByTestId("matchday-export-pdf-round-1"));
    expect(downloadMock).toHaveBeenCalledTimes(1);
    const [request, filename] = downloadMock.mock.calls[0] as unknown as [
      { kind: string; data: { round: { title: string; groups: Array<{ fixtures: Array<{ home: { name: string }; away: { name: string } }> }> } } },
      string,
    ];
    expect(request.kind).toBe("matchday");
    expect(request.data.round.title).toBe("Journée 1 - Ouverture");
    const fixture = request.data.round.groups[0].fixtures[0];
    expect(fixture.home.name).toBe("Orcs");
    expect(fixture.away.name).toBe("Elfes");
    expect(filename).toBe("journee-ligue-j1.pdf");
  });

  it("declenche l'impression au clic sur Imprimer", () => {
    const printSpy = vi.fn();
    Object.defineProperty(window, "print", {
      configurable: true,
      writable: true,
      value: printSpy,
    });
    renderExport();
    fireEvent.click(screen.getByTestId("round-export-round-1"));
    fireEvent.click(screen.getByTestId("matchday-export-print-round-1"));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
