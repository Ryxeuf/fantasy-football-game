/**
 * Haine (X) — le mot-clé haï se CHOISIT.
 *
 * Un joueur qui gagne le trait hait un Mot-clé de celui qui l'a mis sur la
 * touche, et un joueur en porte souvent plusieurs : un Zombie est *Humain*,
 * *Mort-Vivant* ET *Zombie*. Haïr l'une ou l'autre lignée ne recouvre pas les
 * mêmes adversaires au reste de la saison — c'est un choix de coach, pas un
 * défaut de catalogue. Jusqu'ici, la validation retenait d'office le premier
 * mot-clé éligible.
 *
 * Patron du repo (journaliers, mort relevé) : **le choix est stocké, le
 * candidat est dérivé**. `LeagueMatchSheet.hateChoices` ne porte que
 * `[{ victimPlayerId, keyword }]` ; la liste des candidats et de leurs
 * mots-clés se redérive à chaque lecture des évènements et des mots-clés de
 * l'auteur. Une correction de saisie qui change l'auteur d'une sortie change
 * donc les mots-clés proposés, sans backfill ; un choix devenu ineligible est
 * ignoré silencieusement (repli sur le premier éligible), exactement comme
 * une feuille antérieure à ce champ.
 *
 * 100 % PUR : ni Prisma ni DOM. `league-match-sheet` l'appelle à la lecture
 * (pour proposer), `league-hate-trait` à la validation (pour appliquer) — les
 * deux ne peuvent donc pas diverger.
 */

import {
  eligibleHateKeywords,
  normalizeKeyword,
  resolveHateKeyword,
} from "@bb/game-engine";
import type { MatchEventTeam } from "./league-match-summary";

/** Le choix STOCKÉ : un mot-clé retenu par joueur blessé. */
export interface HateChoice {
  readonly victimPlayerId: string;
  readonly keyword: string;
}

/** Une blessure candidate au jet de Haine, telle que la feuille la voit. */
export interface HateCandidateInjury {
  readonly victimPlayerId: string;
  /** Côté de la VICTIME : c'est elle qui gagnera le trait. */
  readonly side: MatchEventTeam;
  readonly causerPlayerId: string | null;
}

/** Ce que la feuille expose pour un candidat : de quoi choisir. */
export interface HateCandidateView {
  readonly victimPlayerId: string;
  readonly side: MatchEventTeam;
  readonly causerPlayerId: string;
  /** Mots-clés éligibles de l'auteur, dans l'ordre du catalogue. */
  readonly keywords: readonly string[];
  /** Mot-clé qui sera retenu à la validation (choix, sinon premier éligible). */
  readonly keyword: string;
  /** Le choix stocké a-t-il été retenu ? (faux = repli sur le défaut) */
  readonly chosen: boolean;
}

/** Parse tolérant (array natif PG / chaîne JSON du miroir SQLite). */
export function parseHateChoices(raw: unknown): HateChoice[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: HateChoice[] = [];
  const seen = new Set<string>();
  for (const e of arr) {
    if (!e || typeof e !== "object") continue;
    const victimPlayerId = (e as { victimPlayerId?: unknown }).victimPlayerId;
    const keyword = (e as { keyword?: unknown }).keyword;
    if (typeof victimPlayerId !== "string" || victimPlayerId.length === 0) {
      continue;
    }
    if (typeof keyword !== "string" || keyword.trim().length === 0) continue;
    // Un joueur ne hait qu'un Mot-clé par match : la dernière entrée gagne
    // serait arbitraire, la PREMIÈRE est stable d'une lecture à l'autre.
    if (seen.has(victimPlayerId)) continue;
    seen.add(victimPlayerId);
    out.push({ victimPlayerId, keyword: keyword.trim() });
  }
  return out;
}

/** Index par victime, pour les deux consommateurs (lecture et validation). */
export function hateChoiceMap(
  choices: readonly HateChoice[],
): ReadonlyMap<string, string> {
  return new Map(choices.map((c) => [c.victimPlayerId, c.keyword]));
}

/**
 * Candidats au jet de Haine, avec leurs mots-clés au choix.
 *
 * Écarte les mêmes cas que `buildHateCandidates` côté application : pas
 * d'auteur (auto-élimination, foule), auteur dont on ignore les mots-clés,
 * auteur n'ayant que des mots-clés de POSTE. Dédoublonne sur la VICTIME : la
 * règle n'accorde qu'un trait par joueur blessé et par match. Le premier
 * auteur consigné fait foi — l'ordre des évènements est celui de la feuille.
 */
export function buildHateCandidateViews(input: {
  readonly injuries: readonly HateCandidateInjury[];
  /** CSV de mots-clés par id de joueur (roster, journaliers, Stars, relevé). */
  readonly keywordsByPlayerId: ReadonlyMap<string, string>;
  readonly choices: readonly HateChoice[];
}): HateCandidateView[] {
  const chosenBy = hateChoiceMap(input.choices);
  const seen = new Set<string>();
  const out: HateCandidateView[] = [];
  for (const inj of input.injuries) {
    if (!inj.causerPlayerId) continue;
    if (seen.has(inj.victimPlayerId)) continue;
    const keywords = eligibleHateKeywords(
      input.keywordsByPlayerId.get(inj.causerPlayerId),
    );
    if (keywords.length === 0) continue;
    seen.add(inj.victimPlayerId);
    const preferred = chosenBy.get(inj.victimPlayerId) ?? null;
    const keyword = resolveHateKeyword(keywords.join(","), preferred);
    if (!keyword) continue;
    out.push({
      victimPlayerId: inj.victimPlayerId,
      side: inj.side,
      causerPlayerId: inj.causerPlayerId,
      keywords,
      keyword,
      // Vrai quand le choix STOCKÉ a été honoré — y compris s'il désigne le
      // premier mot-clé. Faux dès que le repli a joué : l'UI doit pouvoir
      // dire « le choix ne s'applique plus » après une correction d'auteur.
      chosen:
        preferred !== null &&
        normalizeKeyword(preferred) === normalizeKeyword(keyword),
    });
  }
  return out;
}

/**
 * Fusionne les choix reçus d'un PATCH avec ceux déjà stockés.
 *
 * Un coach ne saisit QUE son côté : écraser la colonne effacerait le choix de
 * l'adversaire. `keyword: null` retire le choix (retour au défaut). Les
 * entrées hors de `allowedVictimIds` sont ignorées — la garde de côté vit
 * dans la route, celle-ci ne fait que ne pas perdre le reste.
 */
export function mergeHateChoices(input: {
  readonly current: readonly HateChoice[];
  readonly incoming: ReadonlyArray<{
    readonly victimPlayerId: string;
    readonly keyword: string | null;
  }>;
  readonly allowedVictimIds: ReadonlySet<string>;
}): HateChoice[] {
  const byVictim = new Map(input.current.map((c) => [c.victimPlayerId, c]));
  for (const entry of input.incoming) {
    if (!input.allowedVictimIds.has(entry.victimPlayerId)) continue;
    if (entry.keyword === null || entry.keyword.trim().length === 0) {
      byVictim.delete(entry.victimPlayerId);
      continue;
    }
    byVictim.set(entry.victimPlayerId, {
      victimPlayerId: entry.victimPlayerId,
      keyword: entry.keyword.trim(),
    });
  }
  return [...byVictim.values()];
}
