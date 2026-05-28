import { prisma } from "../prisma";

/**
 * Bot draft — pose des encheres automatiques pour les coachs test
 * d'une session de mercato.
 *
 * Strategie V1
 * ------------
 * Pour chaque bot, on selectionne N joueurs (default 12) parmi les
 * joueurs libres du catalogue, en respectant des **quotas de
 * position BB** (Thrower / Catcher-Runner / Lineman-Blocker / Big Guy
 * / Blitzer-Specialist) pour garantir la coherence du roster
 * post-resolution. Le bid est `round(currentValue * (1.10 + jitter))`
 * avec jitter ±10% deterministe (seed = entryId+playerId), ce qui
 * empeche les bots d'etre identiques.
 *
 * Le service pur `pickBotBids` ne touche pas la DB. La couche
 * service `placeBotBidsForSession` (dans nfl-fantasy-draft-session)
 * pre-charge entries + catalog et appelle le service pur, puis
 * upsert les bids via `placeBid` existant.
 */

import type { BbPosition } from "@bb/nfl-mapper";

export interface BotEntry {
  readonly entryId: string;
  readonly budgetRemaining: number;
}

export interface BotCandidate {
  readonly playerId: string;
  readonly bbPosition: BbPosition;
  readonly basePrice: number;
  readonly currentValue: number;
}

export interface BotBid {
  readonly entryId: string;
  readonly playerId: string;
  readonly amount: number;
}

/** Categorie BB pour les quotas (groupes thematiques). */
export type BotPositionBucket =
  | "thrower"
  | "catcher_runner"
  | "lineman"
  | "blitzer"
  | "big_guy";

const POSITION_BUCKET: Readonly<Record<BbPosition, BotPositionBucket>> = {
  Thrower: "thrower",
  Catcher: "catcher_runner",
  Runner: "catcher_runner",
  GutterRunner: "catcher_runner",
  Ghoul: "catcher_runner",
  Werewolf: "catcher_runner",
  Lineman: "lineman",
  Blocker: "lineman",
  Zombie: "lineman",
  Bloodseeker: "lineman",
  Goblin: "lineman",
  Blitzer: "blitzer",
  StormVermin: "blitzer",
  BlackOrc: "blitzer",
  Wardancer: "blitzer",
  Berserker: "blitzer",
  Ulfwerener: "blitzer",
  Wight: "blitzer",
  Trollslayer: "blitzer",
  Khorngor: "blitzer",
  Bloodspawn: "blitzer",
  RatOgre: "big_guy",
  Treeman: "big_guy",
  Troll: "big_guy",
  Ogre: "big_guy",
  Yhetee: "big_guy",
  Deathroller: "big_guy",
  Bloodthirster: "big_guy",
  FleshGolem: "big_guy",
};

/**
 * Quotas par bucket pour un roster cible de ~12 joueurs.
 * Aligne grossierement sur la composition BB classique : 1 Thrower,
 * 3 Catcher/Runner, 4 Lineman, 3 Blitzer/Specialist, 1 Big Guy.
 */
const DEFAULT_QUOTAS: Readonly<Record<BotPositionBucket, number>> = {
  thrower: 1,
  catcher_runner: 3,
  lineman: 4,
  blitzer: 3,
  big_guy: 1,
};

export interface PickBotBidsOpts {
  readonly entries: ReadonlyArray<BotEntry>;
  readonly candidates: ReadonlyArray<BotCandidate>;
  /** Nb total de bids vise par bot (default 12, max 15). */
  readonly bidsPerEntry?: number;
  /** Pour ne pas re-bidder sur des joueurs deja sur le roster d'une entry. */
  readonly excludedByEntry?: Readonly<Record<string, ReadonlySet<string>>>;
  /** Pourcentage central de la cote (default 1.10 = 110%). */
  readonly bidMultiplier?: number;
  /** Amplitude du jitter (default 0.10 = ±10%). */
  readonly jitterAmplitude?: number;
}

/**
 * PRNG deterministe simple (mulberry32-like) seede a partir d'une
 * string. Permet de reproduire les bids des bots pour debug / tests.
 */
function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffle in-place style Fisher-Yates avec un PRNG fourni. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Selectionne les bids pour chaque entry selon les quotas + un jitter
 * deterministe (seed = entryId+playerId). Pas d'I/O.
 *
 * Algo par entry :
 *   1. Filtre candidates non exclus.
 *   2. Pour chaque bucket, shuffle les candidats du bucket et prend
 *      jusqu'au quota.
 *   3. Si tous les buckets sont satisfaits et qu'il reste de la place,
 *      pioche au hasard parmi les restants.
 *   4. Calcule bid = round(currentValue * (multiplier + jitter)),
 *      clamp au basePrice min et au budgetRemaining (cap serveur).
 *   5. Drop les joueurs dont le bid clampe < basePrice (ex: budget
 *      trop bas).
 */
export function pickBotBids(opts: PickBotBidsOpts): BotBid[] {
  const bidsPerEntry = Math.max(1, Math.min(15, opts.bidsPerEntry ?? 12));
  const baseMultiplier = opts.bidMultiplier ?? 1.10;
  const jitter = opts.jitterAmplitude ?? 0.10;
  const excludedByEntry = opts.excludedByEntry ?? {};

  const out: BotBid[] = [];

  for (const entry of opts.entries) {
    const excluded = excludedByEntry[entry.entryId] ?? new Set<string>();
    const usable = opts.candidates.filter((c) => !excluded.has(c.playerId));
    if (usable.length === 0) continue;

    // Group by bucket (immutable copies for shuffle).
    const byBucket = new Map<BotPositionBucket, BotCandidate[]>();
    for (const c of usable) {
      const bucket = POSITION_BUCKET[c.bbPosition];
      const list = byBucket.get(bucket) ?? [];
      list.push(c);
      byBucket.set(bucket, list);
    }

    const rng = mulberry32(seedFromString(entry.entryId));
    for (const list of byBucket.values()) shuffle(list, rng);

    // 1. Quota pass : prendre jusqu'a `DEFAULT_QUOTAS[bucket]` par bucket
    //    en respectant le total `bidsPerEntry`.
    const picked: BotCandidate[] = [];
    const usedIds = new Set<string>();
    const order: BotPositionBucket[] = [
      "thrower",
      "big_guy",
      "catcher_runner",
      "blitzer",
      "lineman",
    ];
    for (const bucket of order) {
      const quota = DEFAULT_QUOTAS[bucket];
      const candidates = byBucket.get(bucket) ?? [];
      for (let i = 0; i < quota && picked.length < bidsPerEntry; i++) {
        const c = candidates.shift();
        if (!c || usedIds.has(c.playerId)) continue;
        picked.push(c);
        usedIds.add(c.playerId);
      }
    }

    // 2. Remplissage : si pas atteint bidsPerEntry, pioche dans n'importe
    //    quel bucket restant.
    if (picked.length < bidsPerEntry) {
      const remaining: BotCandidate[] = [];
      for (const list of byBucket.values()) remaining.push(...list);
      shuffle(remaining, rng);
      for (const c of remaining) {
        if (picked.length >= bidsPerEntry) break;
        if (usedIds.has(c.playerId)) continue;
        picked.push(c);
        usedIds.add(c.playerId);
      }
    }

    // 3. Calcul des montants avec jitter deterministe + clamp.
    for (const c of picked) {
      const localRng = mulberry32(seedFromString(`${entry.entryId}:${c.playerId}`));
      // jitter ∈ [-jitter, +jitter], distribue uniformement.
      const j = (localRng() - 0.5) * 2 * jitter;
      const raw = Math.round(c.currentValue * (baseMultiplier + j));
      // Clamp : >= basePrice (sinon serveur reject), <= budgetRemaining
      // (cap serveur — overbooking autorise au-dela mais on reste sage).
      const clamped = Math.max(c.basePrice, Math.min(raw, entry.budgetRemaining));
      if (clamped < c.basePrice) continue;
      out.push({
        entryId: entry.entryId,
        playerId: c.playerId,
        amount: clamped,
      });
    }
  }

  return out;
}

// ────────────────────────────────────────────────────────────────────
// Couche DB — place les bids des bots sur une session
// ────────────────────────────────────────────────────────────────────

export interface PlaceBotBidsOpts {
  readonly sessionId: string;
  /** Si fourni, ne genere des bids QUE pour ces entries. Sinon, vise
   *  toutes les entries de la league qui n'ont AUCUN bid sur cette
   *  session (= bots non encore actifs). */
  readonly entryIds?: ReadonlyArray<string>;
  readonly bidsPerEntry?: number;
}

export interface PlaceBotBidsResult {
  readonly sessionId: string;
  readonly entriesProcessed: number;
  readonly bidsCreated: number;
  readonly bidsUpdated: number;
}

export class BotDraftError extends Error {
  constructor(
    public readonly code: "SESSION_NOT_FOUND" | "SESSION_NOT_OPEN",
    message: string,
  ) {
    super(message);
    this.name = "BotDraftError";
  }
}

/**
 * Charge la session, les entries cibles et le catalogue de joueurs
 * libres (free agents pour la league : non sur un roster de la league
 * + currentValue connu). Genere les bids via `pickBotBids` (pur) et
 * les upserts dans `NflFantasyDraftBid`.
 *
 * Idempotent : un meme bot rappele 2x produit les memes bids car le
 * RNG est seede par entryId (jitter deterministe).
 */
export async function placeBotBidsForSession(
  opts: PlaceBotBidsOpts,
): Promise<PlaceBotBidsResult> {
  const session = await prisma.nflFantasyDraftSession.findUnique({
    where: { id: opts.sessionId },
    select: { id: true, leagueId: true, status: true },
  });
  if (!session) {
    throw new BotDraftError(
      "SESSION_NOT_FOUND",
      `Session ${opts.sessionId} introuvable`,
    );
  }
  if (session.status !== "open") {
    throw new BotDraftError(
      "SESSION_NOT_OPEN",
      `Session ${opts.sessionId} ${session.status} (pas open)`,
    );
  }

  // 1. Determine les entries cibles. Default : toutes les entries de
  //    la league qui n'ont pas encore de bid sur cette session.
  type EntryRow = {
    id: string;
    budgetRemaining: number;
    bids: { id: string }[];
    roster: { playerId: string }[];
  };
  const entries: EntryRow[] = await prisma.nflFantasyEntry.findMany({
    where: opts.entryIds
      ? { id: { in: [...opts.entryIds] }, leagueId: session.leagueId }
      : { leagueId: session.leagueId },
    select: {
      id: true,
      budgetRemaining: true,
      bids: {
        where: { sessionId: opts.sessionId },
        select: { id: true },
        take: 1,
      },
      roster: { select: { playerId: true } },
    },
  });
  const targetEntries = opts.entryIds
    ? entries
    : entries.filter((e) => e.bids.length === 0);
  if (targetEntries.length === 0) {
    return {
      sessionId: opts.sessionId,
      entriesProcessed: 0,
      bidsCreated: 0,
      bidsUpdated: 0,
    };
  }

  // 2. Charge le catalogue : joueurs actifs sans roster dans la league.
  const rosteredPlayerIds: string[] = (
    await prisma.nflFantasyRoster.findMany({
      where: { entry: { leagueId: session.leagueId } },
      select: { playerId: true },
    })
  ).map((r: { playerId: string }) => r.playerId);

  type PlayerRow = {
    id: string;
    bbPosition: string;
    currentValue: number;
  };
  const players: PlayerRow[] = await prisma.nflPlayer.findMany({
    where: {
      status: "active",
      id: { notIn: rosteredPlayerIds.length > 0 ? rosteredPlayerIds : ["__none__"] },
    },
    select: { id: true, bbPosition: true, currentValue: true },
  });
  const candidates: BotCandidate[] = players.map((p) => ({
    playerId: p.id,
    bbPosition: p.bbPosition as BbPosition,
    basePrice: p.currentValue, // V3 : basePrice = currentValue
    currentValue: p.currentValue,
  }));

  // 3. Exclusions par entry : les joueurs deja sur leur roster (cas
  //    multi-session, on garde la securite).
  const excludedByEntry: Record<string, Set<string>> = {};
  for (const e of targetEntries) {
    excludedByEntry[e.id] = new Set(
      e.roster.map((r: { playerId: string }) => r.playerId),
    );
  }

  const bids = pickBotBids({
    entries: targetEntries.map((e) => ({
      entryId: e.id,
      budgetRemaining: e.budgetRemaining,
    })),
    candidates,
    bidsPerEntry: opts.bidsPerEntry,
    excludedByEntry,
  });

  // 4. Upsert chaque bid via les memes contraintes que placeBid.
  let bidsCreated = 0;
  let bidsUpdated = 0;
  for (const b of bids) {
    const res = await prisma.nflFantasyDraftBid.upsert({
      where: {
        sessionId_entryId_playerId: {
          sessionId: opts.sessionId,
          entryId: b.entryId,
          playerId: b.playerId,
        },
      },
      create: {
        sessionId: opts.sessionId,
        entryId: b.entryId,
        playerId: b.playerId,
        amount: b.amount,
        status: "pending",
      },
      update: { amount: b.amount, status: "pending" },
      select: { createdAt: true, updatedAt: true },
    });
    if (res.createdAt.getTime() === res.updatedAt.getTime()) bidsCreated++;
    else bidsUpdated++;
  }

  return {
    sessionId: opts.sessionId,
    entriesProcessed: targetEntries.length,
    bidsCreated,
    bidsUpdated,
  };
}
