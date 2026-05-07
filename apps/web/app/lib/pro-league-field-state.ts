/**
 * Dérive un "état field" à partir d'un flux d'events `MatchEvent[]` —
 * sprint Pro League lot 1.B.3.
 *
 * La sim Pro League est hybride yards-level (cf. sim-engine) : on
 * n'a pas de positions individuelles de joueurs. On reconstruit à
 * la place une représentation abstraite mais expressive :
 *   - position de la balle (yardline 0-26)
 *   - équipe en possession
 *   - score
 *   - dernier event "flashable" (TD / CASUALTY / NUFFLE)
 *
 * Cet helper est PUR — pas d'I/O, pas de Pixi. Testable seul.
 */

import type { MatchEvent } from "@bb/shared-types";

/** Largeur du terrain BB en yards (cf. sim-engine FIELD_YARDS). */
export const PRO_LEAGUE_FIELD_YARDS = 26;

export type DrivingTeam = "home" | "away";

export interface ProLeagueFieldState {
  /** Score courant (cumul des events TD). */
  readonly score: { home: number; away: number };
  /** Position de la balle, 0..26 yards depuis le côté de l'équipe en
   *  possession. `null` quand pas encore d'info (avant le 1er
   *  TURN_START par ex.). */
  readonly ballYardline: number | null;
  /** Équipe en possession lors du dernier TURN_START. `null` au début. */
  readonly drivingTeam: DrivingTeam | null;
  /** Quart-temps : 1, 2 ou "final" (post-END). */
  readonly half: 1 | 2 | "final";
  /** Dernier event "flashable" + son timestamp local (ms wall-clock).
   *  Permet à l'UI de déclencher une animation pendant ~1s.
   *  `null` si aucun n'a encore été émis. */
  readonly lastFlash: {
    readonly type: "TD" | "CASUALTY" | "NUFFLE";
    readonly team?: DrivingTeam;
    /** Index de l'event source dans `events[]`. Utile pour éviter de
     *  re-flasher le même event sur un re-render. */
    readonly eventIndex: number;
  } | null;
  /** Index du dernier event consommé (pour debugging / cohérence). */
  readonly cursor: number;
}

/** État initial à passer à `deriveProLeagueFieldState` au 1er render. */
export const INITIAL_FIELD_STATE: ProLeagueFieldState = {
  score: { home: 0, away: 0 },
  ballYardline: null,
  drivingTeam: null,
  half: 1,
  lastFlash: null,
  cursor: -1,
};

/**
 * Recompute l'état field à partir du flux complet d'events. La fonction
 * est idempotente : appeler 2 fois avec le même array donne le même
 * résultat.
 */
export function deriveProLeagueFieldState(
  events: readonly MatchEvent[],
): ProLeagueFieldState {
  let home = 0;
  let away = 0;
  let ballYardline: number | null = null;
  let drivingTeam: DrivingTeam | null = null;
  let half: 1 | 2 | "final" = 1;
  let lastFlash: ProLeagueFieldState["lastFlash"] = null;

  for (let i = 0; i < events.length; i += 1) {
    const ev = events[i];
    switch (ev.type) {
      case "TURN_START": {
        const meta = (ev.meta ?? {}) as Record<string, unknown>;
        const yard = meta.ballYardline;
        if (typeof yard === "number") ballYardline = yard;
        const team = meta.drivingTeam;
        if (team === "home" || team === "away") drivingTeam = team;
        break;
      }
      case "TD": {
        const meta = (ev.meta ?? {}) as Record<string, unknown>;
        const team = meta.team;
        if (team === "home") home += 1;
        else if (team === "away") away += 1;
        lastFlash = {
          type: "TD",
          team: team === "home" || team === "away" ? team : undefined,
          eventIndex: i,
        };
        break;
      }
      case "CASUALTY": {
        lastFlash = { type: "CASUALTY", eventIndex: i };
        break;
      }
      case "NUFFLE": {
        lastFlash = { type: "NUFFLE", eventIndex: i };
        break;
      }
      case "HALFTIME": {
        half = 2;
        break;
      }
      case "END": {
        half = "final";
        break;
      }
      default:
        break;
    }
  }

  return {
    score: { home, away },
    ballYardline,
    drivingTeam,
    half,
    lastFlash,
    cursor: events.length - 1,
  };
}
