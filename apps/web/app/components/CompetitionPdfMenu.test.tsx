import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { downloadMock } = vi.hoisted(() => ({
  downloadMock: vi.fn(() => Promise.resolve()),
}));
vi.mock("../lib/competition-pdf/download", () => ({
  downloadCompetitionPdf: downloadMock,
}));

import CompetitionPdfMenu, { type CompetitionPdfMenuItem } from "./CompetitionPdfMenu";

const request = { kind: "calendar", data: { meta: {}, rounds: [] } } as never;

function items(overrides: Partial<CompetitionPdfMenuItem> = {}): CompetitionPdfMenuItem[] {
  return [
    {
      key: "calendar",
      label: "Calendrier complet",
      build: vi.fn(async () => ({ request, filename: "calendrier.pdf" })),
      ...overrides,
    },
    { key: "bracket", label: "Play-offs", disabled: true, build: vi.fn() },
  ];
}

describe("CompetitionPdfMenu", () => {
  beforeEach(() => vi.resetAllMocks());

  it("ouvre le menu puis construit et télécharge le document choisi", async () => {
    downloadMock.mockResolvedValue(undefined);
    const list = items();
    render(<CompetitionPdfMenu items={list} testId="m" />);
    expect(screen.queryByTestId("m-calendar")).toBeNull();
    fireEvent.click(screen.getByTestId("m-toggle"));
    fireEvent.click(screen.getByTestId("m-calendar"));
    await waitFor(() => expect(downloadMock).toHaveBeenCalledWith(request, "calendrier.pdf"));
    expect(list[0].build).toHaveBeenCalledTimes(1);
    // Le menu se referme après l'export.
    await waitFor(() => expect(screen.queryByTestId("m-calendar")).toBeNull());
  });

  it("désactive une entrée indisponible", () => {
    render(<CompetitionPdfMenu items={items()} testId="m" />);
    fireEvent.click(screen.getByTestId("m-toggle"));
    expect((screen.getByTestId("m-bracket") as HTMLButtonElement).disabled).toBe(true);
  });

  it("affiche l'erreur quand le chargement des données échoue", async () => {
    const list = items({ build: vi.fn(async () => { throw new Error("Bracket introuvable"); }) });
    render(<CompetitionPdfMenu items={list} testId="m" />);
    fireEvent.click(screen.getByTestId("m-toggle"));
    fireEvent.click(screen.getByTestId("m-calendar"));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Bracket introuvable");
    expect(downloadMock).not.toHaveBeenCalled();
  });
});
