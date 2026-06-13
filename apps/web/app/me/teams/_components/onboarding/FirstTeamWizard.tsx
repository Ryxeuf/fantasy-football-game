"use client";

/**
 * Assistant guidé "Crée ton équipe en 60 secondes".
 *
 * Trois étapes courtes pour amener un nouveau coach (0 équipe) jusqu'à sa
 * première équipe, sans friction :
 *   1. CHOISIR SA RACE — grille avec rosters recommandés mis en avant +
 *      indicateur de difficulté ; sélection en 1 clic.
 *   2. NOMMER L'ÉQUIPE — nom pré-rempli via /team/name-generator (régénérable).
 *   3. CONFIRMER — POST /team/create-from-roster → /me/teams/[id]?welcome=1.
 *
 * Toujours skippable ("Plus tard"). Design parchemin (cf. tailwind nuffle-*),
 * i18n fr/en, accessible (focus géré, clavier, aria), mobile-friendly,
 * prefers-reduced-motion respecté pour l'animation du dé.
 *
 * La logique pure (recommandations, difficulté, validation) vit dans
 * `onboarding-logic.ts` ; ce composant n'orchestre que l'I/O et l'UI.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "../../../../auth-client";
import { apiRequest } from "../../../../lib/api-client";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { trackUmamiEvent, UMAMI_EVENTS } from "../../../../lib/umami-events";
import { EmblemCup, EmblemTutorial, EmblemLeague } from "../../../../components/home/NuffleArt";
import {
  getRecommendedRosters,
  recommendedSlugSet,
  getRosterDifficulty,
  isValidTeamName,
  stepIndex,
  ONBOARDING_STEPS,
  type OnboardingRoster,
  type OnboardingStep,
  type RosterDifficulty,
} from "./onboarding-logic";

const RULESET = "season_3";

interface FirstTeamWizardProps {
  /** Skip / fermeture — persiste le flag localStorage côté parent. */
  readonly onDismiss: () => void;
}

export default function FirstTeamWizard({ onDismiss }: FirstTeamWizardProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [step, setStep] = useState<OnboardingStep>("race");
  const [rosters, setRosters] = useState<OnboardingRoster[]>([]);
  const [rostersLoading, setRostersLoading] = useState(true);
  const [rostersError, setRostersError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const [selected, setSelected] = useState<OnboardingRoster | null>(null);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);

  // Track l'affichage de l'assistant (taux d'activation).
  useEffect(() => {
    trackUmamiEvent(UMAMI_EVENTS.ONBOARDING_START);
  }, []);

  // Charge les races (endpoint public).
  useEffect(() => {
    const lang = language === "en" ? "en" : "fr";
    let cancelled = false;
    setRostersLoading(true);
    setRostersError(false);
    fetch(`${API_BASE}/api/rosters?lang=${lang}&ruleset=${RULESET}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("rosters"))))
      .then((data: { rosters?: OnboardingRoster[] }) => {
        if (cancelled) return;
        setRosters(data.rosters ?? []);
        setRostersLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRostersError(true);
        setRostersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  // Déplace le focus sur le titre à chaque changement d'étape (a11y).
  useEffect(() => {
    headingRef.current?.focus();
    trackUmamiEvent(UMAMI_EVENTS.ONBOARDING_STEP, { step });
  }, [step]);

  const dismiss = useCallback(() => {
    trackUmamiEvent(UMAMI_EVENTS.ONBOARDING_SKIP, { step });
    onDismiss();
  }, [onDismiss, step]);

  // Escape ferme l'assistant.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  const fetchName = useCallback(async (rosterSlug: string) => {
    try {
      const seed = `${rosterSlug}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await apiRequest<{ name: string }>(
        `/team/name-generator?roster=${encodeURIComponent(rosterSlug)}&seed=${encodeURIComponent(seed)}`,
      );
      if (res?.name) setName(res.name);
    } catch {
      // Nom suggéré indisponible : on laisse le champ tel quel (éditable).
    }
  }, []);

  const recommended = getRecommendedRosters(rosters);
  const recommendedSet = recommendedSlugSet(rosters);
  const otherRosters = rosters.filter((r) => !recommendedSet.has(r.slug));

  const selectRace = (roster: OnboardingRoster) => {
    setSelected(roster);
    setNameTouched(false);
    trackUmamiEvent(UMAMI_EVENTS.ONBOARDING_RACE, {
      roster: roster.slug,
      recommended: recommendedSet.has(roster.slug),
    });
    void fetchName(roster.slug);
    setStep("name");
  };

  const goConfirm = () => {
    if (!isValidTeamName(name)) {
      setNameTouched(true);
      return;
    }
    setStep("confirm");
  };

  const create = async () => {
    if (!selected || !isValidTeamName(name) || creating) return;
    setCreating(true);
    setCreateError(false);
    try {
      const res = await apiRequest<{ team: { id: string } }>(
        "/team/create-from-roster",
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            roster: selected.slug,
            ruleset: RULESET,
            format: "bb11",
          }),
        },
      );
      trackUmamiEvent(UMAMI_EVENTS.ONBOARDING_COMPLETE, { roster: selected.slug });
      // Persiste le skip pour ne plus re-déclencher après succès.
      onDismiss();
      router.push(`/me/teams/${res.team.id}?welcome=1`);
    } catch {
      setCreateError(true);
      setCreating(false);
    }
  };

  const difficultyLabel = (d: RosterDifficulty): string =>
    d === "easy"
      ? t.onboarding.difficultyEasy
      : d === "hard"
        ? t.onboarding.difficultyHard
        : t.onboarding.difficultyMedium;

  const stepTitle =
    step === "race"
      ? t.onboarding.step1Title
      : step === "name"
        ? t.onboarding.step2Title
        : t.onboarding.step3Title;

  const stepSubtitle =
    step === "race"
      ? t.onboarding.step1Subtitle
      : step === "name"
        ? t.onboarding.step2Subtitle
        : t.onboarding.step3Subtitle;

  return (
    <div
      data-testid="onboarding-wizard"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-nuffle-anthracite/70 p-0 sm:p-4 font-body"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="relative flex max-h-[100dvh] sm:max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-nuffle-gold/60 bg-[#FBF7EC] shadow-2xl">
        {/* En-tête parchemin */}
        <header className="shrink-0 border-b border-nuffle-gold/30 bg-nuffle-anthracite px-5 py-4 text-nuffle-ivory">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1B1610] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-nuffle-gold ring-1 ring-nuffle-gold/50">
                {t.onboarding.badge}
              </span>
              <h2
                id={titleId}
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 font-heading text-xl sm:text-2xl text-nuffle-gold outline-none"
              >
                {stepTitle}
              </h2>
              <p className="mt-1 text-sm text-nuffle-ivory/80">{stepSubtitle}</p>
            </div>
            <button
              type="button"
              data-testid="onboarding-close"
              onClick={dismiss}
              aria-label={t.onboarding.close}
              className="rounded-lg p-1.5 text-nuffle-ivory/70 transition hover:bg-white/10 hover:text-nuffle-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-gold"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Indicateur d'étape */}
          <div className="mt-3 flex items-center gap-2" aria-hidden="true">
            {ONBOARDING_STEPS.map((s) => (
              <span
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  stepIndex(s) <= stepIndex(step)
                    ? "bg-nuffle-gold"
                    : "bg-nuffle-ivory/25"
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] uppercase tracking-wide text-nuffle-ivory/60">
            {t.onboarding.stepCounter
              .replace("{current}", String(stepIndex(step)))
              .replace("{total}", String(ONBOARDING_STEPS.length))}
          </p>
        </header>

        {/* Corps défilable */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "race" && (
            <RaceStep
              loading={rostersLoading}
              error={rostersError}
              recommended={recommended}
              others={otherRosters}
              showAll={showAll}
              onToggleAll={() => setShowAll((v) => !v)}
              onSelect={selectRace}
              difficultyLabel={difficultyLabel}
              selectedSlug={selected?.slug ?? null}
            />
          )}

          {step === "name" && selected && (
            <NameStep
              roster={selected}
              name={name}
              onName={(v) => {
                setName(v);
                setNameTouched(true);
              }}
              onRegenerate={() => fetchName(selected.slug)}
              invalid={nameTouched && !isValidTeamName(name)}
            />
          )}

          {step === "confirm" && selected && (
            <ConfirmStep
              roster={selected}
              name={name}
              difficultyLabel={difficultyLabel}
              error={createError}
            />
          )}
        </div>

        {/* Pied : navigation + secondaire */}
        <footer className="shrink-0 border-t border-nuffle-gold/30 bg-[#F4ECD8] px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {step !== "race" && (
                <button
                  type="button"
                  data-testid="onboarding-back"
                  onClick={() => setStep(step === "confirm" ? "name" : "race")}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-nuffle-bronze transition hover:bg-nuffle-bronze/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-gold"
                >
                  {t.onboarding.back}
                </button>
              )}
              <button
                type="button"
                data-testid="onboarding-skip"
                onClick={dismiss}
                className="rounded-lg px-3 py-2 text-sm text-nuffle-bronze/80 underline-offset-2 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-gold"
              >
                {t.onboarding.later}
              </button>
            </div>

            {step === "name" && (
              <button
                type="button"
                data-testid="onboarding-next"
                onClick={goConfirm}
                className="rounded-lg bg-nuffle-gold px-5 py-2 text-sm font-bold text-nuffle-anthracite shadow transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-anthracite disabled:opacity-50"
                disabled={!isValidTeamName(name)}
              >
                {t.onboarding.next}
              </button>
            )}

            {step === "confirm" && (
              <button
                type="button"
                data-testid="onboarding-create"
                onClick={create}
                disabled={creating}
                aria-busy={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-nuffle-red px-5 py-2 text-sm font-bold text-nuffle-ivory shadow transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-gold disabled:opacity-60"
              >
                {creating && (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border-2 border-nuffle-ivory/40 border-t-nuffle-ivory animate-spin motion-reduce:animate-none"
                  />
                )}
                {creating ? t.onboarding.creating : t.onboarding.create}
              </button>
            )}
          </div>

          {/* Liens secondaires sur la 1re étape. */}
          {step === "race" && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-nuffle-gold/20 pt-3 text-xs text-nuffle-bronze">
              <span className="font-semibold uppercase tracking-wide text-nuffle-bronze/70">
                {t.onboarding.orExplore}
              </span>
              <Link
                href="/tutoriel"
                onClick={dismiss}
                className="inline-flex items-center gap-1.5 text-nuffle-bronze underline-offset-2 hover:underline"
              >
                <EmblemTutorial className="h-4 w-4 text-nuffle-gold" />
                {t.onboarding.ctaTutorial}
              </Link>
              {process.env.NEXT_PUBLIC_PRO_LEAGUE_ENABLED !== "false" && (
                <Link
                  href="/pro-league"
                  onClick={dismiss}
                  className="inline-flex items-center gap-1.5 text-nuffle-bronze underline-offset-2 hover:underline"
                >
                  <EmblemLeague className="h-4 w-4 text-nuffle-gold" />
                  {t.onboarding.ctaProLeague}
                </Link>
              )}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 1 — Choix de la race                                          */
/* ------------------------------------------------------------------ */

interface RaceStepProps {
  readonly loading: boolean;
  readonly error: boolean;
  readonly recommended: OnboardingRoster[];
  readonly others: OnboardingRoster[];
  readonly showAll: boolean;
  readonly onToggleAll: () => void;
  readonly onSelect: (roster: OnboardingRoster) => void;
  readonly difficultyLabel: (d: RosterDifficulty) => string;
  readonly selectedSlug: string | null;
}

function RaceStep({
  loading,
  error,
  recommended,
  others,
  showAll,
  onToggleAll,
  onSelect,
  difficultyLabel,
  selectedSlug,
}: RaceStepProps) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-nuffle-gold/20 bg-nuffle-ivory/60 motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p
        data-testid="onboarding-races-error"
        role="alert"
        className="rounded-lg border border-nuffle-red/30 bg-nuffle-red/5 p-3 text-sm text-nuffle-red"
      >
        {t.onboarding.racesError}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="onboarding-race-step">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
        {recommended.map((r) => (
          <RaceCard
            key={r.slug}
            roster={r}
            recommended
            selected={selectedSlug === r.slug}
            onSelect={onSelect}
            difficultyLabel={difficultyLabel}
          />
        ))}
      </ul>

      {others.length > 0 && (
        <div>
          <button
            type="button"
            data-testid="onboarding-toggle-all"
            onClick={onToggleAll}
            aria-expanded={showAll}
            className="text-sm font-semibold text-nuffle-bronze underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-gold rounded"
          >
            {showAll
              ? t.onboarding.showLessRaces
              : t.onboarding.showAllRaces.replace(
                  "{count}",
                  String(others.length),
                )}
          </button>

          {showAll && (
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
              {others.map((r) => (
                <RaceCard
                  key={r.slug}
                  roster={r}
                  recommended={false}
                  selected={selectedSlug === r.slug}
                  onSelect={onSelect}
                  difficultyLabel={difficultyLabel}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface RaceCardProps {
  readonly roster: OnboardingRoster;
  readonly recommended: boolean;
  readonly selected: boolean;
  readonly onSelect: (roster: OnboardingRoster) => void;
  readonly difficultyLabel: (d: RosterDifficulty) => string;
}

function RaceCard({
  roster,
  recommended,
  selected,
  onSelect,
  difficultyLabel,
}: RaceCardProps) {
  const { t } = useLanguage();
  const difficulty = getRosterDifficulty(roster.slug);
  const dot =
    difficulty === "easy"
      ? "bg-emerald-600"
      : difficulty === "hard"
        ? "bg-nuffle-red"
        : "bg-nuffle-gold";

  return (
    <li>
      <button
        type="button"
        data-testid={`onboarding-race-${roster.slug}`}
        onClick={() => onSelect(roster)}
        aria-pressed={selected}
        className={`group flex h-full w-full flex-col gap-1.5 rounded-xl border bg-[#FBF7EC] p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-gold ${
          selected
            ? "border-nuffle-gold ring-2 ring-nuffle-gold"
            : "border-nuffle-bronze/25 hover:border-nuffle-gold"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-subtitle font-semibold text-nuffle-anthracite">
            {roster.name}
          </span>
          {recommended && (
            <span className="shrink-0 rounded-full bg-nuffle-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-nuffle-bronze ring-1 ring-nuffle-gold/50">
              ★ {t.onboarding.recommendedBadge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-nuffle-bronze">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
            {difficultyLabel(difficulty)}
          </span>
          {roster.tier != null && roster.tier !== "" && (
            <span className="text-nuffle-bronze/70">
              {t.onboarding.tierLabel.replace("{tier}", String(roster.tier))}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 2 — Nom de l'équipe                                           */
/* ------------------------------------------------------------------ */

interface NameStepProps {
  readonly roster: OnboardingRoster;
  readonly name: string;
  readonly onName: (value: string) => void;
  readonly onRegenerate: () => void;
  readonly invalid: boolean;
}

function NameStep({ roster, name, onName, onRegenerate, invalid }: NameStepProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  return (
    <div className="space-y-3" data-testid="onboarding-name-step">
      <p className="text-sm text-nuffle-bronze">
        <span className="font-semibold text-nuffle-anthracite">{roster.name}</span>
      </p>
      <label
        htmlFor="onboarding-team-name"
        className="block text-sm font-medium text-nuffle-anthracite"
      >
        {t.onboarding.nameLabel}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          id="onboarding-team-name"
          ref={inputRef}
          data-testid="onboarding-name-input"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={t.onboarding.namePlaceholder}
          autoComplete="off"
          maxLength={100}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          className={`min-h-[44px] flex-1 rounded-lg border bg-white px-3 py-2 text-base text-nuffle-anthracite focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-gold ${
            invalid ? "border-nuffle-red" : "border-nuffle-bronze/40"
          }`}
        />
        <button
          type="button"
          data-testid="onboarding-regenerate"
          onClick={onRegenerate}
          aria-label={t.onboarding.regenerate}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-nuffle-gold bg-nuffle-gold/10 px-3 text-sm font-semibold text-nuffle-bronze transition hover:bg-nuffle-gold/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-nuffle-gold"
        >
          <span aria-hidden="true">🎲</span>
          <span className="hidden sm:inline">{t.onboarding.regenerate}</span>
        </button>
      </div>
      {invalid && (
        <p id={errorId} role="alert" className="text-sm text-nuffle-red">
          {t.onboarding.nameRequired}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 3 — Confirmation                                              */
/* ------------------------------------------------------------------ */

interface ConfirmStepProps {
  readonly roster: OnboardingRoster;
  readonly name: string;
  readonly difficultyLabel: (d: RosterDifficulty) => string;
  readonly error: boolean;
}

function ConfirmStep({ roster, name, difficultyLabel, error }: ConfirmStepProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4" data-testid="onboarding-confirm-step">
      <div className="flex items-center justify-center">
        <EmblemCup className="h-14 w-14 text-nuffle-gold" />
      </div>
      <dl className="space-y-2 rounded-xl border border-nuffle-gold/30 bg-[#FBF7EC] p-4">
        <Row label={t.onboarding.confirmRace} value={roster.name} />
        <Row label={t.onboarding.confirmName} value={name.trim()} />
        <Row
          label={t.onboarding.confirmDifficulty}
          value={difficultyLabel(getRosterDifficulty(roster.slug))}
        />
      </dl>
      {error && (
        <p
          data-testid="onboarding-create-error"
          role="alert"
          className="rounded-lg border border-nuffle-red/30 bg-nuffle-red/5 p-3 text-sm text-nuffle-red"
        >
          {t.onboarding.createError}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-nuffle-bronze">{label}</dt>
      <dd className="font-subtitle font-semibold text-nuffle-anthracite">{value}</dd>
    </div>
  );
}
