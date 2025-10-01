import { spawn } from "child_process";

const API_PORT = process.env.API_PORT || "18001";
const BGIO_PORT = process.env.BGIO_PORT || "18000";
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "file:memdb1?mode=memory&cache=shared";

let serverProc: any;

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function setup() {
  // Ne démarrer qu'une seule fois
  if ((globalThis as any).__serverStarted) return;
  // Vérifier si up
  try {
    const res = await fetch(`http://localhost:${API_PORT}/health`).catch(
      () => null as any,
    );
    if (res && res.ok) {
      (globalThis as any).__serverStarted = true;
      return;
    }
  } catch {}
  serverProc = spawn("pnpm", ["run", "dev:nowatch"], {
    cwd: "../../apps/server",
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      API_PORT,
      BGIO_PORT,
      TEST_SQLITE: "1",
      TEST_DATABASE_URL,
    },
  });
  (globalThis as any).__serverProc = serverProc;
  await wait(1200);
  // Reset DB avant tests
  await fetch(`http://localhost:${API_PORT}/__test/reset`, {
    method: "POST",
  }).catch(() => null);
  (globalThis as any).__serverStarted = true;
}

export async function teardown() {
  const p = (globalThis as any).__serverProc as any;
  if (p) {
    try {
      p.kill();
    } catch {}
    (globalThis as any).__serverProc = undefined;
  }
  (globalThis as any).__serverStarted = false;
}

// Vitest hooks
await setup();
