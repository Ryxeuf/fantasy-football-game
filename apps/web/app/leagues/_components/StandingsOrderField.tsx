"use client";
import { TieBreakOrderEditor } from "../../components/TieBreakOrderEditor";
import {
  LEAGUE_TIE_BREAK_CATALOGUE,
  LEAGUE_TIE_BREAK_LABELS,
  describeDefaultLeagueTieBreak,
} from "./standings-order";

/**
 * Le bloc « Critères de classement » d'une ligue : légende, explication du
 * défaut et liste ordonnée.
 *
 * Extrait de `LeagueForm` parce qu'il est désormais servi à DEUX endroits —
 * le formulaire complet (ligue pas encore lancée) et le panneau réduit d'une
 * ligue VERROUILLÉE, où c'est le seul réglage qui reste modifiable. Deux
 * copies auraient divergé, et c'est justement le bloc dont le libellé porte
 * la règle.
 */

interface StandingsOrderFieldProps {
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Préfixe des `data-testid` de la liste ordonnée. */
  testIdPrefix?: string;
}

export function StandingsOrderField({
  value,
  onChange,
  disabled = false,
  testIdPrefix = "league-tiebreak",
}: StandingsOrderFieldProps) {
  return (
    <fieldset className="block" data-testid="league-form-tiebreak">
      <legend className="text-sm font-medium text-gray-700">
        Critères de classement
      </legend>
      <p className="text-xs text-gray-500 mt-0.5">
        Ajoutez les départages et ordonnez-les : ils sont appliqués du premier
        au dernier. Sans sélection, l&apos;ordre par défaut s&apos;applique (
        {describeDefaultLeagueTieBreak()}). Le nom de l&apos;équipe tranche
        toujours en dernier recours.
      </p>
      <div className="mt-2">
        <TieBreakOrderEditor
          value={value}
          onChange={onChange}
          catalogue={LEAGUE_TIE_BREAK_CATALOGUE}
          labels={LEAGUE_TIE_BREAK_LABELS}
          testIdPrefix={testIdPrefix}
          disabled={disabled}
        />
      </div>
    </fieldset>
  );
}
