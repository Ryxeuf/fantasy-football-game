/**
 * Fiche admin d'une ligue : types de la réponse `GET /admin/leagues/:id` et
 * construction du patch d'édition. Pur (pas de React), testé à part.
 */

import {
  parseIntField,
  type NumberFieldDef,
} from "../../_components/competition-admin";

export interface AdminLeagueSeason {
  id: string;
  seasonNumber: number;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  participantsCount: number;
  /** Équipes inscrites. Optionnel : absent d'une API antérieure. */
  participants?: AdminLeagueParticipant[];
}

export interface AdminLeagueParticipant {
  teamId: string;
  teamName: string;
  roster: string;
  coachName: string | null;
  status: string;
  deleted: boolean;
}

export interface AdminLeagueDetail {
  id: string;
  name: string;
  description: string | null;
  ruleset: string;
  status: string;
  isPublic: boolean;
  maxParticipants: number;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
  creatorId: string;
  creator: { id: string; coachName: string | null; email: string };
  createdAt: string;
  updatedAt: string;
  scoringLocked: boolean;
  seasons: AdminLeagueSeason[];
}

export type ScoringKey = "winPoints" | "drawPoints" | "lossPoints" | "forfeitPoints";

export const SCORING_FIELDS: ReadonlyArray<NumberFieldDef<ScoringKey>> = [
  { key: "winPoints", label: "Victoire", min: 0, max: 10 },
  { key: "drawPoints", label: "Nul", min: 0, max: 10 },
  { key: "lossPoints", label: "Défaite", min: -10, max: 10 },
  { key: "forfeitPoints", label: "Forfait", min: -10, max: 10 },
];

export interface FormState {
  name: string;
  description: string;
  maxParticipants: string;
  scoring: Record<ScoringKey, string>;
}

export function toForm(l: AdminLeagueDetail): FormState {
  return {
    name: l.name,
    description: l.description ?? "",
    maxParticipants: String(l.maxParticipants),
    scoring: {
      winPoints: String(l.winPoints),
      drawPoints: String(l.drawPoints),
      lossPoints: String(l.lossPoints),
      forfeitPoints: String(l.forfeitPoints),
    },
  };
}

/**
 * Patch minimal : seuls les champs modifiés partent (le barème n'est donc
 * pas envoyé — et ne déclenche pas le 409 du verrou — quand on ne touche
 * qu'au nom). Pur, exporté pour test.
 */
export function buildLeaguePatch(
  league: AdminLeagueDetail,
  form: FormState,
): { patch: Record<string, unknown>; error: string | null } {
  const patch: Record<string, unknown> = {};
  const name = form.name.trim();
  if (!name) return { patch, error: "Le nom est obligatoire" };
  if (name !== league.name) patch.name = name;
  const description = form.description.trim();
  if (description !== (league.description ?? "")) {
    patch.description = description || null;
  }
  const max = parseIntField(form.maxParticipants);
  if (max === null || max < 2 || max > 128) {
    return { patch, error: "Capacité : un entier entre 2 et 128" };
  }
  if (max !== league.maxParticipants) patch.maxParticipants = max;
  for (const f of SCORING_FIELDS) {
    const v = parseIntField(form.scoring[f.key]);
    if (v === null || v < (f.min ?? -Infinity) || v > (f.max ?? Infinity)) {
      return {
        patch,
        error: `${f.label} : un entier entre ${f.min} et ${f.max}`,
      };
    }
    if (v !== league[f.key]) patch[f.key] = v;
  }
  return { patch, error: null };
}

