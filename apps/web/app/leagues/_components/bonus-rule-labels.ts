import type { useLanguage } from "../../contexts/LanguageContext";
import {
  type BonusAppliesTo,
  type BonusConditionType,
  type BonusRuleValue,
  BOOLEAN_CONDITIONS,
} from "./bonus-rules";

/**
 * Libellés i18n d'une règle de points bonus, partagés par l'éditeur du
 * commissaire (`BonusRulesEditor`) et l'affichage en lecture seule du
 * système de points d'une ligue. Une seule source : les deux écrans ne
 * peuvent pas nommer différemment la même règle.
 */

type Translations = ReturnType<typeof useLanguage>["t"];

export function conditionLabel(
  t: Translations,
  type: BonusConditionType,
): string {
  switch (type) {
    case "tds_scored_gte":
      return t.leagues.bonusCondTdsScored;
    case "tds_conceded_lte":
      return t.leagues.bonusCondTdsConceded;
    case "cas_inflicted_gte":
      return t.leagues.bonusCondCasInflicted;
    case "killings_gte":
      return t.leagues.bonusCondKillings;
    case "completions_gte":
      return t.leagues.bonusCondCompletions;
    case "margin_gte":
      return t.leagues.bonusCondMargin;
    case "clean_sheet":
      return t.leagues.bonusCondCleanSheet;
    case "shut_out_win":
      return t.leagues.bonusCondShutoutWin;
  }
}

export function appliesLabel(
  t: Translations,
  applies: BonusAppliesTo,
): string {
  switch (applies) {
    case "both":
      return t.leagues.bonusAppliesBoth;
    case "home":
      return t.leagues.bonusAppliesHome;
    case "away":
      return t.leagues.bonusAppliesAway;
    case "winner":
      return t.leagues.bonusAppliesWinner;
    case "loser":
      return t.leagues.bonusAppliesLoser;
  }
}

/**
 * Condition d'une règle en une phrase : « TD marqués ≥ 3 ». Les
 * conditions booléennes (« Aucun TD encaissé ») n'ont pas de seuil.
 */
export function bonusConditionText(
  t: Translations,
  rule: BonusRuleValue,
): string {
  const label = conditionLabel(t, rule.condition.type);
  if (BOOLEAN_CONDITIONS.has(rule.condition.type)) return label;
  return `${label} ${rule.condition.value ?? 0}`;
}
