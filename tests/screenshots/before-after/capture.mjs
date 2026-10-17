// Captures des écrans de coupe pour UNE version (avant ou après).
//
//   node capture.mjs <port web> <ids.json> <dossier de sortie>
//
// Pages entières (fiche de roster, pronostics, statistiques, matchs à
// valider) puis découpes de la page de coupe calées sur ses titres :
// inscrits, rondes, palmarès d'une coupe terminée.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const [, , port, idsPath, outDir] = process.argv;
const ids = JSON.parse(readFileSync(idsPath, "utf8"));
mkdirSync(outDir, { recursive: true });
const base = `http://localhost:${port}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: "fr-FR",
});
await context.addInitScript((token) => {
  window.localStorage.setItem("auth_token", token);
}, ids.commishToken);
const page = await context.newPage();

async function open(path) {
  await page.goto(base + path, { waitUntil: "networkidle", timeout: 120_000 }).catch(() => {});
  // Les écrans chargent leurs données côté client.
  await page.waitForTimeout(2500);
}

async function topOf(selector) {
  const box = await page.locator(selector).first().boundingBox();
  const scroll = await page.evaluate(() => window.scrollY);
  return box ? box.y + scroll : 0;
}

async function clip(name, y0, y1) {
  await page.screenshot({
    path: `${outDir}/${name}.png`,
    fullPage: true,
    clip: { x: 0, y: Math.max(0, y0), width: 1280, height: Math.max(50, y1 - y0) },
  });
}

for (const [name, path] of [
  ["roster", `/cups/${ids.cupId}/teams/${ids.p1Home}`],
  ["pronostics", `/cups/${ids.cupId}/predictions`],
  ["stats", `/cups/${ids.cupId}/stats`],
  ["a-valider", `/cups/${ids.cupId}/pending-validations`],
]) {
  await open(path);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
}

await open(`/cups/${ids.cupId}`);
const teams = await topOf('h2:has-text("Équipes inscrites")');
const pools = await topOf('h2:has-text("Poules")');
const standings = await topOf('h2:text-is("Classement")');
await clip("inscrits", teams - 24, pools - 24);
await clip("rondes", pools + 70, standings - 20);

await open(`/cups/${ids.autumnId}`);
await clip("palmares", 96, (await topOf('h2:has-text("Informations")')) - 30);

await browser.close();
