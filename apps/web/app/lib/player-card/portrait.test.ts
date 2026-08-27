import { describe, it, expect, beforeEach, vi } from "vitest";

const readFile = vi.fn();
vi.mock("node:fs/promises", () => {
  const api = { readFile: (p: string) => readFile(p) };
  return { ...api, default: api };
});

// sharp n'est chargé que pour les formats que satori ne décode pas ; on le
// mocke pour tester la conversion sans binaire natif dans le runner jsdom.
const toBuffer = vi.fn();
vi.mock("sharp", () => ({
  default: (input: Buffer) => {
    void input;
    return { png: () => ({ toBuffer }) };
  },
}));

import {
  normalizePortraitPath,
  isSatoriNativeImage,
  loadPortraitDataUri,
  resolveCardImageUrl,
  resetPortraitCache,
} from "./portrait";

beforeEach(() => {
  vi.resetAllMocks();
  resetPortraitCache();
});

describe("normalizePortraitPath", () => {
  it("réécrit le chemin historique des Star Players", () => {
    expect(
      normalizePortraitPath(
        "/data/Star-Players_files/Grombrindal-the-White-Dwarf.webp",
      ),
    ).toBe("/images/star-players/Grombrindal-the-White-Dwarf.webp");
  });

  it("accepte les trois dossiers allowlistés", () => {
    expect(normalizePortraitPath("/images/star-players/a.svg")).toBe(
      "/images/star-players/a.svg",
    );
    expect(normalizePortraitPath("/images/positions/a.png")).toBe(
      "/images/positions/a.png",
    );
    expect(normalizePortraitPath("/images/player-images/a.jpg")).toBe(
      "/images/player-images/a.jpg",
    );
  });

  it("accepte une URL absolue en n'en gardant que le chemin", () => {
    expect(
      normalizePortraitPath("https://nufflearena.fr/images/positions/a.png"),
    ).toBe("/images/positions/a.png");
  });

  it("tolère les apostrophes des noms de fichiers du catalogue", () => {
    expect(normalizePortraitPath("/images/star-players/Morg-'n-Thorg.webp")).toBe(
      "/images/star-players/Morg-'n-Thorg.webp",
    );
  });

  it("rejette un dossier hors allowlist", () => {
    expect(normalizePortraitPath("/images/team-logos/a.png")).toBeNull();
    expect(normalizePortraitPath("/etc/passwd")).toBeNull();
  });

  it("rejette la traversée de dossier, encodée ou non", () => {
    expect(normalizePortraitPath("/images/positions/../../secret.png")).toBeNull();
    expect(normalizePortraitPath("/images/positions/%2e%2e%2fsecret.png")).toBeNull();
    expect(normalizePortraitPath("/images/positions/..")).toBeNull();
  });

  it("rejette une extension non image", () => {
    expect(normalizePortraitPath("/images/positions/a.exe")).toBeNull();
    expect(normalizePortraitPath("/images/positions/a")).toBeNull();
  });

  it("rejette null / vide", () => {
    expect(normalizePortraitPath(null)).toBeNull();
    expect(normalizePortraitPath("")).toBeNull();
    expect(normalizePortraitPath("pas-une-url")).toBeNull();
  });
});

describe("isSatoriNativeImage", () => {
  it("distingue les formats décodés par satori du webp", () => {
    expect(isSatoriNativeImage("/images/positions/a.png")).toBe(true);
    expect(isSatoriNativeImage("/images/positions/a.svg")).toBe(true);
    expect(isSatoriNativeImage("/images/star-players/a.webp")).toBe(false);
    expect(isSatoriNativeImage("/images/star-players/a.avif")).toBe(false);
  });
});

describe("loadPortraitDataUri", () => {
  it("embarque un PNG local tel quel", async () => {
    readFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    const uri = await loadPortraitDataUri("/images/positions/a.png");
    expect(uri).toBe(`data:image/png;base64,${Buffer.from([1, 2, 3]).toString("base64")}`);
    expect(toBuffer).not.toHaveBeenCalled();
  });

  it("transcode un webp en PNG (satori ne le décode pas)", async () => {
    readFile.mockResolvedValue(Buffer.from([9, 9]));
    toBuffer.mockResolvedValue(Buffer.from([7, 7, 7]));
    const uri = await loadPortraitDataUri("/images/star-players/a.webp");
    expect(uri).toBe(`data:image/png;base64,${Buffer.from([7, 7, 7]).toString("base64")}`);
  });

  it("ne relit pas le disque deux fois pour le même portrait", async () => {
    readFile.mockResolvedValue(Buffer.from([1]));
    await loadPortraitDataUri("/images/positions/a.png");
    await loadPortraitDataUri("/images/positions/a.png");
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it("renvoie null quand le fichier est absent", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"));
    expect(await loadPortraitDataUri("/images/positions/a.png")).toBeNull();
  });

  it("renvoie null quand la conversion échoue", async () => {
    readFile.mockResolvedValue(Buffer.from([9]));
    toBuffer.mockRejectedValue(new Error("sharp indisponible"));
    expect(await loadPortraitDataUri("/images/star-players/a.webp")).toBeNull();
  });

  it("refuse un fichier vide ou hors gabarit", async () => {
    readFile.mockResolvedValue(Buffer.alloc(0));
    expect(await loadPortraitDataUri("/images/positions/a.png")).toBeNull();
    resetPortraitCache();
    readFile.mockResolvedValue(Buffer.alloc(9 * 1024 * 1024));
    expect(await loadPortraitDataUri("/images/positions/a.png")).toBeNull();
  });
});

describe("resolveCardImageUrl", () => {
  const origin = "https://nufflearena.fr";

  it("embarque le visuel de catalogue d'une star en data URI", async () => {
    readFile.mockResolvedValue(Buffer.from([1]));
    toBuffer.mockResolvedValue(Buffer.from([2, 2]));
    const src = await resolveCardImageUrl(
      "/data/Star-Players_files/Grombrindal-the-White-Dwarf.webp",
      origin,
    );
    expect(src).toBe(
      `data:image/png;base64,${Buffer.from([2, 2]).toString("base64")}`,
    );
  });

  it("absolutise un chemin local introuvable quand satori sait le décoder", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"));
    expect(
      await resolveCardImageUrl("/images/player-images/photo.png", origin),
    ).toBe("https://nufflearena.fr/images/player-images/photo.png");
  });

  it("abandonne un webp introuvable plutôt que de faire échouer satori", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"));
    expect(
      await resolveCardImageUrl("/images/star-players/a.webp", origin),
    ).toBeUndefined();
  });

  it("laisse passer une URL absolue d'un format décodable", async () => {
    expect(
      await resolveCardImageUrl(
        "https://api.nufflearena.fr/images/player-images/photo.png",
        origin,
      ),
    ).toBe("https://api.nufflearena.fr/images/player-images/photo.png");
  });

  it("écarte une URL absolue en webp", async () => {
    expect(
      await resolveCardImageUrl(
        "https://api.nufflearena.fr/images/player-images/photo.webp",
        origin,
      ),
    ).toBeUndefined();
  });

  it("renvoie undefined sans image", async () => {
    expect(await resolveCardImageUrl(null, origin)).toBeUndefined();
    expect(await resolveCardImageUrl("", origin)).toBeUndefined();
  });
});
