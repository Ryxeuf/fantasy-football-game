/**
 * Conversion stats NFL -> SPP Blood Bowl.
 *
 * Source : docs/nfl-fantasy/06-scoring.md § "Table de mapping par poste".
 *
 * Approche : threshold-based mapping. Seuls les moments NFL "BB-worthy"
 * (TD, big play, sack, INT, etc.) comptent en SPP. Preserve la narrative
 * BB : chaque SPP = un "moment" (cf. doc).
 *
 * Pure : pas d'I/O, deterministe, replay-friendly. Reuse par
 * apps/server/services/nfl-fantasy-scoring.ts (pattern Q.D.1 settle
 * isole).
 */

import type { BbPosition } from './position-to-bb.js';
import { getBbPositionRole } from './position-to-bb.js';

/**
 * Stats brutes d'un joueur sur un match NFL. Tous les champs sont
 * optionnels : un joueur defensif n'a pas de passYards, un QB n'a
 * typiquement pas de defInt, etc. Format aligne avec les colonnes
 * nflverse `stats_player_week_{year}.csv`.
 */
export interface NflPlayerStatLine {
  readonly position?: string;
  readonly bbPosition: BbPosition;

  // Offensive — passing
  readonly passYards?: number;
  readonly passTd?: number;
  readonly passInt?: number;
  readonly passComp?: number;
  readonly passAtt?: number;
  readonly passRating?: number;

  // Offensive — rushing
  readonly rushYards?: number;
  readonly rushTd?: number;
  readonly rushAtt?: number;
  readonly fumbleLost?: number;

  // Offensive — receiving
  readonly recYards?: number;
  readonly receptions?: number;
  readonly recTd?: number;
  readonly drops?: number;

  // Defensive
  readonly tackles?: number;
  readonly sacks?: number;
  readonly tfl?: number;
  readonly qbHits?: number;
  readonly defInt?: number;
  readonly passDefended?: number;
  readonly forcedFumble?: number;
  readonly fumbleRecovery?: number;
  readonly defTd?: number;

  // Team context (pour OL — approche QB-derived)
  readonly teamPassRating?: number;
  readonly teamRushYards?: number;
  readonly teamSacksAllowed?: number;
}

/**
 * Type d'event BB officiel cf. baremes BB2020 (06-scoring.md).
 */
export type BbEventType = 'TD' | 'CP' | 'DP' | 'CAS' | 'MALUS';

export interface SppEvent {
  readonly type: BbEventType;
  readonly count: number;
  /** SPP genere par cet event (peut etre negatif pour MALUS). */
  readonly spp: number;
  /** Raison lisible pour la Gazette / debug. */
  readonly reason: string;
}

export interface SppBreakdown {
  readonly events: readonly SppEvent[];
  readonly totalSpp: number;
  /** True si totalSpp > 0 (cf. attribution MVP, 06-scoring.md § MVP). */
  readonly mvpEligible: boolean;
}

const SPP_BY_TYPE: Readonly<Record<BbEventType, number>> = {
  TD: 3,
  CP: 1,
  DP: 2,
  CAS: 2,
  MALUS: -1,
};

function n(v: number | undefined): number {
  return v ?? 0;
}

/**
 * Helper : construit un SppEvent en deduisant le SPP du type x count.
 * MALUS supporte un signe negatif via count > 0 (le SPP est negatif via SPP_BY_TYPE).
 */
function event(type: BbEventType, count: number, reason: string): SppEvent | null {
  if (count <= 0) return null;
  const sppPerEvent = SPP_BY_TYPE[type];
  return { type, count, spp: count * sppPerEvent, reason };
}

// ────────────────────────────────────────────────────────────────────
// Thrower (QB) — 06-scoring.md § Thrower
// ────────────────────────────────────────────────────────────────────

function scoreThrower(stat: NflPlayerStatLine): readonly SppEvent[] {
  const events: SppEvent[] = [];
  const passTd = n(stat.passTd);
  const passYards = n(stat.passYards);
  const passInt = n(stat.passInt);
  const rushTd = n(stat.rushTd);
  const rushYards = n(stat.rushYards);

  const td = event('TD', passTd, `${passTd} passing TD`);
  if (td) events.push(td);

  // Passing yards par tranche de 75, cap a 4 CP (06-scoring.md table Thrower)
  const cpFromYards = Math.min(4, Math.floor(passYards / 75));
  const cpEvt = event('CP', cpFromYards, `${cpFromYards} CP (passing yards ${passYards}/75)`);
  if (cpEvt) events.push(cpEvt);

  // 1 rushing TD du QB compte
  const rushTdEvt = event('TD', rushTd, `${rushTd} rushing TD (QB run)`);
  if (rushTdEvt) events.push(rushTdEvt);

  // Bonus rushing >50 yards (cf. doc : 1 rushing yards >50 -> bonus CP)
  if (rushYards >= 50) {
    events.push({ type: 'CP', count: 1, spp: 1, reason: `bonus CP (QB rush ${rushYards} yd >=50)` });
  }

  // Malus interception : -1 par INT (cf. doc : "-1× CP (annule)" par INT)
  if (passInt > 0) {
    events.push({ type: 'MALUS', count: passInt, spp: -passInt, reason: `-${passInt} pour ${passInt} INT thrown` });
  }

  return events;
}

// ────────────────────────────────────────────────────────────────────
// RB / Runner / Blitzer offensif — 06-scoring.md § Runner/Blitzer
// ────────────────────────────────────────────────────────────────────

function scoreRunner(stat: NflPlayerStatLine): readonly SppEvent[] {
  const events: SppEvent[] = [];
  const rushTd = n(stat.rushTd);
  const recTd = n(stat.recTd);
  const rushYards = n(stat.rushYards);
  const recYards = n(stat.recYards);
  const receptions = n(stat.receptions);
  const fumbleLost = n(stat.fumbleLost);

  const rushTdEvt = event('TD', rushTd, `${rushTd} rushing TD`);
  if (rushTdEvt) events.push(rushTdEvt);

  const recTdEvt = event('TD', recTd, `${recTd} receiving TD`);
  if (recTdEvt) events.push(recTdEvt);

  if (rushYards >= 75) {
    events.push({ type: 'CP', count: 1, spp: 1, reason: `1 CP (rushing yards ${rushYards} >=75)` });
  }
  if (rushYards >= 100) {
    events.push({ type: 'CP', count: 1, spp: 1, reason: `bonus CP (rushing yards ${rushYards} >=100)` });
  }
  if (recYards >= 100) {
    events.push({ type: 'CP', count: 1, spp: 1, reason: `bonus CP (recv yards ${recYards} >=100)` });
  }

  // 1 reception (max 3 capped pour RB cf. doc)
  const recCapped = Math.min(3, receptions);
  const recEvt = event('CP', recCapped, `${recCapped} CP (receptions cap a 3 pour RB)`);
  if (recEvt) events.push(recEvt);

  if (fumbleLost > 0) {
    events.push({ type: 'MALUS', count: fumbleLost, spp: -fumbleLost, reason: `-${fumbleLost} pour ${fumbleLost} fumble lost` });
  }

  return events;
}

// ────────────────────────────────────────────────────────────────────
// Catcher (WR / TE) — 06-scoring.md § Catcher
// ────────────────────────────────────────────────────────────────────

function scoreCatcher(stat: NflPlayerStatLine): readonly SppEvent[] {
  const events: SppEvent[] = [];
  const recTd = n(stat.recTd);
  const recYards = n(stat.recYards);
  const receptions = n(stat.receptions);
  const drops = n(stat.drops);

  // 1 reception (max 5 capped pour WR/TE cf. doc)
  const recCapped = Math.min(5, receptions);
  const recEvt = event('CP', recCapped, `${recCapped} CP (receptions cap a 5)`);
  if (recEvt) events.push(recEvt);

  const tdEvt = event('TD', recTd, `${recTd} receiving TD`);
  if (tdEvt) events.push(tdEvt);

  if (recYards >= 100) {
    events.push({ type: 'CP', count: 1, spp: 1, reason: `bonus CP (recv yards ${recYards} >=100)` });
  }
  if (recYards >= 150) {
    events.push({ type: 'CP', count: 1, spp: 1, reason: `bonus CP (recv yards ${recYards} >=150)` });
  }

  if (drops > 0) {
    events.push({ type: 'MALUS', count: drops, spp: -drops, reason: `-${drops} pour ${drops} drop(s)` });
  }

  return events;
}

// ────────────────────────────────────────────────────────────────────
// Big Guy (DT / NT) — 06-scoring.md § Big Guy
// ────────────────────────────────────────────────────────────────────

function scoreBigGuy(stat: NflPlayerStatLine): readonly SppEvent[] {
  const events: SppEvent[] = [];
  const sacks = n(stat.sacks);
  const qbHits = n(stat.qbHits);
  const forcedFumble = n(stat.forcedFumble);
  const fumbleRecovery = n(stat.fumbleRecovery);
  const defTd = n(stat.defTd);

  const sackEvt = event('CAS', sacks, `${sacks} sack(s) -> CAS`);
  if (sackEvt) events.push(sackEvt);

  // 3 QB hits = 1 CAS (cf. doc) — utilise les hits restants apres les sacks
  // (les sacks sont generalement comptes comme hits aussi, mais nflverse
  // les separe : def_sacks vs def_qb_hits)
  const hitCas = Math.floor(qbHits / 3);
  const hitEvt = event('CAS', hitCas, `${hitCas} CAS (${qbHits} QB hits / 3)`);
  if (hitEvt) events.push(hitEvt);

  const ffEvt = event('DP', forcedFumble, `${forcedFumble} forced fumble`);
  if (ffEvt) events.push(ffEvt);

  const frEvt = event('DP', fumbleRecovery, `${fumbleRecovery} fumble recovery`);
  if (frEvt) events.push(frEvt);

  const tdEvt = event('TD', defTd, `${defTd} defensive TD`);
  if (tdEvt) events.push(tdEvt);

  return events;
}

// ────────────────────────────────────────────────────────────────────
// Blitzer defensif (DE / EDGE / LB) — 06-scoring.md § Blitzer
// ────────────────────────────────────────────────────────────────────

function scoreDefensiveBlitzer(stat: NflPlayerStatLine): readonly SppEvent[] {
  const events: SppEvent[] = [];
  const tackles = n(stat.tackles);
  const sacks = n(stat.sacks);
  const defInt = n(stat.defInt);
  const forcedFumble = n(stat.forcedFumble);
  const tfl = n(stat.tfl);
  const defTd = n(stat.defTd);

  // Tackles >=10 = 1 CAS (gros match defensif)
  if (tackles >= 10) {
    events.push({ type: 'CAS', count: 1, spp: 2, reason: `1 CAS (${tackles} tackles >=10)` });
  }

  const sackEvt = event('CAS', sacks, `${sacks} sack(s) -> CAS`);
  if (sackEvt) events.push(sackEvt);

  const intEvt = event('DP', defInt, `${defInt} INT`);
  if (intEvt) events.push(intEvt);

  const ffEvt = event('DP', forcedFumble, `${forcedFumble} forced fumble`);
  if (ffEvt) events.push(ffEvt);

  // Tackles for loss >=2 = bonus CP
  if (tfl >= 2) {
    events.push({ type: 'CP', count: 1, spp: 1, reason: `bonus CP (${tfl} TFL >=2)` });
  }

  const tdEvt = event('TD', defTd, `${defTd} defensive TD`);
  if (tdEvt) events.push(tdEvt);

  return events;
}

// ────────────────────────────────────────────────────────────────────
// Catcher defensif / Runner (CB / S) — 06-scoring.md § CB/S
// ────────────────────────────────────────────────────────────────────

function scoreDefensiveBack(stat: NflPlayerStatLine): readonly SppEvent[] {
  const events: SppEvent[] = [];
  const defInt = n(stat.defInt);
  const passDefended = n(stat.passDefended);
  const defTd = n(stat.defTd);
  const forcedFumble = n(stat.forcedFumble);

  const intEvt = event('DP', defInt, `${defInt} INT`);
  if (intEvt) events.push(intEvt);

  const pbuEvt = event('CP', passDefended, `${passDefended} PD (pass breakup)`);
  if (pbuEvt) events.push(pbuEvt);

  // Pick-six / fumble return : TD + DP cumule (cf. doc : 5 SPP)
  const tdEvt = event('TD', defTd, `${defTd} defensive TD`);
  if (tdEvt) {
    events.push(tdEvt);
    // Bonus DP narratif : interception ramenee en TD
    events.push({ type: 'DP', count: defTd, spp: 2 * defTd, reason: `${defTd} bonus DP (pick-six / fumble return)` });
  }

  const ffEvt = event('DP', forcedFumble, `${forcedFumble} forced fumble`);
  if (ffEvt) events.push(ffEvt);

  return events;
}

// ────────────────────────────────────────────────────────────────────
// Lineman OL (approche QB-derived par defaut, cf. 06-scoring.md)
// ────────────────────────────────────────────────────────────────────

function scoreLineman(stat: NflPlayerStatLine): readonly SppEvent[] {
  const events: SppEvent[] = [];
  const teamPassRating = n(stat.teamPassRating);
  const teamRushYards = n(stat.teamRushYards);
  const teamSacksAllowed = n(stat.teamSacksAllowed);

  // Si aucune donnee de team context, fallback participation-based
  // (1 SPP par match dispute en titulaire — approche 3 du doc).
  const hasTeamContext = stat.teamPassRating !== undefined ||
    stat.teamRushYards !== undefined ||
    stat.teamSacksAllowed !== undefined;

  if (!hasTeamContext) {
    events.push({ type: 'CP', count: 1, spp: 1, reason: 'participation (titulaire OL, no team context)' });
    return events;
  }

  if (teamPassRating > 100) {
    events.push({ type: 'CP', count: 1, spp: 1, reason: `bonus CP (team rating ${teamPassRating} >100)` });
  }
  if (teamRushYards > 150) {
    events.push({ type: 'CP', count: 1, spp: 1, reason: `bonus CP (team rush ${teamRushYards} >150)` });
  }
  if (teamSacksAllowed < 2) {
    events.push({ type: 'CP', count: 1, spp: 1, reason: `bonus CP (team sacks allowed ${teamSacksAllowed} <2)` });
  }
  if (teamSacksAllowed > 4) {
    events.push({ type: 'MALUS', count: 1, spp: -1, reason: `malus (team sacks allowed ${teamSacksAllowed} >4)` });
  }

  return events;
}

// ────────────────────────────────────────────────────────────────────
// Dispatcher principal
// ────────────────────────────────────────────────────────────────────

/**
 * Calcule les SPP d'un joueur a partir de ses stats NFL.
 *
 * Dispatch par `bbPosition` (Q5 : la race est implicite dans bbPosition
 * via la couche position-to-bb).
 *
 * @returns Breakdown deterministe (replay-friendly).
 */
export function computeSpp(stat: NflPlayerStatLine): SppBreakdown {
  const role = getBbPositionRole(stat.bbPosition);
  let events: readonly SppEvent[];

  // Routing : on prend le poste BB comme signal principal, fallback role
  switch (stat.bbPosition) {
    case 'Thrower':
      events = scoreThrower(stat);
      break;
    case 'Catcher':
    case 'Ghoul':
      events = scoreCatcher(stat);
      break;
    case 'GutterRunner':
    case 'Runner':
    case 'Werewolf':
      // Joueurs polyvalents : score offensif si stats offensives, sinon
      // defensif (CB/S Skaven mappe en GutterRunner).
      events = hasOffensiveStats(stat) ? scoreRunner(stat) : scoreDefensiveBack(stat);
      break;
    case 'Blitzer':
    case 'StormVermin':
    case 'BlackOrc':
    case 'Wardancer':
    case 'Berserker':
    case 'Ulfwerener':
    case 'Wight':
    case 'Trollslayer':
    case 'Khorngor':
    case 'Bloodspawn':
      // Blitzer polyvalent : offensif si stats offensives, defensif sinon
      events = hasOffensiveStats(stat) ? scoreRunner(stat) : scoreDefensiveBlitzer(stat);
      break;
    case 'RatOgre':
    case 'Treeman':
    case 'Troll':
    case 'Ogre':
    case 'Yhetee':
    case 'Deathroller':
    case 'Bloodthirster':
    case 'FleshGolem':
      events = scoreBigGuy(stat);
      break;
    case 'Lineman':
    case 'Blocker':
    case 'Zombie':
    case 'Bloodseeker':
    case 'Goblin':
      // Lineman OL : approche QB-derived
      events = scoreLineman(stat);
      break;
    default: {
      // Exhaustivite check : tout BbPosition doit etre route. Fallback safe.
      const _exhaustive: never = stat.bbPosition;
      void _exhaustive;
      void role;
      events = [];
    }
  }

  const totalSpp = events.reduce((sum, e) => sum + e.spp, 0);
  return {
    events,
    totalSpp,
    mvpEligible: totalSpp > 0,
  };
}

function hasOffensiveStats(stat: NflPlayerStatLine): boolean {
  return (
    (stat.rushYards ?? 0) > 0 ||
    (stat.rushTd ?? 0) > 0 ||
    (stat.recYards ?? 0) > 0 ||
    (stat.recTd ?? 0) > 0 ||
    (stat.receptions ?? 0) > 0
  );
}

/**
 * Applique un multiplicateur captain (Q3 : ×1.5 captain + ×1.2 vice).
 * Resultat arrondi a l'entier le plus proche (preserve la lisibilite UI).
 */
export function applyCaptainMultiplier(
  baseSpp: number,
  role: 'captain' | 'vice' | 'none'
): number {
  switch (role) {
    case 'captain':
      return Math.round(baseSpp * 1.5);
    case 'vice':
      return Math.round(baseSpp * 1.2);
    case 'none':
      return baseSpp;
  }
}
