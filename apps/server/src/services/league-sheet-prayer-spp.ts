/**
 * PSP accordés par les Prières à Nuffle d'une feuille de match.
 *
 * Trois prières de la table (D16) modifient le barème de PSP d'un côté et
 * sont entièrement dérivables de la feuille :
 *
 *  - 10 « Passe Parfaite » : une Réussite rapporte 2 PSP au lieu de 1
 *    ⇒ +1 PSP par Réussite du LANCEUR ;
 *  - 11 « Réception Étourdissante » : réceptionner le ballon à la suite
 *    d'une Action de Passe rapporte 1 PSP ⇒ +1 PSP par réception du
 *    RÉCEPTIONNEUR (qui n'en gagnait aucun sans cette prière) ;
 *  - 13 « Frénésie d'Agression » : une Élimination infligée lors d'une
 *    Action d'Agression rapporte les PSP d'Élimination. Celle-ci n'est pas
 *    un bonus additif : elle change la QUALIFICATION de l'agression, qui
 *    devient une sortie (compteur d'équipe, PSP, classement des cogneurs).
 *    Elle est donc servie au summarizer (`foulingFrenzySides`), pas
 *    ajoutée après coup.
 *
 * La prière 12 « Interaction avec les Fans » (2 PSP à qui pousse un
 * adversaire dans le Public) n'est PAS câblée : la feuille ne saisit pas
 * l'auteur d'une sortie par le public.
 *
 * 100 % PUR (aucun Prisma) : la feuille fournit les prières saisies et les
 * stat-lines du summarizer. Le même calcul sert donc à l'affichage et à la
 * validation, qui ne peuvent pas diverger.
 */

import type {
  MatchSummary,
  MatchEventTeam,
  SummarySides,
} from "./league-match-summary";

/** Identifiants de la table des Prières (cf. `PRAYERS_TABLE` du moteur). */
export const PERFECT_PASSING_ROLL = 10;
export const STUNNING_CATCH_ROLL = 11;
export const FOULING_FRENZY_ROLL = 13;
const PERFECT_PASSING_ID = "perfect-passing";
const STUNNING_CATCH_ID = "stunning-catch";
const FOULING_FRENZY_ID = "fouling-frenzy";

/** PSP supplémentaires par Réussite sous « Passe Parfaite » (2 au lieu de 1). */
const PERFECT_PASSING_EXTRA_SPP = 1;
/** PSP par réception sous « Réception Étourdissante ». */
const STUNNING_CATCH_SPP = 1;

/** Une prière obtenue par une équipe : le jet D16 et/ou son identifiant. */
export interface SheetPrayer {
  readonly roll: number | null;
  readonly prayerId: string | null;
}

/**
 * Parse tolérant de `prayersHome/Away` : tableau natif (PG), chaîne JSON
 * (miroir sqlite), null. Une entrée illisible est ignorée plutôt que de
 * faire échouer le calcul des PSP de toute la feuille.
 */
export function parseSheetPrayers(raw: unknown): readonly SheetPrayer[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: SheetPrayer[] = [];
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as { roll?: unknown; prayerId?: unknown };
    out.push({
      roll:
        typeof o.roll === "number" && Number.isFinite(o.roll) ? o.roll : null,
      prayerId: typeof o.prayerId === "string" ? o.prayerId : null,
    });
  }
  return out;
}

/**
 * Une prière est reconnue par son JET autant que par son identifiant : le
 * jet est la donnée saisie et fait foi, `prayerId` n'étant qu'un confort
 * d'affichage (il peut manquer sur une feuille ancienne).
 */
function hasPrayer(
  prayers: readonly SheetPrayer[],
  roll: number,
  id: string,
): boolean {
  return prayers.some((p) => p.roll === roll || p.prayerId === id);
}

/** Prières actives d'un côté, réduites aux effets sur les PSP. */
export interface PrayerSppEffects {
  readonly perfectPassing: boolean;
  readonly stunningCatch: boolean;
  /** 13 — une Élimination sur Agression rapporte les PSP d'Élimination. */
  readonly foulingFrenzy: boolean;
}

export function prayerSppEffects(raw: unknown): PrayerSppEffects {
  const prayers = parseSheetPrayers(raw);
  return {
    perfectPassing: hasPrayer(
      prayers,
      PERFECT_PASSING_ROLL,
      PERFECT_PASSING_ID,
    ),
    stunningCatch: hasPrayer(prayers, STUNNING_CATCH_ROLL, STUNNING_CATCH_ID),
    foulingFrenzy: hasPrayer(prayers, FOULING_FRENZY_ROLL, FOULING_FRENZY_ID),
  };
}

/**
 * Côtés sous « Frénésie d'Agression », dans la forme attendue par le
 * summarizer (`MatchSummaryOptions.foulingFrenzy`). Chaque côté n'est béni
 * que par SES prières : celle du domicile ne qualifie pas les agressions de
 * l'extérieur.
 */
export function foulingFrenzySides(
  prayersHome: unknown,
  prayersAway: unknown,
): SummarySides {
  return {
    home: prayerSppEffects(prayersHome).foulingFrenzy,
    away: prayerSppEffects(prayersAway).foulingFrenzy,
  };
}

/** Détail lisible d'un bonus, pour l'expliquer à l'écran. */
export interface PrayerSppBonus {
  readonly playerId: string;
  readonly side: MatchEventTeam;
  readonly spp: number;
  /** Prières ayant contribué, dans l'ordre de la table. */
  readonly prayerIds: readonly string[];
}

/**
 * PSP supplémentaires dus aux Prières, par joueur. Chaque côté n'applique
 * que SES prières : celles du domicile ne récompensent pas l'extérieur.
 *
 * Retourne uniquement les joueurs qui gagnent au moins 1 PSP — un côté sans
 * prière concernée ne produit aucune entrée.
 */
export function computePrayerSppBonuses(input: {
  readonly summary: MatchSummary;
  readonly prayersHome: unknown;
  readonly prayersAway: unknown;
}): readonly PrayerSppBonus[] {
  const effects: Record<MatchEventTeam, PrayerSppEffects> = {
    home: prayerSppEffects(input.prayersHome),
    away: prayerSppEffects(input.prayersAway),
  };
  if (
    !effects.home.perfectPassing &&
    !effects.home.stunningCatch &&
    !effects.away.perfectPassing &&
    !effects.away.stunningCatch
  ) {
    return [];
  }

  const out: PrayerSppBonus[] = [];
  for (const stat of input.summary.playerStats) {
    const active = effects[stat.side];
    let spp = 0;
    const prayerIds: string[] = [];
    if (active.perfectPassing && stat.completions > 0) {
      spp += stat.completions * PERFECT_PASSING_EXTRA_SPP;
      prayerIds.push(PERFECT_PASSING_ID);
    }
    if (active.stunningCatch && stat.receptions > 0) {
      spp += stat.receptions * STUNNING_CATCH_SPP;
      prayerIds.push(STUNNING_CATCH_ID);
    }
    if (spp > 0) {
      out.push({ playerId: stat.playerId, side: stat.side, spp, prayerIds });
    }
  }
  return out;
}

/**
 * Applique les bonus de Prières à une table `playerId -> PSP`. Le résultat
 * est une NOUVELLE table (l'entrée n'est pas mutée) : un joueur sans PSP au
 * barème mais récompensé par une prière y entre avec son seul bonus — c'est
 * le cas du réceptionneur pur, qui n'a ni Réussite ni TD.
 */
export function applyPrayerSppBonuses(
  base: Readonly<Record<string, number>>,
  bonuses: readonly PrayerSppBonus[],
): Record<string, number> {
  const out: Record<string, number> = { ...base };
  for (const bonus of bonuses) {
    out[bonus.playerId] = (out[bonus.playerId] ?? 0) + bonus.spp;
  }
  return out;
}
