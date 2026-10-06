/**
 * Lot 5 « exploitation » — POOL de `worker_threads` pour les simulations.
 *
 * Jusqu'ici le cron du serveur appelait `simulateMatch` EN SYNCHRONE sur
 * l'event loop : une seconde par match, cinquante matchs pour un jeu de
 * cotes, et pendant ce temps aucune requête HTTP n'était servie. Le pool
 * sort les simulations de l'event loop et les parallélise sur N threads
 * (décision 5 de l'exploration : « ≤ 30 s par match, pool de
 * `worker_threads`, pas de file de jobs tant que 8 matchs par semaine »).
 *
 *  - `simulate(input, options)` rend une promesse ; les demandes au-delà
 *    du nombre de workers attendent dans une file FIFO en mémoire.
 *  - Un worker qui MEURT (exception hors `try`, OOM) fait échouer sa tâche
 *    en cours, et un worker neuf le remplace : le pool ne s'éteint jamais
 *    de lui-même.
 *  - `close()` termine les workers ; les tâches en attente sont rejetées.
 *
 * Le worker est lancé par une amorce JavaScript (`sim-worker-boot.mjs`) qui
 * enregistre tsx dans le thread avant de charger `sim-worker.ts` : le paquet
 * est servi en TypeScript source, et les hooks tsx hérités par `execArgv` ne
 * résolvent pas les imports sans extension dans un worker.
 */

import os from 'node:os';
import { Worker } from 'node:worker_threads';

import type { SimInput, SimResult } from '../types';

import type { SimPoolOptions, SimPoolRequest, SimPoolResponse } from './protocol';

export interface SimPoolConfig {
  /** Nombre de workers (défaut : `os.availableParallelism() - 1`, au moins 1). */
  readonly size?: number;
  /** Options appliquées à chaque simulation sauf surcharge. */
  readonly defaults?: SimPoolOptions;
}

export interface SimPoolStats {
  readonly size: number;
  readonly busy: number;
  readonly queued: number;
  readonly completed: number;
  readonly failed: number;
  /** Workers remplacés après une mort inattendue. */
  readonly respawned: number;
}

export interface SimPool {
  simulate(input: SimInput, options?: SimPoolOptions): Promise<SimResult>;
  simulateMany(inputs: readonly SimInput[], options?: SimPoolOptions): Promise<readonly SimResult[]>;
  stats(): SimPoolStats;
  close(): Promise<void>;
}

interface Pending {
  readonly request: SimPoolRequest;
  readonly resolve: (result: SimResult) => void;
  readonly reject: (err: Error) => void;
}

interface Slot {
  worker: Worker;
  current: Pending | null;
}

function defaultSize(): number {
  const cpus = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  return Math.max(1, cpus - 1);
}

/**
 * Amorce du worker (`sim-worker-boot.mjs`, JavaScript pur) : elle enregistre
 * tsx dans le thread puis charge `sim-worker.ts`. Les hooks tsx hérités par
 * `execArgv` ne résolvent pas les imports sans extension dans un worker.
 */
export function resolveWorkerUrl(): URL {
  return new URL('./sim-worker-boot.mjs', import.meta.url);
}

export function createSimPool(config: SimPoolConfig = {}): SimPool {
  const size = Math.max(1, Math.floor(config.size ?? defaultSize()));
  const workerUrl = resolveWorkerUrl();
  const queue: Pending[] = [];
  const slots: Slot[] = [];
  let nextId = 1;
  let completed = 0;
  let failed = 0;
  let respawned = 0;
  let closed = false;

  function spawn(): Slot {
    const worker = new Worker(workerUrl);
    const slot: Slot = { worker, current: null };
    worker.on('message', (message: SimPoolResponse) => {
      const pending = slot.current;
      if (!pending || pending.request.id !== message.id) return;
      slot.current = null;
      if (message.result) {
        completed += 1;
        pending.resolve(message.result);
      } else {
        failed += 1;
        pending.reject(new Error(message.error ?? 'sim-pool: réponse sans résultat'));
      }
      pump();
    });
    worker.on('error', (err) => {
      const pending = slot.current;
      slot.current = null;
      if (pending) {
        failed += 1;
        pending.reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    worker.on('exit', (code) => {
      const pending = slot.current;
      slot.current = null;
      if (pending) {
        failed += 1;
        pending.reject(new Error(`sim-pool: worker terminé (code ${code}) pendant une simulation`));
      }
      if (closed) return;
      respawned += 1;
      const index = slots.indexOf(slot);
      const fresh = spawn();
      if (index >= 0) slots[index] = fresh;
      else slots.push(fresh);
      pump();
    });
    // Un pool ne doit pas garder le processus en vie à lui seul.
    worker.unref();
    return slot;
  }

  function pump(): void {
    if (closed) return;
    for (const slot of slots) {
      if (slot.current || queue.length === 0) continue;
      const pending = queue.shift() as Pending;
      slot.current = pending;
      slot.worker.ref();
      slot.worker.postMessage(pending.request);
    }
    for (const slot of slots) if (!slot.current) slot.worker.unref();
  }

  for (let i = 0; i < size; i += 1) slots.push(spawn());

  function simulate(input: SimInput, options?: SimPoolOptions): Promise<SimResult> {
    if (closed) return Promise.reject(new Error('sim-pool: fermé'));
    const request: SimPoolRequest = {
      id: nextId++,
      input,
      options: { ...config.defaults, ...options },
    };
    return new Promise<SimResult>((resolve, reject) => {
      queue.push({ request, resolve, reject });
      pump();
    });
  }

  return {
    simulate,
    simulateMany(inputs, options) {
      return Promise.all(inputs.map((input) => simulate(input, options)));
    },
    stats() {
      return {
        size: slots.length,
        busy: slots.filter((s) => s.current !== null).length,
        queued: queue.length,
        completed,
        failed,
        respawned,
      };
    },
    async close() {
      closed = true;
      for (const pending of queue.splice(0)) pending.reject(new Error('sim-pool: fermé'));
      await Promise.all(slots.map((s) => s.worker.terminate()));
      slots.length = 0;
    },
  };
}
