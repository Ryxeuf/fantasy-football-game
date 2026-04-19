"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  advanceTutorialProgress,
  createTutorialProgress,
  findTutorialScript,
  getCurrentStep,
  getProgressRatio,
  goBackTutorialProgress,
  isTutorialComplete,
  restartTutorialProgress,
  type TutorialProgress,
  type TutorialScript,
  type TutorialStep,
} from "@bb/game-engine";
import { useLanguage } from "../../contexts/LanguageContext";

const STORAGE_PREFIX = "nuffle.tutorial.progress.";

function getLocalizedStepText(
  step: TutorialStep,
  key: "title" | "body" | "tip",
  lang: "fr" | "en",
): string {
  if (key === "title") return lang === "fr" ? step.titleFr : step.titleEn;
  if (key === "body") return lang === "fr" ? step.bodyFr : step.bodyEn;
  return lang === "fr" ? step.tipFr ?? "" : step.tipEn ?? "";
}

function loadStoredProgress(slug: string): TutorialProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "slug" in parsed &&
      (parsed as TutorialProgress).slug === slug &&
      typeof (parsed as TutorialProgress).currentStepIndex === "number"
    ) {
      return parsed as TutorialProgress;
    }
  } catch {
    // Corrupted payload; discard.
  }
  return null;
}

function persistProgress(progress: TutorialProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${progress.slug}`,
      JSON.stringify(progress),
    );
  } catch {
    // Storage full or unavailable — ignore.
  }
}

export default function TutorielRunnerPage() {
  const { language } = useLanguage();
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug;
  const script = useMemo<TutorialScript | undefined>(
    () => (typeof slug === "string" ? findTutorialScript(slug) : undefined),
    [slug],
  );

  const [progress, setProgress] = useState<TutorialProgress | null>(null);

  useEffect(() => {
    if (!script) return;
    const stored = loadStoredProgress(script.slug);
    setProgress(stored ?? createTutorialProgress(script));
  }, [script]);

  useEffect(() => {
    if (progress) {
      persistProgress(progress);
    }
  }, [progress]);

  const step = useMemo<TutorialStep | undefined>(() => {
    if (!script || !progress) return undefined;
    return getCurrentStep(progress, script);
  }, [progress, script]);

  const ratio = useMemo(() => {
    if (!script || !progress) return 0;
    return getProgressRatio(progress, script);
  }, [progress, script]);

  const onNext = useCallback(() => {
    if (!script || !progress) return;
    setProgress(advanceTutorialProgress(progress, script));
  }, [progress, script]);

  const onPrev = useCallback(() => {
    if (!progress) return;
    setProgress(goBackTutorialProgress(progress));
  }, [progress]);

  const onRestart = useCallback(() => {
    if (!progress) return;
    setProgress(restartTutorialProgress(progress));
  }, [progress]);

  if (!script) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4 text-nuffle-anthracite">
          {language === "fr" ? "Tutoriel introuvable" : "Tutorial not found"}
        </h1>
        <p className="text-gray-600 mb-6">
          {language === "fr"
            ? "Le tutoriel demande n'existe pas."
            : "The requested tutorial does not exist."}
        </p>
        <button
          onClick={() => router.push("/tutoriel")}
          className="px-4 py-2 bg-nuffle-gold hover:bg-nuffle-bronze text-white rounded-lg font-semibold text-sm transition-colors"
        >
          {language === "fr" ? "Retour aux tutoriels" : "Back to tutorials"}
        </button>
      </main>
    );
  }

  if (!progress || !step) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-gray-500">
          {language === "fr" ? "Chargement..." : "Loading..."}
        </p>
      </main>
    );
  }

  const complete = isTutorialComplete(progress);
  const title = language === "fr" ? script.titleFr : script.titleEn;
  const stepTitle = getLocalizedStepText(step, "title", language);
  const stepBody = getLocalizedStepText(step, "body", language);
  const stepTip = getLocalizedStepText(step, "tip", language);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <nav className="text-sm mb-4">
        <Link href="/tutoriel" className="text-nuffle-bronze hover:underline">
          &larr; {language === "fr" ? "Tous les tutoriels" : "All tutorials"}
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-nuffle-anthracite">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {language === "fr" ? "Etape" : "Step"}{" "}
          {Math.min(progress.currentStepIndex + 1, script.steps.length)} /{" "}
          {script.steps.length}
        </p>
        <div
          className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
        >
          <div
            className="h-full bg-nuffle-gold transition-all"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      </header>

      <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-nuffle-anthracite mb-3">
          {stepTitle}
        </h2>
        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
          {stepBody}
        </p>
        {stepTip && (
          <p className="mt-4 text-sm text-nuffle-bronze bg-amber-50 border border-amber-200 rounded-md p-3">
            💡 {stepTip}
          </p>
        )}
      </section>

      <div className="flex items-center justify-between mt-6 gap-3 flex-wrap">
        <button
          onClick={onPrev}
          disabled={progress.currentStepIndex === 0}
          className="px-4 py-2 rounded-lg border border-gray-300 text-nuffle-anthracite hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          {language === "fr" ? "Precedent" : "Previous"}
        </button>
        <button
          onClick={onRestart}
          className="px-3 py-2 rounded-lg border border-gray-300 text-nuffle-anthracite hover:bg-gray-50 text-sm"
        >
          {language === "fr" ? "Recommencer" : "Restart"}
        </button>
        {complete ? (
          <Link
            href="/tutoriel"
            className="px-4 py-2 rounded-lg bg-nuffle-gold hover:bg-nuffle-bronze text-white font-semibold text-sm"
          >
            {language === "fr" ? "Tutoriel termine" : "Tutorial complete"} ✓
          </Link>
        ) : (
          <button
            onClick={onNext}
            className="px-4 py-2 rounded-lg bg-nuffle-gold hover:bg-nuffle-bronze text-white font-semibold text-sm"
          >
            {progress.currentStepIndex === script.steps.length - 1
              ? language === "fr"
                ? "Terminer"
                : "Finish"
              : language === "fr"
              ? "Suivant"
              : "Next"}
          </button>
        )}
      </div>
    </main>
  );
}
