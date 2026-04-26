/**
 * Page publique /changelog (Q.16 — Sprint 23).
 *
 * Server component : lit le CHANGELOG.md du repo, le parse, et affiche
 * les 30 derniers releases sous forme cards. Sert de signal de fraicheur
 * (lastModified visible) pour les LLM et permet aux utilisateurs de
 * suivre l'evolution du projet sans aller sur GitHub.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseChangelog } from "../lib/changelog-parser";

const MAX_ENTRIES = 30;

export const dynamic = "force-static";
export const revalidate = 3600;

async function loadChangelog(): Promise<string> {
  const candidates = [
    join(process.cwd(), "CHANGELOG.md"),
    join(process.cwd(), "..", "..", "CHANGELOG.md"),
  ];
  for (const path of candidates) {
    try {
      return await readFile(path, "utf8");
    } catch {
      // tente le suivant
    }
  }
  return "";
}

function bulletText(item: string): string {
  // Strip markdown links [text](url) -> text, conserve le texte lisible.
  return item
    .replace(/\(\[([^\]]+)\]\([^)]+\)\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .trim();
}

export default async function ChangelogPage() {
  const md = await loadChangelog();
  const entries = parseChangelog(md).slice(0, MAX_ENTRIES);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <header>
        <h1 className="text-3xl sm:text-4xl font-bold text-nuffle-anthracite mb-3">
          Changelog
        </h1>
        <p className="text-nuffle-bronze">
          Historique public des nouveautes et corrections de Nuffle Arena.
          Egalement disponible en{" "}
          <a href="/feed.xml" className="underline hover:text-nuffle-gold">
            flux RSS
          </a>
          .
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="text-gray-500">Aucune entree disponible.</p>
      ) : (
        <ul className="space-y-6">
          {entries.map((entry) => (
            <li
              key={entry.version}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <header className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                <h2 className="text-xl font-semibold text-nuffle-anthracite">
                  {entry.compareUrl ? (
                    <a
                      href={entry.compareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-nuffle-gold underline-offset-4 hover:underline"
                    >
                      v{entry.version}
                    </a>
                  ) : (
                    <>v{entry.version}</>
                  )}
                </h2>
                <time className="text-sm text-gray-500" dateTime={entry.date}>
                  {entry.date}
                </time>
              </header>
              {entry.sections.map((section) => (
                <div key={section.title} className="mt-3">
                  <h3 className="text-sm font-semibold text-nuffle-bronze mb-1">
                    {section.title}
                  </h3>
                  <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                    {section.items.map((item, idx) => (
                      <li key={idx}>{bulletText(item)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
