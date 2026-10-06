/**
 * Lot 5 « exploitation » — AMORCE du worker de simulation (JavaScript pur).
 *
 * Le paquet est servi en TypeScript source (`main: src/index.ts`, exécuté
 * par tsx côté serveur et par vitest en test). Dans un `worker_thread`,
 * les hooks tsx passés par `--import` ne résolvent PAS les imports sans
 * extension (vérifié sur Node 22.22 + tsx 4.20 : le fichier `.ts` est lu,
 * `../simulate-match` reste introuvable). Enregistrer tsx DEPUIS le worker,
 * avant le premier import TypeScript, fonctionne — d'où cette amorce, qui
 * ne contient aucun type et n'importe l'entrée réelle qu'après.
 */

import { register } from 'tsx/esm/api';

register();

await import('./sim-worker.ts');
