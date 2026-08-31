/**
 * Chargement du logo du site pour les images OG.
 *
 * L'invariant qui compte : un échec de lecture ne doit ni lever, ni être
 * mémorisé — la carte se rend sans logo, et la lecture suivante réessaie.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));

vi.mock("node:fs/promises", () => ({ default: { readFile }, readFile }));

import { loadSiteOgLogo, resetSiteOgLogoCache } from "./og-site-logo";

beforeEach(() => {
  vi.resetAllMocks();
  resetSiteOgLogoCache();
});

describe("loadSiteOgLogo", () => {
  it("rend le fichier en data URI PNG", async () => {
    readFile.mockResolvedValue(Buffer.from("PNGBYTES"));
    expect(await loadSiteOgLogo()).toBe(
      `data:image/png;base64,${Buffer.from("PNGBYTES").toString("base64")}`,
    );
  });

  it("ne relit pas le fichier une fois chargé", async () => {
    readFile.mockResolvedValue(Buffer.from("PNGBYTES"));
    await loadSiteOgLogo();
    await loadSiteOgLogo();
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it("rend null sans lever quand la lecture échoue", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"));
    await expect(loadSiteOgLogo()).resolves.toBeNull();
  });

  it("ne mémorise pas un échec : la lecture suivante réessaie", async () => {
    readFile.mockRejectedValueOnce(new Error("ENOENT"));
    expect(await loadSiteOgLogo()).toBeNull();

    readFile.mockResolvedValue(Buffer.from("PNGBYTES"));
    expect(await loadSiteOgLogo()).toContain("data:image/png;base64,");
  });
});
