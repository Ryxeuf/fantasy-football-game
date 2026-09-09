"use client";
import { useMemo } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  parseBonusRulesFromApi,
  type BonusRuleValue,
} from "../_components/bonus-rules";
import { appliesLabel, bonusConditionText } from "../_components/bonus-rule-labels";

/**
 * Système de points d'une ligue, en lecture seule : barème
 * victoire/nul/défaite/forfait ET règles de points bonus.
 *
 * Le panneau vit juste au-dessus du classement : c'est là qu'on lit une
 * colonne « Pts » et qu'on a besoin de savoir d'où elle sort. Les bonus
 * y figurent parce qu'ils étaient jusqu'ici invisibles hors de l'écran
 * d'édition du commissaire — le coach voyait la colonne « Bonus » du
 * classement sans jamais pouvoir savoir comment la gagner.
 */

interface ScoringSystemPanelProps {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
  /**
   * `bonusPointsConfig` brut de l'API (array natif PG ou chaîne sqlite).
   * Absent / vide = la ligue n'a aucune règle de bonus.
   */
  bonusPointsConfig?: unknown;
}

export function ScoringSystemPanel({
  winPoints,
  drawPoints,
  lossPoints,
  forfeitPoints,
  bonusPointsConfig,
}: ScoringSystemPanelProps) {
  const { t } = useLanguage();
  const bonusRules: BonusRuleValue[] = useMemo(
    () => parseBonusRulesFromApi(bonusPointsConfig),
    [bonusPointsConfig],
  );

  const lines: Array<{ key: string; label: string; points: number }> = [
    { key: "win", label: t.leagues.scoreWin, points: winPoints },
    { key: "draw", label: t.leagues.scoreDraw, points: drawPoints },
    { key: "loss", label: t.leagues.scoreLoss, points: lossPoints },
    { key: "forfeit", label: t.leagues.scoreForfeit, points: forfeitPoints },
  ];

  return (
    <section
      data-testid="league-scoring-config"
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
        {t.leagues.scoringConfig}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        {lines.map((line) => (
          <div key={line.key} data-testid={`league-score-${line.key}`}>
            {line.label} : <strong>{line.points}</strong> {t.leagues.points}
          </div>
        ))}
      </div>

      {bonusRules.length > 0 ? (
        <div data-testid="league-bonus-rules" className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            {t.leagues.formBonusTitle}
          </h4>
          <ul className="space-y-1 text-sm">
            {bonusRules.map((rule) => (
              <li
                key={rule.id}
                data-testid={`league-bonus-rule-${rule.id}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1"
              >
                <span className="inline-flex min-w-[2.5rem] justify-center rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-800">
                  {rule.points > 0 ? `+${rule.points}` : rule.points}
                </span>
                {rule.label ? (
                  <span className="font-medium text-nuffle-anthracite">
                    {rule.label}
                  </span>
                ) : null}
                <span className="text-gray-600">
                  {bonusConditionText(t, rule)}
                </span>
                <span className="text-xs text-gray-500">
                  ({appliesLabel(t, rule.appliesTo)})
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500">{t.leagues.standingsBonusHint}</p>
        </div>
      ) : null}
    </section>
  );
}
