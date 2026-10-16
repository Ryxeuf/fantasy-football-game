/**
 * Garde de deploiement — en prod, node est lance DIRECTEMENT.
 *
 * `pnpm run` / `pnpm exec` et la CLI `tsx` restent parents inactifs du vrai
 * processus pendant toute la vie du conteneur : ~48 Mo de memoire anonyme
 * cote server (pnpm + CLI tsx) et ~50 Mo cote web (pnpm), mesures sur les
 * images de prod — memoire que le noyau pousse en swap (alerte
 * HostSwapSaturated sur le serveur OVH).
 *
 * Corollaire : node n'etant plus enfant d'un pnpm, il serait PID 1 et
 * ignorerait SIGTERM. `init: true` met tini en PID 1 dans le compose de prod.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "..", "..", "..");

function lastCmd(dockerfile: string): string {
  const source = readFileSync(join(repoRoot, dockerfile), "utf8");
  const cmds = source.split("\n").filter((line) => line.startsWith("CMD "));
  return cmds[cmds.length - 1] ?? "";
}

/** Bloc YAML d'un service (lignes indentees sous `  <name>:`). */
function serviceBlock(compose: string, name: string): string {
  const lines = compose.split("\n");
  const start = lines.indexOf(`  ${name}:`);
  if (start === -1) return "";
  const end = lines.findIndex(
    (line, i) => i > start && /^ {0,2}\S/.test(line),
  );
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
}

describe("commande de demarrage des images de prod", () => {
  it.each([
    ["Dockerfile.server", "apps/server"],
    ["Dockerfile.web", "apps/web"],
  ])("%s lance node directement depuis %s", (dockerfile, cwd) => {
    const cmd = lastCmd(dockerfile);
    expect(cmd).toContain(`cd ${cwd} && exec node `);
    expect(cmd).not.toMatch(/\bpnpm\b/);
    expect(cmd).not.toMatch(/exec tsx\b|"tsx"/);
  });

  it.each(["web", "server"])(
    "le service %s du compose de prod tourne sous tini (init: true)",
    (service) => {
      const compose = readFileSync(
        join(repoRoot, "docker-compose.prod.yml"),
        "utf8",
      );
      expect(serviceBlock(compose, service)).toMatch(/^ {4}init: true$/m);
    },
  );
});
