/**
 * Tests du client des documents officiels. `apiRequest` est mocke : ce qui
 * compte est la FORME de l'appel (chemin, query, corps binaire) et le
 * garde-fou de taille cote client.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class extends Error {},
}));

import { apiRequest } from "./api-client";
import {
  deleteCompetitionDocument,
  formatDocumentSize,
  isImageDocument,
  listCompetitionDocuments,
  MAX_COMPETITION_DOCUMENT_BYTES,
  updateCompetitionDocument,
  uploadCompetitionDocument,
  uploadPendingCompetitionDocuments,
  type CompetitionDocument,
} from "./competition-documents";

const mockedRequest = vi.mocked(apiRequest);

function pdfFile(name = "reglement.pdf", size = 2048): File {
  const file = new File(["%PDF-1.7"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function doc(over: Partial<CompetitionDocument> = {}): CompetitionDocument {
  return {
    id: "doc-1",
    competitionKind: "league",
    competitionId: "league-1",
    competitionName: "L",
    title: "Règlement",
    description: null,
    filename: "reglement-aabbccddeeff.pdf",
    originalName: "reglement.pdf",
    mimeType: "application/pdf",
    bytes: 2048,
    url: "/documents/competitions/reglement-aabbccddeeff.pdf",
    sortOrder: 0,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    uploadedBy: null,
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listCompetitionDocuments", () => {
  it("appelle la route de la famille demandee", async () => {
    mockedRequest.mockResolvedValue({ documents: [doc()] });
    const list = await listCompetitionDocuments("cups", "cup 1");
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/competitions/cups/cup%201/documents",
    );
    expect(list).toHaveLength(1);
  });
});

describe("uploadCompetitionDocument", () => {
  it("envoie le fichier brut avec son type et son nom en query", async () => {
    mockedRequest.mockResolvedValue({ document: doc() });
    const file = pdfFile();
    await uploadCompetitionDocument({
      scope: "leagues",
      competitionId: "league-1",
      file,
      title: "Règlement",
    });
    const [path, init] = mockedRequest.mock.calls[0];
    expect(path).toContain("/api/competitions/leagues/league-1/documents?");
    expect(path).toContain("filename=reglement.pdf");
    expect(path).toContain("title=R%C3%A8glement");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(file);
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/pdf",
    );
  });

  it("refuse un fichier vide sans appeler l'API", async () => {
    await expect(
      uploadCompetitionDocument({
        scope: "leagues",
        competitionId: "league-1",
        file: pdfFile("vide.pdf", 0),
      }),
    ).rejects.toThrow("Fichier vide");
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it("refuse un fichier de plus de 10 Mo sans appeler l'API", async () => {
    await expect(
      uploadCompetitionDocument({
        scope: "leagues",
        competitionId: "league-1",
        file: pdfFile("gros.pdf", MAX_COMPETITION_DOCUMENT_BYTES + 1),
      }),
    ).rejects.toThrow(/10 Mo/);
    expect(mockedRequest).not.toHaveBeenCalled();
  });
});

describe("updateCompetitionDocument / deleteCompetitionDocument", () => {
  it("PATCH le document cible", async () => {
    mockedRequest.mockResolvedValue({ document: doc({ title: "v2" }) });
    await updateCompetitionDocument("leagues", "league-1", "doc-1", {
      title: "v2",
    });
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/competitions/leagues/league-1/documents/doc-1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("DELETE le document cible", async () => {
    mockedRequest.mockResolvedValue({ deleted: true });
    await deleteCompetitionDocument("cups", "cup-1", "doc-1");
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/competitions/cups/cup-1/documents/doc-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("uploadPendingCompetitionDocuments", () => {
  it("rend la liste vide quand tout passe", async () => {
    mockedRequest.mockResolvedValue({ document: doc() });
    const failures = await uploadPendingCompetitionDocuments(
      "leagues",
      "league-1",
      [pdfFile("a.pdf"), pdfFile("b.pdf")],
    );
    expect(failures).toEqual([]);
    expect(mockedRequest).toHaveBeenCalledTimes(2);
  });

  it("collecte les echecs sans lever (la competition est deja creee)", async () => {
    mockedRequest
      .mockResolvedValueOnce({ document: doc() })
      .mockRejectedValueOnce(new Error("boom"));
    const failures = await uploadPendingCompetitionDocuments(
      "leagues",
      "league-1",
      [pdfFile("a.pdf"), pdfFile("b.pdf")],
    );
    expect(failures).toEqual(["b.pdf : boom"]);
  });
});

describe("helpers d'affichage", () => {
  it("formate les tailles", () => {
    expect(formatDocumentSize(512)).toBe("512 o");
    expect(formatDocumentSize(2048)).toBe("2 Ko");
    expect(formatDocumentSize(3 * 1024 * 1024)).toBe("3.0 Mo");
  });

  it("distingue une image d'un PDF", () => {
    expect(isImageDocument(doc({ mimeType: "image/png" }))).toBe(true);
    expect(isImageDocument(doc())).toBe(false);
  });
});
