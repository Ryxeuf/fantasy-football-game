/**
 * CPU profiler pour les slow sims (Lot 4.A.2).
 *
 * Strategie
 * ---------
 * Quand `PRO_LEAGUE_PROFILE_SLOW_SIMS=1` est positionne, on :
 *  1. demarre une session inspector V8 avant `simulateMatch`,
 *  2. l'arrete apres la sim (recupere le profile),
 *  3. ne le sauvegarde sur disque QUE si la duree depasse le seuil
 *     (sinon on jette le profile pour ne pas saturer le disque).
 *
 * Le `.cpuprofile` produit est ouvrable directement dans Chrome
 * DevTools (Performance > Load profile...) pour identifier les
 * fonctions qui consomment le plus de temps.
 *
 * Architecture
 * ------------
 *  - `InspectorAdapter` : interface DI pour `node:inspector` Session.
 *    Permet de mocker dans les tests sans demarrer une vraie session V8.
 *  - `nodeInspectorAdapter()` : factory qui retourne un adapter reel.
 *  - `CpuProfilerSession` : FSM idle -> recording -> stopped.
 *  - `captureProfileIfSlow()` : decide save/discard selon le seuil.
 *  - `buildProfileFilename()` : pure, formatte le path canonical.
 *
 * Tradeoffs
 * ---------
 * Le profiler V8 a un overhead de ~5-10% sur le temps CPU. On l'active
 * uniquement quand opt-in (env), et seul un sample par tick (single-
 * threaded) au max. Les tests Vitest n'allument pas le real adapter.
 */

import { Session } from "node:inspector";

/** Adapter pour `node:inspector`, mockable en test. */
export interface InspectorAdapter {
  /** Demarre Profiler.enable + Profiler.start. */
  start(): Promise<void>;
  /** Stop Profiler, retourne le profile JSON brut. */
  stop(): Promise<object>;
  /** Disconnect la session inspector (optionnel). */
  dispose(): void;
}

/**
 * Factory pour un adapter `node:inspector` reel. A utiliser uniquement
 * cote prod / dev local — les tests injectent un mock.
 */
export function nodeInspectorAdapter(): InspectorAdapter {
  const session = new Session();
  let connected = false;

  function ensureConnected(): void {
    if (!connected) {
      session.connect();
      connected = true;
    }
  }

  return {
    async start() {
      ensureConnected();
      await new Promise<void>((resolve, reject) => {
        session.post("Profiler.enable", (err) =>
          err ? reject(err) : resolve(),
        );
      });
      await new Promise<void>((resolve, reject) => {
        session.post("Profiler.start", (err) =>
          err ? reject(err) : resolve(),
        );
      });
    },
    async stop() {
      const result = await new Promise<{ profile: object }>(
        (resolve, reject) => {
          session.post("Profiler.stop", (err, params) =>
            err ? reject(err) : resolve(params as { profile: object }),
          );
        },
      );
      return result.profile;
    },
    dispose() {
      if (connected) {
        session.disconnect();
        connected = false;
      }
    },
  };
}

export type CpuProfilerState = "idle" | "recording" | "stopped";

/**
 * Wrapper FSM autour d'un `InspectorAdapter`. Une instance correspond
 * a une seule sim (start -> stop). Apres `stop`, l'instance est
 * inutilisable — creer un nouveau session pour le sim suivant.
 */
export class CpuProfilerSession {
  private _state: CpuProfilerState = "idle";

  constructor(private readonly adapter: InspectorAdapter) {}

  get state(): CpuProfilerState {
    return this._state;
  }

  async start(): Promise<void> {
    if (this._state !== "idle") {
      throw new Error(
        `CpuProfilerSession: cannot start, already ${this._state}`,
      );
    }
    await this.adapter.start();
    this._state = "recording";
  }

  async stop(): Promise<object> {
    if (this._state !== "recording") {
      throw new Error(
        `CpuProfilerSession: not recording (state=${this._state})`,
      );
    }
    const profile = await this.adapter.stop();
    this._state = "stopped";
    return profile;
  }

  dispose(): void {
    this.adapter.dispose();
  }
}

/**
 * Construit le filename canonical pour un profile : `<matchId>-<timestamp>.cpuprofile`.
 * Sanitize les caracteres interdits sur certains FS (slash, colon, espace).
 */
export function buildProfileFilename(matchId: string, at: Date): string {
  const safeId = matchId.replace(/[^a-zA-Z0-9_-]/g, "_");
  // ISO sans le `.NNNZ` final + colons remplaces (FS Windows-friendly).
  const iso = at.toISOString().slice(0, 19).replace(/:/g, "-");
  return `${safeId}-${iso}.cpuprofile`;
}

export interface CaptureProfileIfSlowInput {
  readonly profile: object | null | undefined;
  readonly matchId: string;
  readonly durationSec: number;
  readonly thresholdSec: number;
  readonly profileDir: string;
  /** DI : permet aux tests d'eviter le vrai writeFile. */
  readonly writeFile: (path: string, data: string) => Promise<void>;
  /** DI : override de `new Date()` pour la determinisme test. */
  readonly now?: () => Date;
}

export interface CaptureProfileIfSlowResult {
  readonly saved: boolean;
  readonly path: string | null;
  readonly error?: string;
}

/**
 * Decide save/discard du profile selon le seuil. Si saved, ecrit le
 * profile JSON dans `<profileDir>/<filename>` via le `writeFile`
 * injecte. Erreur isolee : ne propage pas, retourne `error` dans le
 * resultat (pour que le caller sim-runner ne crashe pas a cause d'un
 * disque plein ou similaire).
 */
export async function captureProfileIfSlow(
  input: CaptureProfileIfSlowInput,
): Promise<CaptureProfileIfSlowResult> {
  if (input.durationSec <= input.thresholdSec) {
    return { saved: false, path: null };
  }
  if (!input.profile) {
    return { saved: false, path: null };
  }
  const at = input.now ? input.now() : new Date();
  const filename = buildProfileFilename(input.matchId, at);
  // Path naïf (no `path.join` pour rester pure / sans node:path) — le
  // profileDir peut deja se terminer par "/".
  const sep = input.profileDir.endsWith("/") ? "" : "/";
  const fullPath = `${input.profileDir}${sep}${filename}`;
  try {
    await input.writeFile(fullPath, JSON.stringify(input.profile));
    return { saved: true, path: fullPath };
  } catch (err: unknown) {
    return {
      saved: false,
      path: null,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
