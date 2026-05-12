/**
 * Pro League Nuffle Gazette LLM generator — sprint Pro League lot
 * 1.E.1.
 *
 * Pipeline complet :
 *   1. `getDailyRecap(at)` (1.E.3) -> recap deterministe (matches +
 *      standings + storylines).
 *   2. `buildPrompt(recap)` -> prompt template (system + user) avec
 *      contraintes de sortie JSON et personas Gazette.
 *   3. `callClaude(...)` -> Claude Haiku.
 *   4. `parseLLMResponse(text)` -> articles structures.
 *   5. `createArticles(...)` -> persistance ProGazetteArticle.
 *
 * Idempotent : skip si une edition existe deja pour la date cible
 * (verifie via `listEditionForDate`). Toute erreur est isolee — le
 * cron 8h ne plante jamais le serveur.
 *
 * Personas (cf. schema ProGazetteArticle) :
 *   - cynic           : sarcasme, rumeurs
 *   - orc_enthusiast  : hype, capslock
 *   - statistician    : chiffres, analyses
 *
 * Article shape par jour (default) : 1 MAIN + 2 BREVE + 1 EDITO.
 */

import { callClaude, type CallClaudeOptions } from "./anthropic-client";
import { getDailyRecap, type DailyRecap } from "./pro-gazette-recap";
import {
  type CreateArticleInput,
  type GazetteArticleType,
  type GazettePersona,
  createArticles,
  listEditionForDate,
} from "./pro-gazette";
import { serverLog } from "../utils/server-log";

export class GazetteLLMError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GazetteLLMError";
  }
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 2048;

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

const SYSTEM_PROMPT = `Tu es le redacteur en chef de la "Nuffle Gazette", journal sportif fictif de la Old World League (Blood Bowl-like).

Style : enthousiaste, pulp fiction, references cyclopiques aux dieux (Nuffle), exagerations comiques, mais factuellement ancre dans les donnees fournies.

Personas signataires possibles :
- cynic           : sarcasme aigre, rumeurs douteuses, ironie. Persona cynique francaise.
- orc_enthusiast  : majuscules ENORMES, hyperboles, adore les casualties.
- statistician    : analyses chiffrees, ratios, comparatif standings.

Tu produis des articles courts. Pas de markdown lourd, pas d'HTML.

Tu DOIS repondre avec UNIQUEMENT un objet JSON strict (pas de texte avant ou apres, pas de \`\`\`json fences). Schema :

{
  "articles": [
    {
      "type": "MAIN" | "BREVE" | "EDITO",
      "persona": null | "cynic" | "orc_enthusiast" | "statistician",
      "title": string,
      "body": string,
      "relatedTeamSlugs": string[]
    }
  ]
}

Contraintes de chaque article :
- MAIN : 200-350 mots, persona optionnelle (sinon null)
- BREVE : 50-100 mots, persona optionnelle
- EDITO : 100-200 mots, persona OBLIGATOIRE (signe)

relatedTeamSlugs : liste des slugs ProTeam mentionnes (peut etre []).
Le titre est court, accrocheur (max 80 caracteres).`;

export interface BuildPromptOptions {
  readonly recap: DailyRecap;
  readonly date: string;
}

/**
 * Construit le user-prompt a injecter (le system est constant).
 * Pure (testable sans fetch).
 */
export function buildUserPrompt(opts: BuildPromptOptions): string {
  const { recap, date } = opts;
  const matchesSummary = recap.matches.map((m) => ({
    home: `${m.homeTeamName} (${m.homeTeamSlug})`,
    away: `${m.awayTeamName} (${m.awayTeamSlug})`,
    score: `${m.scoreHome}-${m.scoreAway}`,
    outcome: m.outcome,
    tds: m.touchdownCount,
    cas: m.casualtyCount,
    nuffle: m.nuffleCount,
  }));
  const standingsTop = recap.standings
    .slice(0, 5)
    .map((s) => `#${s.rank} ${s.teamName} (${s.wins}-${s.draws}-${s.losses}, ${s.points} pts)`);
  // Q.A.4 — expose les refs complets pour rivalry_buildup afin que
  // le LLM puisse citer le bilan W-D-L et le streak. Les autres types
  // n'ont pas besoin des refs (le summary leur suffit).
  const storylines = recap.storylines.map((s) => {
    const base: Record<string, unknown> = {
      type: s.type,
      weight: s.weight,
      summary: s.summary,
    };
    if (s.type === "rivalry_buildup") {
      base.refs = s.refs;
    }
    return base;
  });
  const payload = {
    date,
    matchesPlayed: recap.matchesPlayed,
    matches: matchesSummary,
    standingsTop5: standingsTop,
    storylines,
  };

  // Q.A.4 — instruction supplementaire si une rivalry_buildup est
  // detectee : le LLM est invite a signer un EDITO statistician sur
  // l'historique de la rivalite (W-D-L, streak).
  const hasRivalry = recap.storylines.some(
    (s) => s.type === "rivalry_buildup",
  );
  const rivalryInstruction = hasRivalry
    ? "\nUne storyline 'rivalry_buildup' est detectee : SIGNE un EDITO 'statistician' sur cette rivalite (cite winsHome/winsAway/draws/streak depuis ses refs)."
    : "";

  return [
    `Genere l'edition Nuffle Gazette pour le ${date}.`,
    "Donnees factuelles (recap aggregator) :",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
    "",
    "Cible : 1 MAIN (story principale, base sur la storyline la plus ponderee), 2 BREVE (storylines secondaires), 1 EDITO (signe par 1 persona)." +
      rivalryInstruction,
    "Reponds UNIQUEMENT en JSON strict.",
  ].join("\n");
}

interface ParsedArticle {
  readonly type: string;
  readonly persona: string | null;
  readonly title: string;
  readonly body: string;
  readonly relatedTeamSlugs?: readonly string[];
}

interface ParsedResponse {
  readonly articles: readonly ParsedArticle[];
}

/**
 * Parse + valide la reponse LLM. Throw GazetteLLMError sur invalide.
 * Pure.
 */
export function parseLLMResponse(text: string): CreateArticleInput[] {
  // Tolere "```json ... ```" dans le cas ou Claude n'obeit pas tout
  // a fait au prompt strict.
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    throw new GazetteLLMError(
      "INVALID_JSON",
      `LLM response is not valid JSON: ${msg}`,
    );
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as ParsedResponse).articles)
  ) {
    throw new GazetteLLMError(
      "INVALID_SHAPE",
      "expected { articles: [...] } object",
    );
  }
  const articles = (parsed as ParsedResponse).articles;
  if (articles.length === 0) {
    throw new GazetteLLMError("NO_ARTICLES", "LLM returned 0 articles");
  }
  const out: CreateArticleInput[] = [];
  for (const a of articles) {
    if (typeof a.type !== "string" || !VALID_TYPES.has(a.type as GazetteArticleType)) {
      throw new GazetteLLMError("INVALID_TYPE", `bad type: ${a.type}`);
    }
    if (typeof a.title !== "string" || a.title.length === 0) {
      throw new GazetteLLMError("INVALID_TITLE", "title required");
    }
    if (typeof a.body !== "string" || a.body.length === 0) {
      throw new GazetteLLMError("INVALID_BODY", "body required");
    }
    let persona: GazettePersona | null = null;
    if (
      typeof a.persona === "string" &&
      VALID_PERSONAS.has(a.persona as GazettePersona)
    ) {
      persona = a.persona as GazettePersona;
    } else if (a.persona !== null && a.persona !== undefined) {
      throw new GazetteLLMError(
        "INVALID_PERSONA",
        `bad persona: ${a.persona}`,
      );
    }
    if (a.type === "EDITO" && persona === null) {
      throw new GazetteLLMError(
        "EDITO_REQUIRES_PERSONA",
        "EDITO must be signed",
      );
    }
    out.push({
      type: a.type as GazetteArticleType,
      persona,
      title: a.title.slice(0, 200),
      body: a.body,
      relatedTeamIds: Array.isArray(a.relatedTeamSlugs)
        ? a.relatedTeamSlugs.filter((s): s is string => typeof s === "string")
        : [],
    });
  }
  return out;
}

export interface GenerateEditionOptions {
  /** Date cible. Default = J-1 a 00h UTC. */
  readonly date?: Date;
  /** Override (tests). */
  readonly model?: string;
  readonly maxTokens?: number;
  readonly fetchImpl?: typeof fetch;
}

export interface GenerateEditionResult {
  readonly date: string;
  readonly skipped: boolean;
  readonly skipReason?: string;
  readonly created: number;
  readonly articleIds: readonly string[];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function previousDayUtc(): Date {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  return d;
}

/**
 * Genere l'edition LLM pour une date (default J-1). Idempotent : skip
 * si une edition existe deja a cette date.
 */
export async function generateEditionForDate(
  opts: GenerateEditionOptions = {},
): Promise<GenerateEditionResult> {
  const at = opts.date ?? previousDayUtc();
  const dateStr = isoDate(at);
  const existing = await listEditionForDate(dateStr);
  if (existing && existing.articles.length > 0) {
    return {
      date: dateStr,
      skipped: true,
      skipReason: "edition_already_exists",
      created: 0,
      articleIds: [],
    };
  }
  const recap = await getDailyRecap(at);
  if (recap.matchesPlayed === 0) {
    return {
      date: dateStr,
      skipped: true,
      skipReason: "no_matches",
      created: 0,
      articleIds: [],
    };
  }
  const userPrompt = buildUserPrompt({ recap, date: dateStr });
  const callOpts: CallClaudeOptions = {
    model: opts.model ?? DEFAULT_MODEL,
    maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    userPrompt,
    fetchImpl: opts.fetchImpl,
  };
  const result = await callClaude(callOpts);
  const articles = parseLLMResponse(result.text);
  const ids = await createArticles({ date: dateStr, articles });
  serverLog.info(
    `[pro-gazette-llm] generated date=${dateStr} articles=${ids.length} input=${result.usage?.inputTokens ?? "?"} output=${result.usage?.outputTokens ?? "?"}`,
  );
  return {
    date: dateStr,
    skipped: false,
    created: ids.length,
    articleIds: ids,
  };
}
