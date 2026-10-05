/**
 * Lot 5 « exploitation » — ENTRÉE du worker de simulation.
 *
 * Un worker reçoit `{ id, input, options }`, joue le match avec
 * `simulateMatch` et renvoie `{ id, result }` (ou `{ id, error }`). Le
 * résultat voyage par clonage structuré : `fullReplay` (les états après
 * chaque coup, ~2 Mo) est DÉRIVABLE du journal et n'est pas transféré
 * quand `stripFullReplay` est demandé — c'est ce que fait le serveur, qui
 * ne persiste que le journal.
 *
 * Ce fichier ne doit rien importer de plus que le simulateur : il est
 * chargé dans chaque thread.
 */

import { parentPort } from 'node:worker_threads';

import { simulateMatch } from '../simulate-match';

import type { SimPoolRequest, SimPoolResponse } from './protocol';

if (!parentPort) {
  throw new Error('sim-worker: doit être chargé dans un worker_thread');
}

const port = parentPort;

port.on('message', (message: SimPoolRequest) => {
  try {
    const result = simulateMatch(message.input, { driverKind: message.options?.driverKind });
    const payload = message.options?.stripFullReplay ? { ...result, fullReplay: undefined } : result;
    const response: SimPoolResponse = { id: message.id, result: payload };
    port.postMessage(response);
  } catch (err: unknown) {
    const response: SimPoolResponse = {
      id: message.id,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
    port.postMessage(response);
  }
});
