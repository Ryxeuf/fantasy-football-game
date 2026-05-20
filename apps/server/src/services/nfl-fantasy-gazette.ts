/**
 * Service Gazette par matchup (Phase 3.H) — narrative generee par LLM
 * post-settle pour donner du flavor a un matchup.
 *
 * Pattern : reutilise `callClaude` (anthropic-client.ts) sur Claude
 * Haiku, prompt structure pour repondre en JSON strict
 * `{ title, body }`. Persiste sur `NflFantasyMatchup.gazetteTitle/
 * gazetteBody/gazetteGeneratedAt`.
 *
 * Idempotent : skip si gazette deja generee, sauf si `force: true`.
 * Erreurs LLM (network, parse) sont typees via `NflFantasyGazetteError`.
 */

import { prisma } from "../prisma";
import { callClaude } from "./anthropic-client";
import {
  getMatchupDetailForAdmin,
  type AdminMatchupDetail,
  type AdminMatchupSideRow,
} from "./nfl-fantasy-admin-explorer";

// ────────────────────────────────────────────────────────────────────
// Erreurs typees
// ────────────────────────────────────────────────────────────────────

export class NflFantasyGazetteError extends Error {
  constructor(
    public readonly code:
      | "MATCHUP_NOT_FOUND"
      | "MATCHUP_NOT_SETTLED"
      | "LLM_INVALID_JSON"
      | "LLM_INVALID_SHAPE",
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyGazetteError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Prompt
// ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es le redacteur en chef de la "Nuffle Gazette", journal sportif fictif d'une ligue fantasy mariant la NFL et Blood Bowl.

Style : enthousiaste, pulp fiction, references aux dieux (Nuffle), exagerations comiques, mais factuellement ancre sur le score et les top scorers fournis.

Tu produis UN article narratif court (150-250 mots) sur le matchup fourni : qui a gagne, qui a brille, captain/vice highlights, anecdotes statistiques.

Tu DOIS repondre avec UNIQUEMENT un objet JSON strict (pas de texte avant ou apres, pas de fences \`\`\`json). Schema :

{
  "title": string,   // accrocheur, max 100 caracteres
  "body": string     // 150-250 mots
}

Pas de markdown lourd, pas d'HTML, pas de listes. Du texte coule.`;

interface GazettePromptInput {
  readonly seasonId: string;
  readonly weekId: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly winnerSide: "home" | "away" | "tie";
  readonly homeRace: string | null;
  readonly awayRace: string | null;
  readonly homeTop: ReadonlyArray<{
    pseudonym: string;
    finalSpp: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
    bbPosition: string;
  }>;
  readonly awayTop: ReadonlyArray<{
    pseudonym: string;
    finalSpp: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
    bbPosition: string;
  }>;
}

export function buildMatchupUserPrompt(input: GazettePromptInput): string {
  return [
    `Genere l'article Nuffle Gazette pour ce matchup fantasy NFL × Blood Bowl :`,
    "",
    "```json",
    JSON.stringify(input, null, 2),
    "```",
    "",
    `Le winner est : ${
      input.winnerSide === "tie"
        ? "EGALITE"
        : input.winnerSide === "home"
          ? `${input.homeTeam} (home)`
          : `${input.awayTeam} (away)`
    }.`,
    "Reponds UNIQUEMENT en JSON strict { title, body }.",
  ].join("\n");
}

interface ParsedGazette {
  readonly title: string;
  readonly body: string;
}

export function parseGazetteLLMResponse(text: string): ParsedGazette {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new NflFantasyGazetteError(
      "LLM_INVALID_JSON",
      `LLM response is not valid JSON: ${(e as Error).message}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new NflFantasyGazetteError(
      "LLM_INVALID_SHAPE",
      "expected object { title, body }",
    );
  }
  const obj = parsed as { title?: unknown; body?: unknown };
  if (typeof obj.title !== "string" || obj.title.length === 0) {
    throw new NflFantasyGazetteError(
      "LLM_INVALID_SHAPE",
      "title required (non-empty string)",
    );
  }
  if (typeof obj.body !== "string" || obj.body.length === 0) {
    throw new NflFantasyGazetteError(
      "LLM_INVALID_SHAPE",
      "body required (non-empty string)",
    );
  }
  return {
    title: obj.title.slice(0, 200),
    body: obj.body,
  };
}

// ────────────────────────────────────────────────────────────────────
// Pure helper : extrait top 3 starters par side
// ────────────────────────────────────────────────────────────────────

function topStarters(
  side: AdminMatchupSideRow,
): GazettePromptInput["homeTop"] {
  return side.starters.slice(0, 3).map((s) => ({
    pseudonym: s.playerPseudonym,
    finalSpp: s.finalSpp ?? 0,
    isCaptain: s.isCaptain,
    isViceCaptain: s.isViceCaptain,
    bbPosition: s.bbPosition,
  }));
}

function buildPromptInput(detail: AdminMatchupDetail): GazettePromptInput {
  return {
    seasonId: detail.seasonId,
    weekId: detail.weekId,
    homeTeam: detail.home.teamName,
    awayTeam: detail.away.teamName,
    homeScore: detail.home.score ?? 0,
    awayScore: detail.away.score ?? 0,
    winnerSide: (detail.winnerSide ?? "tie") as "home" | "away" | "tie",
    homeRace: detail.home.bbRace,
    awayRace: detail.away.bbRace,
    homeTop: topStarters(detail.home),
    awayTop: topStarters(detail.away),
  };
}

// ────────────────────────────────────────────────────────────────────
// Main entry
// ────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 800;

export interface GenerateMatchupGazetteOpts {
  /** Force regeneration meme si deja genere. Default false. */
  readonly force?: boolean;
  /** Override model (default Haiku). */
  readonly model?: string;
  /** Override maxTokens (default 800). */
  readonly maxTokens?: number;
  /** Override fetch impl (tests). */
  readonly fetchImpl?: typeof fetch;
}

export interface GenerateMatchupGazetteResult {
  readonly matchupId: string;
  readonly title: string;
  readonly body: string;
  readonly generatedAt: string;
  readonly skipped: boolean;
  readonly skipReason?: "already_generated";
  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  };
}

/**
 * Genere (ou skip si deja fait) la gazette pour un matchup settle.
 *
 * Flow :
 *   1. Charge le matchup via getMatchupDetailForAdmin
 *   2. Throw si introuvable ou non-settle (settledAt null)
 *   3. Skip si gazetteGeneratedAt != null sauf force=true
 *   4. Build prompt + call Claude Haiku
 *   5. Parse JSON { title, body }
 *   6. Persiste sur NflFantasyMatchup
 */
export async function generateMatchupGazette(
  matchupId: string,
  opts: GenerateMatchupGazetteOpts = {},
): Promise<GenerateMatchupGazetteResult> {
  const detail = await getMatchupDetailForAdmin(matchupId);
  if (!detail) {
    throw new NflFantasyGazetteError(
      "MATCHUP_NOT_FOUND",
      `NflFantasyMatchup ${matchupId} introuvable`,
    );
  }
  if (!detail.settledAt) {
    throw new NflFantasyGazetteError(
      "MATCHUP_NOT_SETTLED",
      `Matchup ${matchupId} pas encore settle — gazette impossible`,
    );
  }

  // Idempotence : check existing.
  type ExistingRow = {
    gazetteTitle: string | null;
    gazetteBody: string | null;
    gazetteGeneratedAt: Date | null;
  };
  const existing = (await prisma.nflFantasyMatchup.findUnique({
    where: { id: matchupId },
    select: {
      gazetteTitle: true,
      gazetteBody: true,
      gazetteGeneratedAt: true,
    },
  })) as ExistingRow | null;

  if (
    !opts.force &&
    existing?.gazetteGeneratedAt &&
    existing.gazetteTitle &&
    existing.gazetteBody
  ) {
    return {
      matchupId,
      title: existing.gazetteTitle,
      body: existing.gazetteBody,
      generatedAt: existing.gazetteGeneratedAt.toISOString(),
      skipped: true,
      skipReason: "already_generated",
    };
  }

  const userPrompt = buildMatchupUserPrompt(buildPromptInput(detail));
  const llmResult = await callClaude({
    model: opts.model ?? DEFAULT_MODEL,
    maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    userPrompt,
    fetchImpl: opts.fetchImpl,
  });

  const parsed = parseGazetteLLMResponse(llmResult.text);
  const now = new Date();

  await prisma.nflFantasyMatchup.update({
    where: { id: matchupId },
    data: {
      gazetteTitle: parsed.title,
      gazetteBody: parsed.body,
      gazetteGeneratedAt: now,
    },
  });

  return {
    matchupId,
    title: parsed.title,
    body: parsed.body,
    generatedAt: now.toISOString(),
    skipped: false,
    usage: llmResult.usage,
  };
}
