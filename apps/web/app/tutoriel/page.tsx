"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getTutorialBadge,
  listTutorialScripts,
  type TutorialScript,
} from "@bb/game-engine";
import { useLanguage } from "../contexts/LanguageContext";

const STORAGE_PREFIX = "nuffle.tutorial.progress.";

interface CompletedEntry {
  slug: string;
  completedAt: string;
}

function readCompletedTutorials(): CompletedEntry[] {
  if (typeof window === "undefined") return [];
  const out: CompletedEntry[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as {
          slug?: string;
          completed?: boolean;
          completedAt?: string;
        };
        if (
          parsed &&
          parsed.completed === true &&
          typeof parsed.slug === "string" &&
          typeof parsed.completedAt === "string"
        ) {
          out.push({ slug: parsed.slug, completedAt: parsed.completedAt });
        }
      } catch {
        // Skip corrupted entries.
      }
    }
  } catch {
    // Storage unavailable.
  }
  return out;
}

function getLocalizedTitle(script: TutorialScript, lang: "fr" | "en"): string {
  return lang === "fr" ? script.titleFr : script.titleEn;
}

function getLocalizedSummary(script: TutorialScript, lang: "fr" | "en"): string {
  return lang === "fr" ? script.summaryFr : script.summaryEn;
}

function getLocalizedDifficulty(
  difficulty: TutorialScript["difficulty"],
  lang: "fr" | "en",
): string {
  if (lang === "fr") {
    return difficulty === "beginner"
      ? "Debutant"
      : difficulty === "intermediate"
      ? "Intermediaire"
      : "Avance";
  }
  return difficulty === "beginner"
    ? "Beginner"
    : difficulty === "intermediate"
    ? "Intermediate"
    : "Advanced";
}

export default function TutorielListPage() {
  const { language } = useLanguage();
  const scripts = listTutorialScripts();
  const [completedSlugs, setCompletedSlugs] = useState<Set<string>>(
    () => new Set<string>(),
  );

  useEffect(() => {
    setCompletedSlugs(new Set(readCompletedTutorials().map((e) => e.slug)));
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-nuffle-anthracite mb-2">
          {language === "fr" ? "Tutoriels interactifs" : "Interactive tutorials"}
        </h1>
        <p className="text-nuffle-bronze">
          {language === "fr"
            ? "Apprenez Nuffle Arena pas a pas. Chaque tutoriel vous guide dans une facette du jeu."
            : "Learn Nuffle Arena step by step. Each tutorial walks you through a core part of the game."}
        </p>
      </header>

      {scripts.length === 0 ? (
        <p className="text-gray-500">
          {language === "fr" ? "Aucun tutoriel disponible." : "No tutorial available."}
        </p>
      ) : (
        <ul className="space-y-4">
          {scripts.map((script) => {
            const isCompleted = completedSlugs.has(script.slug);
            const badge = getTutorialBadge(script);
            const badgeLabel =
              language === "fr" ? badge.labelFr : badge.labelEn;
            return (
              <li
                key={script.slug}
                data-testid={`tutorial-card-${script.slug}`}
                className="border border-gray-200 rounded-lg p-5 hover:border-nuffle-gold transition-colors bg-white"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-semibold text-nuffle-anthracite">
                        {getLocalizedTitle(script, language)}
                      </h2>
                      {isCompleted && (
                        <span
                          data-testid={`tutorial-completed-badge-${script.slug}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"
                          title={badgeLabel}
                        >
                          {badge.emoji} {badgeLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {getLocalizedSummary(script, language)}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        ⏱ {script.estimatedMinutes} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        🎯 {getLocalizedDifficulty(script.difficulty, language)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        📚 {script.steps.length}{" "}
                        {language === "fr" ? "etapes" : "steps"}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/tutoriel/${script.slug}`}
                    className="px-4 py-2 bg-nuffle-gold hover:bg-nuffle-bronze text-white rounded-lg font-semibold text-sm transition-colors whitespace-nowrap"
                  >
                    {isCompleted
                      ? language === "fr"
                        ? "Revoir"
                        : "Replay"
                      : language === "fr"
                        ? "Commencer"
                        : "Start"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
