/**
 * Pro League Nuffle Gazette service — sprint 1.E.2.
 *
 * CRUD minimal sur `ProGazetteArticle` :
 *  - `listLatestEdition()` : articles les plus récents (= la dernière
 *    date avec ≥1 article).
 *  - `listEditionForDate(date)` : tous les articles d'une date donnée
 *    (YYYY-MM-DD).
 *  - `listEditionDates(limit)` : liste des dates publiées (archive).
 *  - `createArticles({date, articles[]})` : insère plusieurs articles
 *    en une seule transaction. Consommé par le LLM (lot 1.E.1) et
 *    par les routes admin.
 *
 * `date` est normalisée à 00:00:00 UTC pour permettre une recherche
 * par jour stable.
 */

import { prisma } from "../prisma";

export type GazetteArticleType = "MAIN" | "BREVE" | "EDITO";
export type GazettePersona =
  | "cynic"
  | "orc_enthusiast"
  | "statistician";

const VALID_TYPES: ReadonlySet<GazetteArticleType> = new Set([
  "MAIN",
  "BREVE",
  "EDITO",
]);
const VALID_PERSONAS: ReadonlySet<GazettePersona> = new Set([
  "cynic",
  "orc_enthusiast",
  "statistician",
]);

const DAY_MS = 24 * 60 * 60 * 1000;

export class GazetteValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GazetteValidationError";
  }
}

export interface GazetteArticleSummary {
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
  readonly articles: readonly GazetteArticleSummary[];
}

interface ArticleRow {
  id: string;
  date: Date;
  type: string;
  persona: string | null;
  title: string;
  body: string;
  relatedTeamIds: unknown;
  relatedPlayerIds: unknown;
  createdAt: Date;
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (v): v is string => typeof v === "string",
        );
      }
    } catch {
      return [];
    }
  }
  return [];
}

function rowToSummary(r: ArticleRow): GazetteArticleSummary {
  return {
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    type: r.type as GazetteArticleType,
    persona: (r.persona as GazettePersona | null) ?? null,
    title: r.title,
    body: r.body,
    relatedTeamIds: parseStringArray(r.relatedTeamIds),
    relatedPlayerIds: parseStringArray(r.relatedPlayerIds),
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Convertit une "YYYY-MM-DD" string ou Date en Date UTC normalisée
 * (00:00:00). Throw si invalide.
 */
function normalizeDate(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(
      Date.UTC(
        input.getUTCFullYear(),
        input.getUTCMonth(),
        input.getUTCDate(),
      ),
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new GazetteValidationError(
      "INVALID_DATE",
      `Date doit être au format YYYY-MM-DD (reçu: '${input}')`,
    );
  }
  const [yyyy, mm, dd] = input.split("-").map((s) => Number.parseInt(s, 10));
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (Number.isNaN(d.getTime())) {
    throw new GazetteValidationError(
      "INVALID_DATE",
      `Date invalide : '${input}'`,
    );
  }
  return d;
}

/**
 * Liste tous les articles d'une date donnée (UTC).
 * Triés par type (MAIN > BREVE > EDITO), puis createdAt asc.
 */
export async function listEditionForDate(
  date: string | Date,
): Promise<GazetteEdition> {
  const day = normalizeDate(date);
  const next = new Date(day.getTime() + DAY_MS);
  const rows = (await prisma.proGazetteArticle.findMany({
    where: { date: { gte: day, lt: next } },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      date: true,
      type: true,
      persona: true,
      title: true,
      body: true,
      relatedTeamIds: true,
      relatedPlayerIds: true,
      createdAt: true,
    },
  })) as ArticleRow[];

  // Tri MAIN > BREVE > EDITO sans changer l'ordre createdAt à
  // l'intérieur d'un type.
  const TYPE_ORDER: Record<GazetteArticleType, number> = {
    MAIN: 0,
    BREVE: 1,
    EDITO: 2,
  };
  const articles = rows.map(rowToSummary).sort((a, b) => {
    const oa = TYPE_ORDER[a.type] ?? 99;
    const ob = TYPE_ORDER[b.type] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return {
    date: day.toISOString().slice(0, 10),
    articles,
  };
}

/**
 * Renvoie l'édition la plus récente avec ≥1 article. null si aucun
 * article publié.
 */
export async function listLatestEdition(): Promise<GazetteEdition | null> {
  const latest = (await prisma.proGazetteArticle.findFirst({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { date: true },
  })) as { date: Date } | null;
  if (!latest) return null;
  return listEditionForDate(latest.date);
}

/**
 * Liste les `limit` dernières dates avec articles (archive). Triées
 * desc.
 */
export async function listEditionDates(
  limit: number = 30,
): Promise<string[]> {
  if (!Number.isInteger(limit) || limit <= 0 || limit > 365) {
    throw new GazetteValidationError(
      "INVALID_LIMIT",
      `limit doit être ∈ [1, 365] (reçu: ${limit})`,
    );
  }
  // SELECT DISTINCT date n'est pas trivial via Prisma sans groupBy.
  // On fait groupBy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await (prisma as any).proGazetteArticle.groupBy({
    by: ["date"],
    orderBy: { date: "desc" },
    take: limit,
  })) as { date: Date }[];
  return rows.map((r) => r.date.toISOString().slice(0, 10));
}

export interface CreateArticleInput {
  readonly type: GazetteArticleType;
  readonly persona?: GazettePersona | null;
  readonly title: string;
  readonly body: string;
  readonly relatedTeamIds?: readonly string[];
  readonly relatedPlayerIds?: readonly string[];
}

export interface CreateArticlesInput {
  readonly date: string | Date;
  readonly articles: readonly CreateArticleInput[];
}

/**
 * Insère plusieurs articles pour une date donnée. Atomique. Renvoie
 * les ids créés.
 */
export async function createArticles(
  input: CreateArticlesInput,
): Promise<string[]> {
  const day = normalizeDate(input.date);
  if (input.articles.length === 0) {
    throw new GazetteValidationError(
      "INVALID_PAYLOAD",
      "Au moins 1 article requis",
    );
  }

  for (const a of input.articles) {
    if (!VALID_TYPES.has(a.type)) {
      throw new GazetteValidationError(
        "INVALID_TYPE",
        `type invalide: '${a.type}' (attendu: MAIN/BREVE/EDITO)`,
      );
    }
    if (a.persona !== undefined && a.persona !== null) {
      if (!VALID_PERSONAS.has(a.persona)) {
        throw new GazetteValidationError(
          "INVALID_PERSONA",
          `persona invalide: '${a.persona}'`,
        );
      }
    }
    if (a.type === "EDITO" && !a.persona) {
      throw new GazetteValidationError(
        "EDITO_REQUIRES_PERSONA",
        "Un EDITO doit être signé par une persona",
      );
    }
    if (typeof a.title !== "string" || a.title.length === 0) {
      throw new GazetteValidationError(
        "INVALID_TITLE",
        "title requis (string non vide)",
      );
    }
    if (typeof a.body !== "string" || a.body.length === 0) {
      throw new GazetteValidationError(
        "INVALID_BODY",
        "body requis (string non vide)",
      );
    }
  }

  const ids: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    for (const a of input.articles) {
      const created = await tx.proGazetteArticle.create({
        data: {
          date: day,
          type: a.type,
          persona: a.persona ?? null,
          title: a.title,
          body: a.body,
          relatedTeamIds: a.relatedTeamIds
            ? (a.relatedTeamIds as unknown as object)
            : null,
          relatedPlayerIds: a.relatedPlayerIds
            ? (a.relatedPlayerIds as unknown as object)
            : null,
        },
        select: { id: true },
      });
      ids.push(created.id as string);
    }
  });
  return ids;
}
