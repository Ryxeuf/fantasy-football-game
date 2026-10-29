import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";

// Non-régression du déploiement du 2026-10-29 : `next/font/google`
// téléchargeait les polices pendant `next build` et une URL de fichier
// inattendue renvoyée par Google faisait échouer le build (TypeError dans
// le loader). Les polices sont désormais embarquées dans le repo.

const appDir = path.resolve(__dirname, "..");
const layoutSource = readFileSync(path.join(appDir, "layout.tsx"), "utf8");

function referencedFontPaths(source: string): string[] {
  return [...source.matchAll(/["'](\.\/fonts\/[^"']+\.woff2)["']/g)].map((m) => m[1]);
}

describe("polices auto-hébergées", () => {
  it("le layout ne dépend plus de Google Fonts au build", () => {
    expect(layoutSource).not.toMatch(/from\s+["']next\/font\/google["']/);
    expect(layoutSource).toMatch(/from\s+["']next\/font\/local["']/);
  });

  it("chaque fichier référencé existe et est un WOFF2 valide", () => {
    const paths = referencedFontPaths(layoutSource);
    expect(paths.length).toBe(6);
    for (const rel of paths) {
      const file = path.join(appDir, rel);
      expect(existsSync(file), rel).toBe(true);
      expect(readFileSync(file).subarray(0, 4).toString("latin1"), rel).toBe("wOF2");
    }
  });

  it("garde les variables CSS consommées par tailwind.config.ts", () => {
    for (const variable of [
      "--font-cinzel-decorative",
      "--font-cinzel",
      "--font-montserrat",
      "--font-inter",
      "--font-bebas-neue",
    ]) {
      expect(layoutSource).toContain(`variable: "${variable}"`);
    }
  });
});
