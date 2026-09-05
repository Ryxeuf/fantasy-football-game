/**
 * Tests du selecteur de documents utilise a la CREATION d'une competition.
 * Le composant est controle : il n'appelle aucune API, il ne fait qu'empiler
 * et retirer des fichiers, en signalant ceux qui depassent 10 Mo.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import PendingCompetitionDocuments from "./PendingCompetitionDocuments";
import { MAX_COMPETITION_DOCUMENT_BYTES } from "../lib/competition-documents";

function pdf(name: string, size = 1024): File {
  const file = new File(["%PDF-1.7"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

afterEach(() => cleanup());

describe("PendingCompetitionDocuments", () => {
  it("empile les fichiers choisis", () => {
    const onChange = vi.fn();
    render(<PendingCompetitionDocuments files={[]} onChange={onChange} />);
    const file = pdf("reglement.pdf");
    fireEvent.change(
      screen.getByTestId("pending-competition-documents-input"),
      { target: { files: [file] } },
    );
    expect(onChange).toHaveBeenCalledWith([file]);
  });

  it("ignore un doublon (meme nom et meme taille)", () => {
    const existing = pdf("reglement.pdf");
    const onChange = vi.fn();
    render(
      <PendingCompetitionDocuments files={[existing]} onChange={onChange} />,
    );
    fireEvent.change(
      screen.getByTestId("pending-competition-documents-input"),
      { target: { files: [pdf("reglement.pdf")] } },
    );
    expect(onChange).toHaveBeenCalledWith([existing]);
  });

  it("retire un fichier de la liste", () => {
    const a = pdf("a.pdf");
    const b = pdf("b.pdf");
    const onChange = vi.fn();
    render(<PendingCompetitionDocuments files={[a, b]} onChange={onChange} />);
    fireEvent.click(
      screen.getByTestId("pending-competition-document-remove-0"),
    );
    expect(onChange).toHaveBeenCalledWith([b]);
  });

  it("signale visuellement un fichier au-dela de 10 Mo", () => {
    const big = pdf("gros.pdf", MAX_COMPETITION_DOCUMENT_BYTES + 1);
    render(<PendingCompetitionDocuments files={[big]} onChange={vi.fn()} />);
    expect(
      screen.getByTestId("pending-competition-documents-list").textContent,
    ).toContain("trop volumineux");
  });
});
