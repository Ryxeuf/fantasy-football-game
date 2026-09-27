import { describe, it, expect, vi, beforeEach } from "vitest";

const { saveMock, docMock, autoTableMock } = vi.hoisted(() => {
  const saveMock = vi.fn();
  return {
    saveMock,
    docMock: { setFontSize: vi.fn(), setTextColor: vi.fn(), text: vi.fn(), save: saveMock },
    autoTableMock: vi.fn(),
  };
});
vi.mock("jspdf", () => ({ jsPDF: vi.fn(() => docMock) }));
vi.mock("jspdf-autotable", () => ({ default: autoTableMock }));

import { exportLegacyMatchdayPdf } from "./matchday-legacy-pdf";

const side = (id: string, name: string, coach?: string) => ({
  id,
  teamId: `t-${id}`,
  team: { id: `t-${id}`, name, roster: "orc", ownerId: `o-${id}`, owner: coach ? { coachName: coach } : undefined },
});

describe("exportLegacyMatchdayPdf (rendu historique, flag OFF)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("produit le tableau brut et le fichier journee-N.pdf", async () => {
    await exportLegacyMatchdayPdf({
      leagueName: "Ligue",
      roundTitle: "J1 — Ouverture",
      roundNumber: 1,
      date: null,
      pairings: [
        {
          id: "p1",
          status: "played",
          scheduledAt: null,
          deadlineAt: null,
          homeParticipant: side("a", "Orcs", "Grukk"),
          awayParticipant: side("b", "Elfes"),
          match: null,
        },
      ],
      statusLabel: (p) => p.status,
      labels: { home: "Domicile", away: "Extérieur", status: "Statut" },
    });
    expect(autoTableMock.mock.calls[0][1].body).toEqual([["Orcs (Grukk)", "vs", "Elfes", "played"]]);
    expect(saveMock).toHaveBeenCalledWith("journee-1.pdf");
  });
});
