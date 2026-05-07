"use client";

import Link from "next/link";

/**
 * Shared types + components — sprint 1.E.2.
 */

export type GazetteArticleType = "MAIN" | "BREVE" | "EDITO";
export type GazettePersona = "cynic" | "orc_enthusiast" | "statistician";

export interface GazetteArticle {
  readonly id: string;
  readonly date: string;
  readonly type: GazetteArticleType;
  readonly persona: GazettePersona | null;
  readonly title: string;
  readonly body: string;
  readonly relatedTeamIds: readonly string[];
  readonly relatedPlayerIds: readonly string[];
  readonly createdAt: string;
}

export interface GazetteEdition {
  readonly date: string;
  readonly articles: readonly GazetteArticle[];
}

export const PERSONA_LABEL: Record<GazettePersona, string> = {
  cynic: "Le Cynique",
  orc_enthusiast: "L'Enthousiaste Orc",
  statistician: "Le Statisticien",
};

export const PERSONA_EMOJI: Record<GazettePersona, string> = {
  cynic: "🦝",
  orc_enthusiast: "🟢",
  statistician: "📊",
};

export const TYPE_LABEL: Record<GazetteArticleType, string> = {
  MAIN: "Article principal",
  BREVE: "Brève",
  EDITO: "Édito",
};

const TYPE_BG: Record<GazetteArticleType, string> = {
  MAIN: "bg-amber-950 border-amber-800",
  BREVE: "bg-slate-900 border-slate-800",
  EDITO: "bg-purple-950 border-purple-800",
};

export function ArticleCard({
  article,
}: {
  article: GazetteArticle;
}): JSX.Element {
  return (
    <article
      data-testid={`gazette-article-${article.type}`}
      className={`rounded border-l-4 px-4 py-3 ${TYPE_BG[article.type]}`}
    >
      <div className="mb-2 flex items-center gap-2 text-xs uppercase">
        <span className="font-bold tracking-wide text-slate-400">
          {TYPE_LABEL[article.type]}
        </span>
        {article.persona ? (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
            {PERSONA_EMOJI[article.persona]} {PERSONA_LABEL[article.persona]}
          </span>
        ) : null}
      </div>
      <h2 className="mb-2 text-xl font-bold text-slate-50">{article.title}</h2>
      <div className="prose prose-invert max-w-none whitespace-pre-line text-sm text-slate-200">
        {article.body}
      </div>
      {article.relatedTeamIds.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {article.relatedTeamIds.map((slug) => (
            <Link
              key={slug}
              href={`/pro-league/teams/${encodeURIComponent(slug)}`}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              {slug}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function EditionDisplay({
  edition,
}: {
  edition: GazetteEdition;
}): JSX.Element {
  if (edition.articles.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="gazette-empty">
        Aucun article publié pour le {edition.date}.
      </p>
    );
  }
  return (
    <div data-testid="gazette-edition" className="flex flex-col gap-4">
      {edition.articles.map((a) => (
        <ArticleCard key={a.id} article={a} />
      ))}
    </div>
  );
}
