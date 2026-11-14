/**
 * Carte PNG d'un joueur depuis la fiche de roster d'une compétition — même
 * rendu que la fiche « Mes équipes » (`/api/player-card`, change
 * export-player-cards). La carte reprend les chiffres AFFICHÉS par la fiche :
 * carrière toutes compétitions en ligue, matchs de la coupe en coupe.
 */

import {
  buildTeamPlayerCardData,
  encodeCardPayload,
} from "../../lib/player-card/card-model";

export interface CompetitionCardPlayer {
  readonly name: string;
  readonly number: number | null;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: string;
  readonly spp: number;
  readonly matchesPlayed?: number;
  readonly totalTouchdowns?: number;
  readonly totalCasualties?: number;
  readonly dead: boolean;
  readonly value?: number;
  readonly imageUrl?: string | null;
}

export interface CompetitionCardContext {
  readonly teamName: string;
  readonly rosterSlug: string;
  readonly positionName: string;
  /** Illustration du poste : portrait d'un joueur sans photo. */
  readonly positionImageUrl?: string | null;
}

/** URL de la carte PNG (`download` force l'attachment). */
export function competitionPlayerCardUrl(
  p: CompetitionCardPlayer,
  ctx: CompetitionCardContext,
  download: boolean,
): string {
  const cost = typeof p.value === "number" && p.value > 0 ? p.value : null;
  const data = buildTeamPlayerCardData(
    {
      name: p.name,
      number: p.number ?? 0,
      ma: p.ma,
      st: p.st,
      ag: p.ag,
      pa: p.pa,
      av: p.av,
      skills: p.skills ?? "",
      spp: p.spp,
      matchesPlayed: p.matchesPlayed ?? 0,
      totalTouchdowns: p.totalTouchdowns ?? 0,
      totalCasualties: p.totalCasualties ?? 0,
      dead: p.dead,
      firedAt: null,
      imageUrl: p.imageUrl ?? ctx.positionImageUrl ?? null,
    },
    {
      lang: "fr",
      positionName: ctx.positionName,
      teamName: ctx.teamName,
      rosterSlug: ctx.rosterSlug,
      cost,
    },
  );
  return `/api/player-card?d=${encodeCardPayload(data)}${download ? "&download=1" : ""}`;
}
