"use client";
import { useCallback } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  type BonusRuleValue,
  type BonusConditionType,
  type BonusAppliesTo,
  BONUS_CONDITION_TYPES,
  BONUS_APPLIES_TO,
  BONUS_PRESETS,
  BOOLEAN_CONDITIONS,
  MAX_BONUS_RULES,
  presetToRule,
  emptyBonusRule,
} from "./bonus-rules";

// E1 — Editeur de regles de points bonus de ligue. Le commissaire
// compose une liste de regles (preset rapide ou regle personnalisee)
// appliquees automatiquement au scoring de chaque match. La validation
// fait autorite cote serveur (Zod + parseBonusConfig) ; cet editeur ne
// fait qu'un feedback immediat.

type Translations = ReturnType<typeof useLanguage>["t"];

interface BonusRulesEditorProps {
  rules: BonusRuleValue[];
  onChange: (next: BonusRuleValue[]) => void;
}

export function BonusRulesEditor({ rules, onChange }: BonusRulesEditorProps) {
  const { t } = useLanguage();
  const atMax = rules.length >= MAX_BONUS_RULES;

  const addPreset = useCallback(
    (presetKey: string) => {
      const preset = BONUS_PRESETS.find((p) => p.key === presetKey);
      if (!preset || rules.length >= MAX_BONUS_RULES) return;
      onChange([...rules, presetToRule(preset, presetLabel(t, presetKey))]);
    },
    [rules, onChange, t],
  );

  const addCustom = useCallback(() => {
    if (rules.length >= MAX_BONUS_RULES) return;
    onChange([...rules, emptyBonusRule(t.leagues.bonusNewRuleLabel)]);
  }, [rules, onChange, t]);

  const patchRule = useCallback(
    (index: number, patch: Partial<BonusRuleValue>) => {
      onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    },
    [rules, onChange],
  );

  const changeCondition = useCallback(
    (index: number, type: BonusConditionType) => {
      onChange(
        rules.map((r, i) => {
          if (i !== index) return r;
          if (BOOLEAN_CONDITIONS.has(type)) {
            return { ...r, condition: { type } };
          }
          return { ...r, condition: { type, value: r.condition.value ?? 3 } };
        }),
      );
    },
    [rules, onChange],
  );

  const removeRule = useCallback(
    (index: number) => {
      onChange(rules.filter((_, i) => i !== index));
    },
    [rules, onChange],
  );

  return (
    <fieldset className="block" data-testid="league-form-bonus">
      <legend className="text-sm font-medium text-gray-700 mb-1">
        {t.leagues.formBonusTitle}
      </legend>
      <p className="text-xs text-gray-500 mb-3">
        {t.leagues.formBonusDescription}
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {BONUS_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            data-testid={`bonus-preset-${p.key}`}
            disabled={atMax}
            onClick={() => addPreset(p.key)}
            className="px-2.5 py-1 rounded-full border border-nuffle-gold/50 bg-nuffle-gold/10 text-xs text-nuffle-anthracite disabled:opacity-40"
          >
            + {presetLabel(t, p.key)}
          </button>
        ))}
        <button
          type="button"
          data-testid="bonus-add-custom"
          disabled={atMax}
          onClick={addCustom}
          className="px-2.5 py-1 rounded-full border border-gray-300 bg-white text-xs text-gray-700 disabled:opacity-40"
        >
          + {t.leagues.bonusAddCustom}
        </button>
      </div>

      {rules.length === 0 ? (
        <p data-testid="bonus-empty" className="text-xs text-gray-400">
          {t.leagues.formBonusEmpty}
        </p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule, index) => {
            const isBool = BOOLEAN_CONDITIONS.has(rule.condition.type);
            return (
              <li
                key={rule.id}
                data-testid={`bonus-rule-${index}`}
                className="flex flex-wrap items-end gap-2 rounded border border-gray-200 bg-gray-50 p-2"
              >
                <label className="block grow min-w-[8rem]">
                  <span className="text-[11px] text-gray-500">
                    {t.leagues.bonusLabelField}
                  </span>
                  <input
                    data-testid={`bonus-rule-${index}-label`}
                    type="text"
                    maxLength={120}
                    value={rule.label}
                    onChange={(e) => patchRule(index, { label: e.target.value })}
                    className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] text-gray-500">
                    {t.leagues.bonusConditionField}
                  </span>
                  <select
                    data-testid={`bonus-rule-${index}-condition`}
                    value={rule.condition.type}
                    onChange={(e) =>
                      changeCondition(index, e.target.value as BonusConditionType)
                    }
                    className="mt-0.5 block rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                  >
                    {BONUS_CONDITION_TYPES.map((c) => (
                      <option key={c} value={c}>
                        {conditionLabel(t, c)}
                      </option>
                    ))}
                  </select>
                </label>

                {!isBool ? (
                  <label className="block w-16">
                    <span className="text-[11px] text-gray-500">
                      {t.leagues.bonusValueField}
                    </span>
                    <input
                      data-testid={`bonus-rule-${index}-value`}
                      type="number"
                      min={0}
                      max={100}
                      value={rule.condition.value ?? 0}
                      onChange={(e) =>
                        patchRule(index, {
                          condition: {
                            type: rule.condition.type,
                            value: toInt(e.target.value, 0),
                          },
                        })
                      }
                      className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                ) : null}

                <label className="block w-16">
                  <span className="text-[11px] text-gray-500">
                    {t.leagues.bonusPointsField}
                  </span>
                  <input
                    data-testid={`bonus-rule-${index}-points`}
                    type="number"
                    min={-10}
                    max={10}
                    value={rule.points}
                    onChange={(e) =>
                      patchRule(index, { points: toInt(e.target.value, 0) })
                    }
                    className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] text-gray-500">
                    {t.leagues.bonusAppliesField}
                  </span>
                  <select
                    data-testid={`bonus-rule-${index}-applies`}
                    value={rule.appliesTo}
                    onChange={(e) =>
                      patchRule(index, {
                        appliesTo: e.target.value as BonusAppliesTo,
                      })
                    }
                    className="mt-0.5 block rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                  >
                    {BONUS_APPLIES_TO.map((a) => (
                      <option key={a} value={a}>
                        {appliesLabel(t, a)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  data-testid={`bonus-rule-${index}-remove`}
                  onClick={() => removeRule(index)}
                  className="px-2 py-1 text-xs text-red-600 hover:text-red-800"
                >
                  {t.leagues.bonusRemove}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {atMax ? (
        <p className="mt-2 text-xs text-amber-600">{t.leagues.formBonusMax}</p>
      ) : null}
    </fieldset>
  );
}

function toInt(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function presetLabel(t: Translations, key: string): string {
  switch (key) {
    case "3tds":
      return t.leagues.bonusPreset3Tds;
    case "3cas":
      return t.leagues.bonusPreset3Cas;
    case "cleanSheet":
      return t.leagues.bonusPresetCleanSheet;
    case "shutoutWin":
      return t.leagues.bonusPresetShutoutWin;
    default:
      return key;
  }
}

function conditionLabel(t: Translations, type: BonusConditionType): string {
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

function appliesLabel(t: Translations, applies: BonusAppliesTo): string {
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
