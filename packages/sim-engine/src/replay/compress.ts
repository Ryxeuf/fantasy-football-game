/**
 * Replay payload compression — sprint Pro League lot 1.A.2.
 *
 * Compresse / decompresse un tableau de `MatchEvent` produit par
 * `simulateMatch` (sim-engine) pour stockage durable dans la table
 * Prisma `Replay`. Pipeline :
 *
 *   events[] --[CBOR]--> Uint8Array --[gzip]--> Buffer
 *
 * Pourquoi CBOR + gzip plutôt que JSON.stringify + gzip ?
 * - CBOR encode les types numériques compactement (varint, IEEE-754)
 *   et n'inclut pas les guillemets / virgules / espaces du JSON.
 * - gzip exploite la redondance des chaînes répétées dans les events
 *   (`type`, `engineVer`, `meta` keys, etc.).
 * - Sur un match BB-style ~120-180 events, on observe typiquement
 *   un ratio compression ~5-8× (5-10 KB JSON → 1-2 KB).
 *
 * L'API est asynchrone (gzip non-bloquant via `zlib`). Les helpers ne
 * font aucune I/O — ils retournent / consomment des `Buffer`. Le
 * stockage DB est responsabilité du caller (apps/server).
 */

import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';

import { decode as cborDecode, encode as cborEncode } from 'cbor-x';

import type { GameState, Move } from '@bb/game-engine';
import type { MatchEvent } from '@bb/shared-types';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Lot 3.D.1 — payload format. Pour rester rétro-compatible avec les
 * replays produits avant ce lot, on supporte deux formats au décodage :
 *
 *  - Legacy (array) : `MatchEvent[]` direct. Reconnu via `Array.isArray`.
 *  - Wrapper (object) : `{ events, fullReplay? }`. Permet de porter le
 *    re-jeu visuel BB (Lots 3.D.*) sans casser les anciens consumers.
 *
 * À l'écriture, on choisit automatiquement le format wrapper si
 * `fullReplay` est fourni — sinon on reste sur l'array pour ne pas
 * gonfler le payload des replays hybrid.
 */
export interface ReplayWrapper {
  readonly events: readonly MatchEvent[];
  readonly fullReplay?: {
    readonly initialState: GameState;
    readonly moves: readonly Move[];
    readonly states: readonly GameState[];
  };
}

/**
 * Sérialise + compresse un tableau d'events en `Buffer` prêt à être
 * stocké dans `Replay.payload`. Lève si CBOR ou gzip échoue.
 */
export async function compressEvents(
  events: readonly MatchEvent[]
): Promise<Buffer> {
  const cbor = cborEncode(events);
  return gzipAsync(cbor);
}

/**
 * Lot 3.D.1 — version étendue : compresse aussi le `fullReplay`
 * (initialState + moves) pour permettre le re-jeu visuel BB côté
 * client. Si `wrapper.fullReplay` est absent, le format émis est
 * identique à `compressEvents` (rétro-compat parfaite). Si présent,
 * on encode l'object wrapper, ~10-30 % plus gros qu'un replay
 * events-only.
 */
export async function compressReplay(
  wrapper: ReplayWrapper
): Promise<Buffer> {
  if (!wrapper.fullReplay) {
    return compressEvents(wrapper.events);
  }
  const cbor = cborEncode({
    v: 1, // version tag pour évolutions futures
    events: wrapper.events,
    fullReplay: wrapper.fullReplay,
  });
  return gzipAsync(cbor);
}

/**
 * Décompresse + désérialise un payload binaire issu de `Replay.payload`.
 * Le résultat est un nouvel array — le caller peut le freezer s'il
 * veut une garantie d'immutabilité.
 *
 * Lot 3.D.1 — supporte aussi le nouveau format wrapper en extrayant
 * `events`. Pour récupérer `fullReplay`, utiliser `decompressReplay`.
 */
export async function decompressEvents(
  payload: Buffer
): Promise<MatchEvent[]> {
  const cbor = await gunzipAsync(payload);
  const decoded = cborDecode(cbor) as unknown;
  if (Array.isArray(decoded)) {
    return decoded as MatchEvent[];
  }
  if (
    decoded &&
    typeof decoded === 'object' &&
    Array.isArray((decoded as { events?: unknown }).events)
  ) {
    return (decoded as { events: MatchEvent[] }).events;
  }
  throw new Error(
    'decompressEvents: payload did not decode to a known format (array | wrapper)',
  );
}

/**
 * Lot 3.D.1 — décodage complet du payload. Retourne le wrapper
 * `{ events, fullReplay? }`. Pour les replays legacy (array), wrappe
 * automatiquement avec `fullReplay: undefined`.
 */
export async function decompressReplay(
  payload: Buffer,
): Promise<ReplayWrapper> {
  const cbor = await gunzipAsync(payload);
  const decoded = cborDecode(cbor) as unknown;
  if (Array.isArray(decoded)) {
    return { events: decoded as MatchEvent[] };
  }
  if (
    decoded &&
    typeof decoded === 'object' &&
    Array.isArray((decoded as { events?: unknown }).events)
  ) {
    const obj = decoded as {
      events: MatchEvent[];
      fullReplay?: ReplayWrapper['fullReplay'];
    };
    return { events: obj.events, fullReplay: obj.fullReplay };
  }
  throw new Error(
    'decompressReplay: payload did not decode to a known format (array | wrapper)',
  );
}

/**
 * Statistiques de compression pour audit / monitoring (lot 1.F.3).
 * Ne dépend pas du payload réel — calculée à partir des deux tailles.
 */
export interface CompressionStats {
  /** Taille du JSON équivalent (bytes UTF-8). */
  rawJsonSize: number;
  /** Taille du payload compressé (bytes). */
  compressedSize: number;
  /** Ratio = rawJsonSize / compressedSize (1.0 = no gain). */
  ratio: number;
}

export function computeCompressionStats(
  events: readonly MatchEvent[],
  compressed: Buffer
): CompressionStats {
  const rawJsonSize = Buffer.byteLength(JSON.stringify(events), 'utf8');
  const compressedSize = compressed.byteLength;
  return {
    rawJsonSize,
    compressedSize,
    ratio: compressedSize > 0 ? rawJsonSize / compressedSize : 0,
  };
}
