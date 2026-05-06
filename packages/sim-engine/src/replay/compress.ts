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

import type { MatchEvent } from '@bb/shared-types';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

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
 * Décompresse + désérialise un payload binaire issu de `Replay.payload`.
 * Le résultat est un nouvel array — le caller peut le freezer s'il
 * veut une garantie d'immutabilité.
 */
export async function decompressEvents(
  payload: Buffer
): Promise<MatchEvent[]> {
  const cbor = await gunzipAsync(payload);
  const decoded = cborDecode(cbor) as unknown;
  if (!Array.isArray(decoded)) {
    throw new Error('decompressEvents: payload did not decode to an array');
  }
  return decoded as MatchEvent[];
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
