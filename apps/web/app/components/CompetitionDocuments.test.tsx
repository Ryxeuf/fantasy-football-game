/**
 * Tests du panneau « Documents officiels ».
 *
 * Le client API est mocke : ce qui compte ici, c'est la GATE d'affichage
 * (`canManage`), la remontee des erreurs d'upload et le masquage silencieux
 * quand la competition est privee (403).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";

vi.mock("../lib/competition-documents", async () => {
  const actual = await vi.importActual<
    typeof import("../lib/competition-documents")
  >("../lib/competition-documents");
  return {
    ...actual,
    listCompetitionDocuments: vi.fn(),
    uploadCompetitionDocument: vi.fn(),
    updateCompetitionDocument: vi.fn(),
    deleteCompetitionDocument: vi.fn(),
  };
});

import CompetitionDocuments from "./CompetitionDocuments";
import {
  listCompetitionDocuments,
  uploadCompetitionDocument,
  updateCompetitionDocument,
  deleteCompetitionDocument,
  type CompetitionDocument,
} from "../lib/competition-documents";
import { ApiClientError } from "../lib/api-client";

const mockedList = vi.mocked(listCompetitionDocuments);
const mockedUpload = vi.mocked(uploadCompetitionDocument);
const mockedUpdate = vi.mocked(updateCompetitionDocument);
const mockedDelete = vi.mocked(deleteCompetitionDocument);

function doc(over: Partial<CompetitionDocument> = {}): CompetitionDocument {
  return {
    id: "doc-1",
    competitionKind: "league",
    competitionId: "league-1",
    competitionName: "Ligue du Chaos",
    title: "Règlement 2027",
    description: null,
    filename: "reglement-aabbccddeeff.pdf",
    originalName: "reglement.pdf",
    mimeType: "application/pdf",
    bytes: 2048,
    url: "/documents/competitions/reglement-aabbccddeeff.pdf",
    sortOrder: 0,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    uploadedBy: { id: "coach-1", coachName: "Grim" },
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedList.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe("CompetitionDocuments — lecture", () => {
  it("liste les documents avec un lien de telechargement", async () => {
    mockedList.mockResolvedValue([doc()]);
    render(<CompetitionDocuments scope="leagues" competitionId="league-1" />);

    const link = await screen.findByTestId("competition-document-link-doc-1");
    expect(link.getAttribute("href")).toBe(
      "/documents/competitions/reglement-aabbccddeeff.pdf",
    );
    expect(screen.getByText(/déposé par Grim/)).toBeTruthy();
  });

  it("n'affiche rien pour un visiteur quand il n'y a aucun document", async () => {
    render(<CompetitionDocuments scope="cups" competitionId="cup-1" />);
    await waitFor(() => expect(mockedList).toHaveBeenCalled());
    expect(screen.queryByTestId("competition-documents")).toBeNull();
  });

  it("affiche l'etat vide au commissaire (il peut deposer)", async () => {
    render(
      <CompetitionDocuments
        scope="leagues"
        competitionId="league-1"
        canManage
      />,
    );
    expect(
      await screen.findByTestId("competition-documents-empty"),
    ).toBeTruthy();
    expect(screen.getByTestId("competition-documents-upload")).toBeTruthy();
  });

  it("se masque quand la competition est privee (403)", async () => {
    mockedList.mockRejectedValue(new ApiClientError("privé", 403));
    render(
      <CompetitionDocuments
        scope="leagues"
        competitionId="league-1"
        canManage
      />,
    );
    await waitFor(() => expect(mockedList).toHaveBeenCalled());
    expect(screen.queryByTestId("competition-documents")).toBeNull();
  });

  it("remonte une vraie erreur serveur", async () => {
    mockedList.mockRejectedValue(new ApiClientError("boom", 500));
    render(
      <CompetitionDocuments
        scope="leagues"
        competitionId="league-1"
        canManage
      />,
    );
    const err = await screen.findByTestId("competition-documents-error");
    expect(err.textContent).toContain("boom");
  });
});

describe("CompetitionDocuments — gestion", () => {
  it("cache les actions d'edition quand canManage est faux", async () => {
    mockedList.mockResolvedValue([doc()]);
    render(<CompetitionDocuments scope="leagues" competitionId="league-1" />);
    await screen.findByTestId("competition-document-doc-1");
    expect(screen.queryByTestId("competition-documents-upload")).toBeNull();
    expect(
      screen.queryByTestId("competition-document-delete-doc-1"),
    ).toBeNull();
  });

  it("televerse le fichier choisi puis recharge la liste", async () => {
    mockedList.mockResolvedValue([]);
    mockedUpload.mockResolvedValue(doc());
    render(
      <CompetitionDocuments
        scope="leagues"
        competitionId="league-1"
        canManage
      />,
    );
    await screen.findByTestId("competition-documents-empty");

    const file = new File(["%PDF-1.7"], "reglement.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByTestId("competition-documents-input"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(mockedUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "leagues",
          competitionId: "league-1",
          file,
        }),
      ),
    );
    // Un rechargement suit l'upload (1 au montage + 1 apres envoi).
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
  });

  it("signale un fichier refuse sans bloquer les autres", async () => {
    mockedList.mockResolvedValue([]);
    mockedUpload.mockRejectedValue(new Error("Document trop volumineux"));
    render(
      <CompetitionDocuments
        scope="leagues"
        competitionId="league-1"
        canManage
      />,
    );
    await screen.findByTestId("competition-documents-empty");

    fireEvent.change(screen.getByTestId("competition-documents-input"), {
      target: {
        files: [new File(["x"], "gros.pdf", { type: "application/pdf" })],
      },
    });

    const err = await screen.findByTestId("competition-documents-error");
    expect(err.textContent).toContain("Document trop volumineux");
  });

  it("renomme un document", async () => {
    mockedList.mockResolvedValue([doc()]);
    mockedUpdate.mockResolvedValue(doc({ title: "Règlement v2" }));
    render(
      <CompetitionDocuments
        scope="leagues"
        competitionId="league-1"
        canManage
      />,
    );
    fireEvent.click(
      await screen.findByTestId("competition-document-edit-doc-1"),
    );
    fireEvent.change(screen.getByTestId("competition-document-edit-title"), {
      target: { value: "Règlement v2" },
    });
    fireEvent.click(screen.getByTestId("competition-document-save"));

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(
        "leagues",
        "league-1",
        "doc-1",
        expect.objectContaining({ title: "Règlement v2" }),
      ),
    );
  });

  it("supprime un document apres confirmation", async () => {
    mockedList.mockResolvedValue([doc()]);
    mockedDelete.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <CompetitionDocuments
        scope="leagues"
        competitionId="league-1"
        canManage
      />,
    );
    fireEvent.click(
      await screen.findByTestId("competition-document-delete-doc-1"),
    );
    await waitFor(() =>
      expect(mockedDelete).toHaveBeenCalledWith("leagues", "league-1", "doc-1"),
    );
    confirmSpy.mockRestore();
  });

  it("ne supprime rien si la confirmation est refusee", async () => {
    mockedList.mockResolvedValue([doc()]);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <CompetitionDocuments
        scope="leagues"
        competitionId="league-1"
        canManage
      />,
    );
    fireEvent.click(
      await screen.findByTestId("competition-document-delete-doc-1"),
    );
    await waitFor(() => expect(mockedDelete).not.toHaveBeenCalled());
    confirmSpy.mockRestore();
  });
});
