/**
 * L.4 — Generateur de calendrier round-robin (Sprint 17).
 *
 * Fonction pure qui produit le calendrier d'une saison de ligue pour
 * une liste de participants. Utilise la "methode des cercles" (tables
 * de Berger) : on fixe un participant et on fait tourner les autres.
 *
 * Contrats :
 * - Deterministe : meme entree -> meme sortie (ordre des rounds et
 *   des pairings dans chaque round).
 * - Pour N participants pairs : N-1 rounds, chaque paire se rencontre
 *   exactement une fois.
 * - Pour N participants impairs : on ajoute un marqueur "bye" fantome
 *   et chaque round libere un participant (1 bye par round, reparti
 *   sur N rounds).
 * - Option `doubleRoundRobin` : second tour avec home/away inverses,
 *   les numeros de round continuent (1..N-1 puis N..2(N-1)).
 * - L'equilibre home/away suit le standard Berger : au plus
 *   ceil((N-1)/2) matchs a domicile par equipe en simple round-robin.
 *
 * Cette fonction ne touche pas la base de donnees : elle renvoie une
 * structure serialisable, que le seeder L.2 ou une future route L.5/L.7
 * peut persister sous forme de LeagueRound + futurs LeagueMatch.
 */

export interface RoundRobinPairing {
  readonly home: string;
  readonly away: string;
}

export interface RoundRobinRound {
  readonly roundNumber: number;
  readonly pairings: readonly RoundRobinPairing[];
  readonly bye: string | null;
}

export interface GenerateRoundRobinInput {
  readonly participantIds: readonly string[];
  readonly doubleRoundRobin?: boolean;
}

const BYE_MARKER = "__bye__";

export function generateRoundRobin(
  input: GenerateRoundRobinInput,
): RoundRobinRound[] {
  const { participantIds, doubleRoundRobin = false } = input;

  if (participantIds.length < 2) {
    throw new Error(
      "Au moins deux participants requis pour generer un calendrier round-robin",
    );
  }

  const unique = new Set(participantIds);
  if (unique.size !== participantIds.length) {
    throw new Error(
      "Les identifiants de participants doivent etre uniques (doublon detecte)",
    );
  }

  const working: string[] = [...participantIds];
  if (working.length % 2 === 1) {
    working.push(BYE_MARKER);
  }

  const n = working.length;
  const half = n / 2;
  const roundsCount = n - 1;

  const fixed = working[0];
  const rotating: string[] = working.slice(1);

  const firstLeg: RoundRobinRound[] = [];

  for (let r = 0; r < roundsCount; r += 1) {
    const lineup: string[] = [fixed, ...rotating];
    const pairings: RoundRobinPairing[] = [];
    let bye: string | null = null;

    for (let i = 0; i < half; i += 1) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];

      if (a === BYE_MARKER) {
        bye = b;
        continue;
      }
      if (b === BYE_MARKER) {
        bye = a;
        continue;
      }

      // Berger balancing: top slot alternates home/away per round,
      // other slots follow the round parity + their position.
      const swap = i === 0 ? r % 2 === 1 : (r + i) % 2 === 0;
      pairings.push(swap ? { home: b, away: a } : { home: a, away: b });
    }

    firstLeg.push({ roundNumber: r + 1, pairings, bye });

    // Rotate: last element moves to the front.
    rotating.unshift(rotating.pop() as string);
  }

  if (!doubleRoundRobin) {
    return firstLeg;
  }

  const secondLeg: RoundRobinRound[] = firstLeg.map((round, idx) => ({
    roundNumber: roundsCount + idx + 1,
    pairings: round.pairings.map((p) => ({ home: p.away, away: p.home })),
    bye: round.bye,
  }));

  return [...firstLeg, ...secondLeg];
}

/**
 * Lot C.2 — Description d'une poule pour la generation multi-poules.
 */
export interface PoolInput {
  readonly poolId: string;
  readonly participantIds: readonly string[];
}

export interface GenerateMultiPoolInput {
  readonly pools: readonly PoolInput[];
  readonly doubleRoundRobin?: boolean;
}

/**
 * Lot C.2 — Genere un calendrier multi-poules avec **journees
 * partagees** : la journee N agrege les pairings de chaque poule
 * pour ce meme tour. Repond a l'exigence "planning par journee ET
 * par poule" — toutes les poules avancent au meme rythme.
 *
 * Chaque poule produit son propre round-robin via `generateRoundRobin`.
 * On fusionne ensuite par index de round : le nombre de journees est
 * le max sur toutes les poules (les poules plus petites ont juste
 * moins de matchs sur les dernieres journees).
 *
 * Le `bye` au niveau merge est null (concept non pertinent multi-poules ;
 * chaque poule gere ses propres byes internes en n'ajoutant pas de
 * pairing pour l'equipe au repos). Pure : meme entree -> meme sortie.
 */
export function generateMultiPoolRoundRobin(
  input: GenerateMultiPoolInput,
): RoundRobinRound[] {
  const { pools, doubleRoundRobin = false } = input;
  if (pools.length === 0) {
    throw new Error("Au moins une poule requise");
  }

  // Verifie l'unicite globale des participants (un participant ne peut
  // pas appartenir a deux poules).
  const seen = new Set<string>();
  for (const pool of pools) {
    for (const pid of pool.participantIds) {
      if (seen.has(pid)) {
        throw new Error(
          `Participant ${pid} present dans plusieurs poules`,
        );
      }
      seen.add(pid);
    }
  }

  // Genere le round-robin de chaque poule (>= 2 participants requis ;
  // une poule a 0/1 participant ne produit aucun pairing).
  const perPool: RoundRobinRound[][] = pools.map((pool) =>
    pool.participantIds.length >= 2
      ? generateRoundRobin({
          participantIds: pool.participantIds,
          doubleRoundRobin,
        })
      : [],
  );

  const maxRounds = perPool.reduce(
    (acc, rounds) => Math.max(acc, rounds.length),
    0,
  );

  const merged: RoundRobinRound[] = [];
  for (let r = 0; r < maxRounds; r += 1) {
    const pairings: RoundRobinPairing[] = [];
    for (const poolRounds of perPool) {
      const round = poolRounds[r];
      if (round) {
        pairings.push(...round.pairings);
      }
    }
    merged.push({ roundNumber: r + 1, pairings, bye: null });
  }

  return merged;
}

