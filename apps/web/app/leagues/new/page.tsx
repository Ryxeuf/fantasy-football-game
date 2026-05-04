"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { LEAGUES_V2_UI_FLAG } from "../../lib/featureFlagKeys";

// Sprint Ligues v2 PR2 — formulaire de creation de ligue. Gate par le
// feature flag `leagues_v2_ui` : tant qu'il n'est pas active, on
// redirige vers la liste pour eviter d'exposer la fonctionnalite avant
// son lancement officiel. La verite de la creation reste serveur (Zod
// dans `createLeagueSchema` + service `createLeague`) ; ce composant
// est cosmetique et duplique simplement les bornes pour un feedback
// utilisateur immediat.

interface RosterListItem {
  slug: string;
  name: string;
}

interface CreatedLeague {
  id: string;
}

const RULESETS = ["season_2", "season_3"] as const;
type Ruleset = (typeof RULESETS)[number];

interface FormState {
  name: string;
  description: string;
  ruleset: Ruleset;
  isPublic: boolean;
  maxParticipants: number;
  allowedRosters: string[];
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
}

const DEFAULTS: FormState = {
  name: "",
  description: "",
  ruleset: "season_3",
  isPublic: true,
  maxParticipants: 16,
  allowedRosters: [],
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  forfeitPoints: -1,
};

export default function NewLeaguePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const flagEnabled = useFeatureFlag(LEAGUES_V2_UI_FLAG);

  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [rosters, setRosters] = useState<RosterListItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Le serveur applique aussi le gate (les routes API verifient
    // l'auth, pas le flag, mais sans flag UI on prefere ne meme pas
    // afficher la page). Redirection cote client pour rester coherent
    // avec OnlinePlayGate.
    if (!flagEnabled) {
      router.replace("/leagues");
    }
  }, [flagEnabled, router]);

  useEffect(() => {
    let cancelled = false;
    async function loadRosters() {
      try {
        const data = await apiRequest<{ rosters: RosterListItem[] }>(
          `/api/rosters?ruleset=${form.ruleset}`,
        );
        if (!cancelled) setRosters(data.rosters ?? []);
      } catch {
        // Liste optionnelle : si elle echoue, le formulaire reste
        // utilisable (allowedRosters vide = tous autorises).
        if (!cancelled) setRosters([]);
      }
    }
    loadRosters();
    return () => {
      cancelled = true;
    };
  }, [form.ruleset]);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
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

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (form.name.trim().length === 0) return false;
    if (form.maxParticipants < 2) return false;
    return true;
  }, [form, submitting]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setError(null);
      try {
        const created = await apiRequest<CreatedLeague>("/league", {
          method: "POST",
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            ruleset: form.ruleset,
            isPublic: form.isPublic,
            maxParticipants: form.maxParticipants,
            allowedRosters:
              form.allowedRosters.length > 0 ? form.allowedRosters : null,
            winPoints: form.winPoints,
            drawPoints: form.drawPoints,
            lossPoints: form.lossPoints,
            forfeitPoints: form.forfeitPoints,
          }),
        });
        router.push(`/leagues/${created.id}`);
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : t.leagues.formSubmitError,
        );
        setSubmitting(false);
      }
    },
    [canSubmit, form, router, t.leagues.formSubmitError],
  );

  if (!flagEnabled) {
    return null;
  }

  return (
    <div
      data-testid="new-league-page"
      className="w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-6"
    >
      <div>
        <Link
          href="/leagues"
          className="text-sm text-gray-600 hover:text-gray-800 inline-flex items-center gap-1"
        >
          ← {t.leagues.backToLeagues}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-nuffle-anthracite mt-2">
          {t.leagues.createLeagueTitle}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {t.leagues.createLeagueDescription}
        </p>
      </div>

      {error ? (
        <div
          data-testid="new-league-error"
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
              data-testid="new-league-name"
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
              data-testid="new-league-ruleset"
              value={form.ruleset}
              onChange={(e) =>
                updateField("ruleset", e.target.value as Ruleset)
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
              data-testid="new-league-description"
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
              data-testid="new-league-max"
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

        <fieldset className="block">
          <legend className="text-sm font-medium text-gray-700 mb-2">
            {t.leagues.formScoringTitle}
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ScoringField
              label={t.leagues.scoreWin}
              testId="new-league-win-points"
              min={0}
              max={10}
              value={form.winPoints}
              onChange={(v) => updateField("winPoints", v)}
            />
            <ScoringField
              label={t.leagues.scoreDraw}
              testId="new-league-draw-points"
              min={0}
              max={10}
              value={form.drawPoints}
              onChange={(v) => updateField("drawPoints", v)}
            />
            <ScoringField
              label={t.leagues.scoreLoss}
              testId="new-league-loss-points"
              min={-10}
              max={10}
              value={form.lossPoints}
              onChange={(v) => updateField("lossPoints", v)}
            />
            <ScoringField
              label={t.leagues.scoreForfeit}
              testId="new-league-forfeit-points"
              min={-10}
              max={10}
              value={form.forfeitPoints}
              onChange={(v) => updateField("forfeitPoints", v)}
            />
          </div>
        </fieldset>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            data-testid="new-league-submit"
            disabled={!canSubmit}
            className="px-4 py-2 rounded-md bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? t.leagues.formSubmitting : t.leagues.formSubmitCreate}
          </button>
          <Link
            href="/leagues"
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            {t.leagues.formCancel}
          </Link>
        </div>
      </form>
    </div>
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

function ScoringField({ label, value, min, max, testId, onChange }: ScoringFieldProps) {
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
