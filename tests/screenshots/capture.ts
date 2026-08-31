/**
 * Génère les captures d'écran versionnées de `docs/screenshots/`.
 *
 * 1. rend chaque scène avec `react-dom/server` (les VRAIS composants) ;
 * 2. génère la feuille Tailwind du projet avec le binaire local, en lui
 *    donnant le HTML produit comme unique source de classes (pas de CDN,
 *    donc pas de réseau et un rendu identique à l'app) ;
 * 3. capture avec le Chromium de Playwright.
 */

import { readdirSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import type { Evidence, Scene } from "./scenes";

// Les composants de `apps/web` sont compilés par Next avec le runtime JSX
// AUTOMATIQUE (`jsx: "preserve"`). Transpilés ici par tsx, ils retombent sur
// le runtime CLASSIQUE, qui attend un `React` global. On le pose donc AVANT
// de charger les scènes.
(globalThis as { React?: typeof React }).React = React;
const { SCENES, EVIDENCE } = (await import("./scenes")) as {
  SCENES: readonly Scene[];
  EVIDENCE: readonly Evidence[];
};

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const WEB = join(REPO, "apps/web");
const OUT_DIR = join(REPO, "docs/screenshots");

/**
 * Chemin du Chromium à utiliser. L'environnement peut fournir un navigateur
 * préinstallé dont le build ne correspond pas à celui qu'attend la version
 * de Playwright résolue ici ; on le désigne alors explicitement plutôt que
 * de retélécharger. Sans variable, on laisse Playwright décider.
 */
function chromiumPath(): string | undefined {
  const explicit = process.env.CHROMIUM_PATH;
  if (explicit) return explicit;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root) return undefined;
  try {
    const build = readdirSync(root)
      .filter((entry) => entry.startsWith("chromium-"))
      .sort()
      .at(-1);
    return build ? join(root, build, "chrome-linux/chrome") : undefined;
  } catch {
    return undefined;
  }
}

/** Page complète d'une scène : titre, légende, puis le composant. */
function pageHtml(scene: Scene, css: string): string {
  const body = renderToStaticMarkup(
    React.createElement(
      "div",
      { className: "bg-white" },
      React.createElement(
        "header",
        { className: "border-b bg-nuffle-anthracite px-4 py-3 text-white" },
        React.createElement(
          "h1",
          { className: "text-sm font-bold uppercase tracking-wide" },
          scene.title,
        ),
        React.createElement(
          "p",
          { className: "mt-0.5 text-[11px] text-white/70" },
          scene.caption,
        ),
      ),
      scene.render(),
    ),
  );
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><style>${css}</style></head>
<body class="font-body antialiased">${body}</body>
</html>`;
}

/**
 * Exécute une preuve et retourne sa sortie utile. Un échec de la commande
 * FAIT ÉCHOUER la capture : une preuve d'exécution qui ne passe plus ne doit
 * pas être publiée telle quelle.
 */
async function runEvidence(evidence: Evidence): Promise<string> {
  // Le harnais e2e-api démarre le serveur API en sous-processus et n'en tue
  // que l'enveloppe pnpm à la sortie : sans précaution, un serveur survit à
  // chaque preuve et finit par faire tomber les suivantes. On lance donc la
  // commande dans son PROPRE groupe de processus, et on tue le groupe entier
  // à la fin — aucun filtrage par nom, donc aucun risque de tuer autre chose.
  const output = await new Promise<{ text: string; code: number }>(
    (resolveRun) => {
      const child = spawn(evidence.command, [...evidence.args], {
        cwd: join(REPO, evidence.cwd),
        env: { ...process.env, ...evidence.env },
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let text = "";
      child.stdout.on("data", (c: Buffer) => (text += c.toString()));
      child.stderr.on("data", (c: Buffer) => (text += c.toString()));
      child.on("close", (code) => {
        try {
          if (child.pid) process.kill(-child.pid, "SIGKILL");
        } catch {
          // Groupe déjà éteint.
        }
        resolveRun({ text, code: code ?? 1 });
      });
    },
  );
  if (output.code !== 0) {
    throw new Error(
      `[screenshots] preuve « ${evidence.id} » en échec (code ${output.code}) :\n${output.text}`,
    );
  }
  return output.text.split("\n").filter(evidence.keep).join("\n").trim();
}

/** Scène « terminal » rendant la sortie verbatim d'une preuve. */
function evidenceScene(evidence: Evidence, output: string): Scene {
  return {
    id: evidence.id,
    title: evidence.title,
    caption: evidence.caption,
    width: 1180,
    render: () =>
      React.createElement(
        "div",
        { className: "bg-slate-100 p-4" },
        React.createElement(
          "pre",
          {
            className:
              "overflow-x-auto rounded-lg bg-nuffle-anthracite p-4 text-[12px] leading-5 text-emerald-200",
          },
          output,
        ),
      ),
  };
}

/**
 * Feuille Tailwind couvrant exactement les classes du HTML fourni. On passe
 * par un fichier de contenu jetable plutôt que par la config de l'app :
 * scanner `app/**` produirait une feuille énorme pour rien.
 */
async function buildCss(workDir: string, htmlFiles: string[]): Promise<string> {
  const configPath = join(workDir, "tailwind.config.cjs");
  const inputPath = join(workDir, "input.css");
  const outputPath = join(workDir, "output.css");
  const appConfig = join(WEB, "tailwind.config.ts");
  await writeFile(
    configPath,
    `module.exports = {
  content: ${JSON.stringify(htmlFiles)},
  theme: {
    extend: {
      colors: {
        "nuffle-gold": "#CBA135",
        "nuffle-red": "#7A1F1F",
        "nuffle-ivory": "#E9E2D0",
        "nuffle-anthracite": "#1E1E1E",
        "nuffle-bronze": "#6B4E2E",
      },
      fontFamily: {
        body: ["system-ui", "sans-serif"],
      },
    },
  },
};
// Miroir minimal de ${appConfig} : seules les extensions de thème
// réellement utilisées par les scènes (couleurs Nuffle, police body).
`,
    "utf-8",
  );
  await writeFile(inputPath, "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n", "utf-8");
  await execFileAsync(
    join(WEB, "node_modules/.bin/tailwindcss"),
    ["-c", configPath, "-i", inputPath, "-o", outputPath, "--minify"],
    { cwd: WEB },
  );
  const { readFile } = await import("node:fs/promises");
  return readFile(outputPath, "utf-8");
}

async function main(): Promise<void> {
  const workDir = await mkdtemp(join(tmpdir(), "bb-shots-"));
  await mkdir(OUT_DIR, { recursive: true });

  // Preuves d'exécution : les tests tournent AVANT le rendu, leur sortie
  // devient une scène comme les autres.
  const evidenceScenes: Scene[] = [];
  for (const evidence of EVIDENCE) {
    // eslint-disable-next-line no-console
    console.log(`[screenshots] exécution de ${evidence.id}…`);
    evidenceScenes.push(evidenceScene(evidence, await runEvidence(evidence)));
  }
  const allScenes: readonly Scene[] = [...SCENES, ...evidenceScenes];

  // 1er passage : HTML sans CSS, uniquement pour que Tailwind voie les classes.
  const rawFiles: string[] = [];
  for (const scene of allScenes) {
    const file = join(workDir, `${scene.id}.raw.html`);
    await writeFile(file, pageHtml(scene, ""), "utf-8");
    rawFiles.push(file);
  }
  const css = await buildCss(workDir, rawFiles);

  const browser = await chromium.launch({ executablePath: chromiumPath() });
  try {
    for (const scene of allScenes) {
      const file = join(workDir, `${scene.id}.html`);
      await writeFile(file, pageHtml(scene, css), "utf-8");
      const page = await browser.newPage({
        // Hauteur minimale : `fullPage` étend ensuite jusqu'au contenu, ce
        // qui évite une large bande vide sous les scènes courtes.
        viewport: { width: scene.width, height: 200 },
        deviceScaleFactor: 2,
      });
      await page.goto(`file://${file}`);
      const target = join(OUT_DIR, `${scene.id}.png`);
      await page.screenshot({ path: target, fullPage: true });
      await page.close();
      // eslint-disable-next-line no-console
      console.log(`[screenshots] ${scene.id}.png`);
    }
  } finally {
    await browser.close();
    await rm(workDir, { recursive: true, force: true });
  }
}

void main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});
