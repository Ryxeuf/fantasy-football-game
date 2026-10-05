/**
 * Fiche admin d'une coupe : forme de `GET /cup/:id` utile à la console et
 * construction du patch `PATCH /cup/:id`. Pur (pas de React), testé à part.
 */

import {
  parseIntField,
  type NumberFieldDef,
} from "../../_components/competition-admin";

export type CupScoringKey =
  | "winPoints"
  | "drawPoints"
  | "lossPoints"
  | "forfeitPoints"
  | "touchdownPoints"
  | "blockCasualtyPoints"
  | "foulCasualtyPoints"
  | "passPoints";

/** Bornes reprises de `updateCupSchema` (serveur). */
export const CUP_RESULT_FIELDS: ReadonlyArray<NumberFieldDef<CupScoringKey>> = [
  { key: "winPoints", label: "Victoire", min: -1000, max: 10000 },
  { key: "drawPoints", label: "Nul", min: -1000, max: 10000 },
  { key: "lossPoints", label: "Défaite", min: -1000, max: 10000 },
  { key: "forfeitPoints", label: "Forfait", min: -10000, max: 10000 },
];

export const CUP_ACTION_FIELDS: ReadonlyArray<NumberFieldDef<CupScoringKey>> = [
  { key: "touchdownPoints", label: "Par touchdown", min: -1000, max: 1000 },
  {
    key: "blockCasualtyPoints",
    label: "Sortie sur blocage",
    min: -1000,
    max: 1000,
  },
  {
    key: "foulCasualtyPoints",
    label: "Sortie sur agression",
    min: -1000,
    max: 1000,
  },
  { key: "passPoints", label: "Par passe réussie", min: -1000, max: 1000 },
];

const ALL_SCORING_FIELDS = [...CUP_RESULT_FIELDS, ...CUP_ACTION_FIELDS];

export const PLAYOFF_SIZES = [0, 2, 4, 8] as const;

export interface AdminCupParticipant {
  id: string;
  name: string;
  roster: string;
  owner: { id: string; coachName: string | null };
}

export interface AdminCupDetail {
  id: string;
  name: string;
  description: string | null;
  creator: { id: string; coachName: string | null };
  ruleset: string;
  format: string;
  validated: boolean;
  isPublic: boolean;
  status: string;
  participantCount: number;
  participants: AdminCupParticipant[];
  scoringConfig: Record<CupScoringKey, number>;
  playoffSize: number;
  createdAt: string;
}

export interface CupFormState {
  name: string;
  description: string;
  playoffSize: number;
  scoring: Record<CupScoringKey, string>;
}

export function toCupForm(cup: AdminCupDetail): CupFormState {
  const scoring = {} as Record<CupScoringKey, string>;
  for (const f of ALL_SCORING_FIELDS) {
    scoring[f.key] = String(cup.scoringConfig?.[f.key] ?? 0);
  }
  return {
    name: cup.name,
    description: cup.description ?? "",
    playoffSize: cup.playoffSize ?? 0,
    scoring,
  };
}

/**
 * Patch minimal : seuls les champs modifiés partent. En particulier la
 * taille du bracket n'est envoyée que si elle change — le serveur la
 * refuse (409) une fois le bracket généré.
 */
export function buildCupPatch(
  cup: AdminCupDetail,
  form: CupFormState,
): { patch: Record<string, unknown>; error: string | null } {
  const patch: Record<string, unknown> = {};
  const name = form.name.trim();
  if (!name) return { patch, error: "Le nom est obligatoire" };
  if (name !== cup.name) patch.name = name;
  const description = form.description.trim();
  if (description !== (cup.description ?? "")) {
    patch.description = description || null;
  }
  if (form.playoffSize !== (cup.playoffSize ?? 0)) {
    patch.playoffSize = form.playoffSize;
  }
  for (const f of ALL_SCORING_FIELDS) {
    const v = parseIntField(form.scoring[f.key]);
    if (v === null || v < (f.min ?? -Infinity) || v > (f.max ?? Infinity)) {
      return {
        patch,
        error: `${f.label} : un entier entre ${f.min} et ${f.max}`,
      };
    }
    if (v !== cup.scoringConfig?.[f.key]) patch[f.key] = v;
  }
  return { patch, error: null };
}
