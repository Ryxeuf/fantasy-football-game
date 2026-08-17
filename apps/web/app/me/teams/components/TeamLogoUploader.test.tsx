/**
 * Upload / retrait du logo d'équipe depuis la fiche d'équipe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TeamLogoUploader from "./TeamLogoUploader";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "token", setItem: vi.fn(), removeItem: vi.fn() },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function pngFile(sizeBytes = 32): File {
  return new File([new Uint8Array(sizeBytes)], "logo.png", {
    type: "image/png",
  });
}

describe("TeamLogoUploader", () => {
  it("envoie le binaire brut et affiche le logo renvoyé", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { logoUrl: "/images/team-logos/reavers-abc123abc123.png" },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const onChange = vi.fn();

    const { container } = render(
      <TeamLogoUploader
        teamId="t1"
        roster="human"
        teamName="Reavers"
        onChange={onChange}
      />,
    );

    const file = pngFile();
    fireEvent.change(screen.getByTestId("team-logo-input"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(container.querySelector("img")?.getAttribute("src")).toBe(
        "/images/team-logos/reavers-abc123abc123.png",
      ),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/team/t1/logo");
    expect(init.method).toBe("POST");
    // Le fichier part tel quel (pas de multipart) : contrat du serveur.
    expect(init.body).toBe(file);
    expect(onChange).toHaveBeenCalledWith(
      "/images/team-logos/reavers-abc123abc123.png",
    );
  });

  it("refuse un fichier de plus de 2 Mo sans appeler l'API", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TeamLogoUploader teamId="t1" roster="human" />);
    fireEvent.change(screen.getByTestId("team-logo-input"), {
      target: { files: [pngFile(2 * 1024 * 1024 + 1)] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("team-logo-error").textContent).toContain(
        "2 Mo",
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("remonte l'erreur de l'API", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 415,
      json: async () => ({ success: false, error: "Format non supporté" }),
    }) as unknown as typeof fetch;

    render(<TeamLogoUploader teamId="t1" roster="human" />);
    fireEvent.change(screen.getByTestId("team-logo-input"), {
      target: { files: [pngFile()] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("team-logo-error").textContent).toContain(
        "Format non supporté",
      ),
    );
  });

  it("retire le logo et revient au logo de la race", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { logoUrl: null } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const onChange = vi.fn();

    const { container } = render(
      <TeamLogoUploader
        teamId="t1"
        roster="human"
        initialLogoUrl="/images/team-logos/reavers-abc123abc123.png"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId("team-logo-remove"));

    await waitFor(() => expect(container.querySelector("img")).toBeNull());
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(onChange).toHaveBeenCalledWith(null);
    // Repli : le logo programmatique du roster est monté.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("n'offre pas le retrait quand l'équipe n'a pas de logo", () => {
    render(<TeamLogoUploader teamId="t1" roster="human" />);
    expect(screen.queryByTestId("team-logo-remove")).toBeNull();
  });
});
