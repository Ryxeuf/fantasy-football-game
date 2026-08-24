/**
 * Choix du logo dans le builder : aucun envoi réseau, le fichier remonte au
 * parent qui l'uploadera après la création de l'équipe.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TeamLogoPicker from "./TeamLogoPicker";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

function pngFile(sizeBytes = 32, name = "logo.png"): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: "image/png" });
}

describe("TeamLogoPicker", () => {
  it("remonte le fichier choisi sans appeler le réseau", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const onChange = vi.fn();

    render(
      <TeamLogoPicker roster="human" teamName="Reavers" file={null} onChange={onChange} />,
    );

    const file = pngFile();
    fireEvent.change(screen.getByTestId("team-logo-picker-input"), {
      target: { files: [file] },
    });

    expect(onChange).toHaveBeenCalledWith(file);
    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });

  it("refuse un fichier de plus de 2 Mo sans le remonter", () => {
    const onChange = vi.fn();
    render(<TeamLogoPicker roster="human" file={null} onChange={onChange} />);

    fireEvent.change(screen.getByTestId("team-logo-picker-input"), {
      target: { files: [pngFile(2 * 1024 * 1024 + 1)] },
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("team-logo-picker-error").textContent).toContain(
      "2 Mo",
    );
  });

  it("affiche l'aperçu local et le nom du fichier sélectionné", () => {
    const { container } = render(
      <TeamLogoPicker roster="human" file={pngFile(16, "reavers.png")} onChange={vi.fn()} />,
    );

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "blob:preview",
    );
    expect(screen.getByTestId("team-logo-picker-filename").textContent).toBe(
      "reavers.png",
    );
  });

  it("retire la sélection via le bouton Retirer", () => {
    const onChange = vi.fn();
    render(<TeamLogoPicker roster="human" file={pngFile()} onChange={onChange} />);

    fireEvent.click(screen.getByTestId("team-logo-picker-remove"));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("retombe sur le logo de la race quand aucun fichier n'est choisi", () => {
    const { container } = render(
      <TeamLogoPicker roster="human" file={null} onChange={vi.fn()} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.queryByTestId("team-logo-picker-remove")).toBeNull();
  });
});
