"use client";

import { useLanguage } from "../contexts/LanguageContext";
import type { AboutContent, AboutMilestone } from "./about-content";

interface AboutClientProps {
  contentFr: AboutContent;
  contentEn: AboutContent;
}

function statusLabel(status: AboutMilestone["status"], lang: "fr" | "en"): string {
  if (lang === "fr") {
    if (status === "done") return "Realise";
    if (status === "in_progress") return "En cours";
    return "Planifie";
  }
  if (status === "done") return "Done";
  if (status === "in_progress") return "In progress";
  return "Planned";
}

function statusBadgeClass(status: AboutMilestone["status"]): string {
  if (status === "done") return "bg-green-100 text-green-800 border-green-200";
  if (status === "in_progress") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export default function AboutClient({ contentFr, contentEn }: AboutClientProps) {
  const { language } = useLanguage();
  const c = language === "fr" ? contentFr : contentEn;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-12">
      <header>
        <h1 className="text-3xl sm:text-4xl font-bold text-nuffle-anthracite mb-3">
          {language === "fr" ? "A propos de Nuffle Arena" : "About Nuffle Arena"}
        </h1>
        <p className="text-nuffle-bronze text-base">
          {language === "fr"
            ? "Histoire, chiffres cles, equipe et roadmap publique du projet."
            : "Story, key figures, team and public roadmap of the project."}
        </p>
      </header>

      <section aria-labelledby="story-title">
        <h2
          id="story-title"
          className="text-2xl font-semibold text-nuffle-anthracite mb-4"
        >
          {c.story.title}
        </h2>
        <div className="space-y-4 text-gray-800 leading-relaxed">
          {c.story.paragraphs.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section aria-labelledby="stats-title">
        <h2
          id="stats-title"
          className="text-2xl font-semibold text-nuffle-anthracite mb-4"
        >
          {language === "fr" ? "Chiffres cles" : "Key figures"}
        </h2>
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {c.stats.map((stat) => (
            <li
              key={stat.label}
              className="rounded-xl border-2 border-blue-200 bg-white p-5 text-center"
            >
              <div className="text-3xl font-bold text-blue-900">
                {stat.value}
                {stat.suffix ?? ""}
              </div>
              <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="team-title">
        <h2
          id="team-title"
          className="text-2xl font-semibold text-nuffle-anthracite mb-4"
        >
          {c.team.title}
        </h2>
        <p className="text-gray-800 leading-relaxed">{c.team.description}</p>
      </section>

      <section aria-labelledby="roadmap-title">
        <h2
          id="roadmap-title"
          className="text-2xl font-semibold text-nuffle-anthracite mb-4"
        >
          {language === "fr" ? "Roadmap publique" : "Public roadmap"}
        </h2>
        <ul className="space-y-3">
          {c.roadmap.map((milestone) => (
            <li
              key={milestone.title}
              className="flex items-start gap-3 border border-gray-200 rounded-lg p-4 bg-white"
            >
              <span
                className={`px-2 py-1 rounded border text-xs font-medium ${statusBadgeClass(milestone.status)}`}
              >
                {statusLabel(milestone.status, language)}
              </span>
              <span className="text-gray-800 font-medium">{milestone.title}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
