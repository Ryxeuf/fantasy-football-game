import { spawn, type ChildProcess } from "node:child_process";

/**
 * Démarre le serveur Express/Socket.IO en mode SQLite in-memory pour la suite E2E API.
 *
 * Réutilise le pattern de tests/integration/setup.ts mais pointe sur un port isolé
 * (18002) et une DB distincte (memdb-e2e) afin que les deux suites puissent tourner
 * en parallèle sur une machine de dev.
 */
const API_PORT = process.env.API_PORT || "18002";
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "file:memdb-e2e?mode=memory&cache=shared";

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerUp(): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${API_PORT}/health`).catch(
      () => null,
    );
    return !!res && res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerUp()) return;
    await wait(200);
  }
  throw new Error(
    `E2E API test server did not become healthy on port ${API_PORT} within ${timeoutMs}ms`,
  );
}

let serverProc: ChildProcess | undefined;

export async function setup(): Promise<void> {
  const g = globalThis as unknown as {
    __e2eApiServerStarted?: boolean;
    __e2eApiServerProc?: ChildProcess;
  };
  if (g.__e2eApiServerStarted) return;

  // Si un serveur est déjà up (ex: dev local), on réutilise.
  if (await isServerUp()) {
    g.__e2eApiServerStarted = true;
  } else {
    serverProc = spawn("pnpm", ["run", "dev:nowatch"], {
      cwd: "../../apps/server",
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        API_PORT,
        TEST_SQLITE: "1",
        TEST_DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET || "e2e-jwt-secret",
        MATCH_SECRET: process.env.MATCH_SECRET || "e2e-match-secret",
      },
    });
    g.__e2eApiServerProc = serverProc;
    await waitForServer();
    g.__e2eApiServerStarted = true;
  }

  // Reset initial garanti
  await fetch(`http://localhost:${API_PORT}/__test/reset`, {
    method: "POST",
  }).catch(() => null);
}

export async function teardown(): Promise<void> {
  const g = globalThis as unknown as {
    __e2eApiServerStarted?: boolean;
    __e2eApiServerProc?: ChildProcess;
  };
  const proc = g.__e2eApiServerProc;
  if (proc) {
    try {
      proc.kill();
    } catch {
      // ignore
    }
    g.__e2eApiServerProc = undefined;
  }
  g.__e2eApiServerStarted = false;
}

// Vitest setup file — exécuté au chargement
await setup();
