"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import { INDUCEMENT_CATALOGUE } from "@bb/game-engine";
import { BonusRulesEditor } from "./BonusRulesEditor";
import type { BonusRuleValue } from "./bonus-rules";

// FR17 — coups de pouce paramétrables au niveau ligue (hors Star Players,
// qui dépendent des rosters). Source : catalogue officiel du game-engine.
const INDUCEMENT_OPTIONS = INDUCEMENT_CATALOGUE.filter(
  (d) => d.slug !== "star_player",
).map((d) => ({ slug: d.slug, name: d.displayNameFr }));

// L2.D — Formulaire de ligue partage entre la creation (`/leagues/new`,
// POST /leagues) et l'edition (`/leagues/:id/edit`, PATCH /leagues/:id).
// Le composant detient l'etat du formulaire + le chargement des rosters
// autorises ; le parent gere l'appel API (create vs update), l'etat
// `submitting`/`error` et la navigation.

export interface LeagueFormValues {
  name: string;
  description: string;
  ruleset: "season_2" | "season_3";
  isPublic: boolean;
  maxParticipants: number;
  allowedRosters: string[];
  /** FR17 — coups de pouce autorisés (slugs). Vide = tous autorisés. */
  allowedInducements: string[];
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
  // E1 — Regles de points bonus configurables (optionnel). Vide = aucun
  // bonus. Serialise vers `bonusPointsConfig` par les pages parentes.
  bonusPointsConfig: BonusRuleValue[];
}

export const LEAGUE_FORM_DEFAULTS: LeagueFormValues = {
  name: "",
  description: "",
  ruleset: "season_3",
  isPublic: true,
  maxParticipants: 16,
  allowedRosters: [],
  allowedInducements: [],
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  forfeitPoints: -1,
  bonusPointsConfig: [],
};

interface RosterListItem {
  slug: string;
  name: string;
}

interface LeagueFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<LeagueFormValues>;
  submitting: boolean;
  error: string | null;
  /** Href du lien "Annuler" (liste en create, detail en edit). */
  cancelHref: string;
  onSubmit: (values: LeagueFormValues) => void;
}

export function LeagueForm({
  mode,
  initialValues,
  submitting,
  error,
  cancelHref,
  onSubmit,
}: LeagueFormProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<LeagueFormValues>({
    ...LEAGUE_FORM_DEFAULTS,
    ...initialValues,
  });
  const [rosters, setRosters] = useState<RosterListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadRosters() {
      try {
        const data = await apiRequest<{ rosters: RosterListItem[] }>(
          `/api/rosters?ruleset=${form.ruleset}`,
        );
        if (!cancelled) setRosters(data.rosters ?? []);
      } catch {
        if (!cancelled) setRosters([]);
      }
    }
    loadRosters();
    return () => {
      cancelled = true;
    };
  }, [form.ruleset]);

  const updateField = useCallback(
    <K extends keyof LeagueFormValues>(key: K, value: LeagueFormValues[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleRoster = useCallback((slug: string) => {
    setForm((prev) => {
      const has = prev.allowedRosters.includes(slug);
      return {
        ...prev,
        allowedRosters: has
          ? prev.allowedRosters.filter((s) => s !== slug)
          : [...prev.allowedRosters, slug],
      };
    });
  }, []);

  const toggleInducement = useCallback((slug: string) => {
    setForm((prev) => {
      const has = prev.allowedInducements.includes(slug);
      return {
        ...prev,
        allowedInducements: has
          ? prev.allowedInducements.filter((s) => s !== slug)
          : [...prev.allowedInducements, slug],
      };
    });
  }, []);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (form.name.trim().length === 0) return false;
    if (form.maxParticipants < 2) return false;
    return true;
  }, [form, submitting]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      onSubmit(form);
    },
    [canSubmit, form, onSubmit],
  );

  const submitLabel = submitting
    ? t.leagues.formSubmitting
    : mode === "create"
      ? t.leagues.formSubmitCreate
      : t.leagues.formSubmitSave;

  return (
    <>
      {error ? (
        <div
          data-testid="league-form-error"
          className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              {t.leagues.formNameLabel}
            </span>
            <input
              data-testid="league-form-name"
              type="text"
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              {t.leagues.formRulesetLabel}
            </span>
            <select
              data-testid="league-form-ruleset"
              value={form.ruleset}
              onChange={(e) =>
                updateField(
                  "ruleset",
                  e.target.value as LeagueFormValues["ruleset"],
                )
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="season_3">{t.leagues.rulesetSeason3}</option>
              <option value="season_2">{t.leagues.rulesetSeason2}</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">
              {t.leagues.formDescriptionLabel}
            </span>
            <textarea
              data-testid="league-form-description"
              rows={3}
              maxLength={500}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              {t.leagues.formMaxParticipantsLabel}
            </span>
            <input
              data-testid="league-form-max"
              type="number"
              min={2}
              max={128}
              required
              value={form.maxParticipants}
              onChange={(e) =>
                updateField("maxParticipants", Number(e.target.value))
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <fieldset className="block">
            <legend className="text-sm font-medium text-gray-700">
              {t.leagues.formPublicLabel}
            </legend>
            <div className="mt-1 flex gap-3">
              <label className="inline-flex items-center text-sm">
                <input
                  type="radio"
                  name="isPublic"
                  checked={form.isPublic}
                  onChange={() => updateField("isPublic", true)}
                  className="mr-1"
                />
                {t.leagues.formPublicYes}
              </label>
              <label className="inline-flex items-center text-sm">
                <input
                  type="radio"
                  name="isPublic"
                  checked={!form.isPublic}
                  onChange={() => updateField("isPublic", false)}
                  className="mr-1"
                />
                {t.leagues.formPublicNo}
              </label>
            </div>
          </fieldset>
        </div>

        <fieldset className="block">
          <legend className="text-sm font-medium text-gray-700">
            {t.leagues.formAllowedRostersLabel}
          </legend>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {rosters.map((r) => {
              const checked = form.allowedRosters.includes(r.slug);
              return (
                <label
                  key={r.slug}
                  className={`flex items-center gap-2 px-3 py-2 rounded border text-sm cursor-pointer ${
                    checked
                      ? "border-nuffle-gold bg-nuffle-gold/10"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRoster(r.slug)}
                  />
                  <span>{r.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* FR17 — coups de pouce autorisés (vide = tous autorisés). */}
        <fieldset className="block" data-testid="league-form-inducements">
          <legend className="text-sm font-medium text-gray-700">
            Coups de pouce autorisés
          </legend>
          <p className="text-xs text-gray-500 mt-0.5">
            Aucune case cochée = tous les coups de pouce sont autorisés. Les
            Star Players ne sont pas concernés (ils dépendent des rosters).
          </p>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {INDUCEMENT_OPTIONS.map((opt) => {
              const checked = form.allowedInducements.includes(opt.slug);
              return (
                <label
                  key={opt.slug}
                  className={`flex items-center gap-2 px-3 py-2 rounded border text-sm cursor-pointer ${
                    checked
                      ? "border-nuffle-gold bg-nuffle-gold/10"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleInducement(opt.slug)}
                  />
                  <span>{opt.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="block">
          <legend className="text-sm font-medium text-gray-700 mb-2">
            {t.leagues.formScoringTitle}
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ScoringField
              label={t.leagues.scoreWin}
              testId="league-form-win-points"
              min={0}
              max={10}
              value={form.winPoints}
              onChange={(v) => updateField("winPoints", v)}
            />
            <ScoringField
              label={t.leagues.scoreDraw}
              testId="league-form-draw-points"
              min={0}
              max={10}
              value={form.drawPoints}
              onChange={(v) => updateField("drawPoints", v)}
            />
            <ScoringField
              label={t.leagues.scoreLoss}
              testId="league-form-loss-points"
              min={-10}
              max={10}
              value={form.lossPoints}
              onChange={(v) => updateField("lossPoints", v)}
            />
            <ScoringField
              label={t.leagues.scoreForfeit}
              testId="league-form-forfeit-points"
              min={-10}
              max={10}
              value={form.forfeitPoints}
              onChange={(v) => updateField("forfeitPoints", v)}
            />
          </div>
        </fieldset>

        <BonusRulesEditor
          rules={form.bonusPointsConfig}
          onChange={(next) => updateField("bonusPointsConfig", next)}
        />

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            data-testid="league-form-submit"
            disabled={!canSubmit}
            className="px-4 py-2 rounded-md bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
          >
            {submitLabel}
          </button>
          <Link
            href={cancelHref}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            {t.leagues.formCancel}
          </Link>
        </div>
      </form>
    </>
  );
}

interface ScoringFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  testId: string;
  onChange: (next: number) => void;
}

function ScoringField({
  label,
  value,
  min,
  max,
  testId,
  onChange,
}: ScoringFieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        data-testid={testId}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
    </label>
  );
}
