import { spawn, type ChildProcess } from "child_process";

/**
 * Cycle de vie du serveur de test, pour TOUTE la suite d'intégration.
 *
 * C'est un `globalSetup`, et non un `setupFiles` : Vitest n'appelle
 * `teardown` que sur un globalSetup. Le module précédent exportait bien un
 * `teardown`, mais depuis un `setupFiles` — il n'était donc JAMAIS exécuté,
 * et chaque exécution de la suite laissait un serveur vivant derrière elle.
 * Ils s'accumulaient au fil des lancements, jusqu'à saturer la machine.
 */
const API_PORT = process.env.API_PORT || "18001";
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "file:memdb1?mode=memory&cache=shared";

let serverProc: ChildProcess | undefined;

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

/**
 * Attend que le serveur réponde vraiment.
 *
 * Le démarrage était un `await wait(1200)` en aveugle : sur un poste lent ou
 * un premier lancement (tsx compile tout le serveur), 1,2 s ne suffisent pas
 * et toutes les specs qui parlent à l'API échouaient en `ECONNREFUSED`.
 */
async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerUp()) return;
    await wait(200);
  }
  throw new Error(
    `Le serveur de test d'intégration n'a pas répondu sur le port ${API_PORT} en ${timeoutMs} ms`,
  );
}

export async function setup(): Promise<void> {
  // Un serveur déjà démarré (dev local) est réutilisé tel quel.
  if (await isServerUp()) return;

  // Le serveur est lancé DIRECTEMENT (`tsx src/index.ts`, ce que fait le
  // script `dev:nowatch`) plutôt que via `pnpm run` : chaque enveloppe ajoute
  // un processus intermédiaire, et tuer le groupe ne rattrapait que `pnpm` —
  // le `sh -c` et le node de dessous survivaient.
  //
  // `detached` fait du serveur le chef de SON groupe de processus, ce qui
  // permet au teardown de tuer le groupe entier.
  serverProc = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: "../../apps/server",
    stdio: "inherit",
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      API_PORT,
      TEST_SQLITE: "1",
      TEST_DATABASE_URL,
      FEATURE_FLAGS_FORCE_ENABLED:
        process.env.FEATURE_FLAGS_FORCE_ENABLED ?? "true",
    },
  });
  await waitForServer();

  await fetch(`http://localhost:${API_PORT}/__test/reset`, {
    method: "POST",
  }).catch(() => null);
}

export async function teardown(): Promise<void> {
  if (!serverProc?.pid) return;
  try {
    if (process.platform === "win32") {
      serverProc.kill();
    } else {
      // Le groupe entier, pas seulement le processus de tête.
      process.kill(-serverProc.pid, "SIGKILL");
    }
  } catch {
    // Déjà éteint.
  }
  serverProc = undefined;
}
