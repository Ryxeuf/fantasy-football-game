import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { saveMock, docMock, autoTableMock } = vi.hoisted(() => {
  const saveMock = vi.fn();
  return {
    saveMock,
    docMock: {
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      text: vi.fn(),
      save: saveMock,
    },
    autoTableMock: vi.fn(),
  };
});
vi.mock("jspdf", () => ({ jsPDF: vi.fn(() => docMock) }));
vi.mock("jspdf-autotable", () => ({ default: autoTableMock }));

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
      <MatchdayExport round={round} statusLabel={(s) => s} />
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

  it("genere un PDF (autotable + save) au clic sur Télécharger PDF", () => {
    renderExport();
    fireEvent.click(screen.getByTestId("round-export-round-1"));
    fireEvent.click(screen.getByTestId("matchday-export-pdf-round-1"));
    expect(autoTableMock).toHaveBeenCalledTimes(1);
    const body = autoTableMock.mock.calls[0][1].body;
    expect(body).toEqual([["Orcs", "vs", "Elfes", "played"]]);
    expect(saveMock).toHaveBeenCalledWith("journee-1.pdf");
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
