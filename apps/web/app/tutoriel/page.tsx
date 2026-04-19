"use client";
import Link from "next/link";
import { listTutorialScripts, type TutorialScript } from "@bb/game-engine";
import { useLanguage } from "../contexts/LanguageContext";

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
          {scripts.map((script) => (
            <li
              key={script.slug}
              className="border border-gray-200 rounded-lg p-5 hover:border-nuffle-gold transition-colors bg-white"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-nuffle-anthracite">
                    {getLocalizedTitle(script, language)}
                  </h2>
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
                  {language === "fr" ? "Commencer" : "Start"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
