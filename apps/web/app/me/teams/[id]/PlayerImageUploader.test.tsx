/**
 * Upload d'une photo de joueur depuis la fiche d'équipe : binaire brut dans
 * le corps (contrat serveur, comme le logo), retrait, et remontée du
 * changement au parent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlayerImageUploader from "./PlayerImageUploader";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  localStorage.setItem("auth_token", "tok-1");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as unknown as Response;
}

describe("PlayerImageUploader", () => {
  it("poste le fichier brut et remonte l'URL au parent", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { imageUrl: "/images/player-images/boris-abc123456789.png" },
      }),
    );
    const onChange = vi.fn();
    render(
      <PlayerImageUploader
        teamId="t1"
        player={{ id: "p1", name: "Boris" }}
        onChange={onChange}
      />,
    );

    const file = new File([new Uint8Array([1, 2, 3])], "boris.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByTestId("player-image-input-p1"), {
      target: { files: [file] },
    });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/team/t1/players/p1/image");
    expect(opts.method).toBe("POST");
    expect(
      (opts.headers as Record<string, string>).Authorization,
    ).toBe("Bearer tok-1");
    // Le binaire part TEL QUEL dans le corps (pas de multipart).
    expect(opts.body).toBe(file);
    expect(onChange).toHaveBeenCalledWith(
      "p1",
      "/images/player-images/boris-abc123456789.png",
    );
  });

  it("retire la photo (DELETE) et remonte null", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { imageUrl: null } }),
    );
    const onChange = vi.fn();
    render(
      <PlayerImageUploader
        teamId="t1"
        player={{
          id: "p1",
          name: "Boris",
          imageUrl: "/images/player-images/boris-abc123456789.png",
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId("player-image-remove-p1"));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("p1", null));
    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(opts.method).toBe("DELETE");
  });

  it("refuse côté client un fichier > 2 Mo sans appeler le serveur", async () => {
    render(
      <PlayerImageUploader teamId="t1" player={{ id: "p1", name: "Boris" }} />,
    );
    const big = new File([new ArrayBuffer(2 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByTestId("player-image-input-p1"), {
      target: { files: [big] },
    });
    await waitFor(() =>
      expect(screen.getByTestId("player-image-error-p1")).toBeTruthy(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("affiche l'erreur serveur (format refusé)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, error: "Format non supporté" }, false, 415),
    );
    render(
      <PlayerImageUploader teamId="t1" player={{ id: "p1", name: "Boris" }} />,
    );
    const file = new File([new Uint8Array([1])], "x.webp", {
      type: "image/webp",
    });
    fireEvent.change(screen.getByTestId("player-image-input-p1"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(
        screen.getByTestId("player-image-error-p1").getAttribute("title"),
      ).toBe("Format non supporté"),
    );
  });
});
