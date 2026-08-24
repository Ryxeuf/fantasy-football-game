/**
 * Règlements de tournoi — accès DB avec fallback registre statique.
 *
 * Le modèle `TournamentRuleset` (éditable en admin) est la source de vérité
 * RUNTIME ; le registre pur `@bb/game-engine` (`TOURNAMENT_RULESETS`) reste
 * la source de SEED (create-only, cf. `scripts/seed-tournament-rulesets.ts`)
 * et le FALLBACK quand un slug n'existe pas (encore) en base — un
 * environnement non seedé garde donc le comportement historique.
 *
 * Les colonnes Json sont écrites en string sérialisée (compatible PG Json +
 * miroir SQLite) et relues via un parser TOLÉRANT aux deux formes (cf.
 * CLAUDE.md « Parser tolerant PG + sqlite »). Une ligne DB illisible ne
 * casse jamais un flux : on retombe sur le registre statique si le slug y
 * existe, sinon le slug est traité comme inconnu.
 *
 * Sémantique d'archivage (`archivedAt`) : un règlement archivé n'est plus
 * proposé ni acceptable pour de NOUVELLES sélections (création d'équipe,
 * de ligue, de coupe) — `resolveTournamentRulesetSelection` le refuse —
 * mais les entités qui le référencent déjà restent valides :
 * `getTournamentRulesetRecord` (labels, règles, build Flow B d'une coupe
 * existante) résout aussi les archivés.
 */

import {
  TOURNAMENT_RULESETS,
  getTournamentRuleset,
  isGameFormat,
  RULESETS,
  type GameFormat,
  type Ruleset,
  type TournamentInducementRule,
  type TournamentRosterRules,
  type TournamentRulesetDefinition,
  type TournamentScoring,
  type TournamentSkillCosts,
  type TournamentSkillStacking,
  type TournamentStarTaxBracket,
} from '@bb/game-engine';
import { prisma } from '../prisma';
import { serverLog } from '../utils/server-log';

/** Ligne DB minimale nécessaire au parsing (PG ou miroir SQLite). */
export interface TournamentRulesetRow {
  readonly id: string;
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string;
  readonly shortLabel: string;
  readonly version: string;
  readonly edition: string;
  readonly format: string;
  readonly descriptionFr: string | null;
  readonly resurrection: boolean;
  readonly minRegularPlayersBeforeStars: number;
  readonly rosterRules: unknown;
  readonly skillCosts: unknown;
  readonly eliteSkills: unknown;
  readonly bannedStarPlayers: unknown;
  readonly starPlayerSppTax: unknown;
  readonly allowedInducements: unknown;
  readonly scoring: unknown;
  readonly archivedAt: Date | null;
}

// ——— Parsers tolérants (objet natif PG ou string sérialisée SQLite) ———

function parseJsonValue(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

const SKILL_STACKINGS: readonly TournamentSkillStacking[] = [
  'none',
  'one_player',
  'two_players',
];

function parseRosterRules(
  raw: unknown,
): Record<string, TournamentRosterRules> | null {
  const source = parseJsonValue(raw);
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }
  const out: Record<string, TournamentRosterRules> = {};
  for (const [slug, value] of Object.entries(
    source as Record<string, unknown>,
  )) {
    if (value === null || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    const goldBudget = Number(entry.goldBudget);
    const sppBudget = Number(entry.sppBudget);
    if (!Number.isFinite(goldBudget) || goldBudget <= 0) continue;
    if (!Number.isFinite(sppBudget) || sppBudget < 0) continue;
    const stacking = SKILL_STACKINGS.includes(
      entry.skillStacking as TournamentSkillStacking,
    )
      ? (entry.skillStacking as TournamentSkillStacking)
      : 'none';
    out[slug] = {
      goldBudget,
      sppBudget,
      skillStacking: stacking,
      starPlayersAllowed: entry.starPlayersAllowed === true,
    };
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parseSkillCosts(raw: unknown): TournamentSkillCosts | null {
  const source = parseJsonValue(raw);
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }
  const entry = source as Record<string, unknown>;
  const fields = [
    'firstPrimary',
    'firstSecondary',
    'secondPrimary',
    'secondSecondary',
    'eliteSurcharge',
  ] as const;
  const out: Record<string, number> = {};
  for (const field of fields) {
    const value = Number(entry[field]);
    if (!Number.isFinite(value) || value < 0) return null;
    out[field] = value;
  }
  return out as unknown as TournamentSkillCosts;
}

function parseStringArray(raw: unknown): readonly string[] {
  const source = parseJsonValue(raw);
  if (!Array.isArray(source)) return [];
  return source.filter((s): s is string => typeof s === 'string');
}

/**
 * Tranches de taxe SPP. Convention DB : `maxTotalCostK: null` = tranche
 * ouverte (∞) — JSON ne sérialise pas Infinity. Tranches triées par borne
 * croissante, l'ouverte en dernier.
 */
function parseTaxBrackets(raw: unknown): readonly TournamentStarTaxBracket[] {
  const source = parseJsonValue(raw);
  if (!Array.isArray(source)) return [];
  const brackets: TournamentStarTaxBracket[] = [];
  for (const item of source) {
    if (item === null || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const spp = Number(entry.spp);
    if (!Number.isFinite(spp) || spp < 0) continue;
    const rawMax = entry.maxTotalCostK;
    const maxTotalCostK =
      rawMax === null || rawMax === undefined
        ? Number.POSITIVE_INFINITY
        : Number(rawMax);
    if (!(maxTotalCostK > 0)) continue;
    brackets.push({ maxTotalCostK, spp });
  }
  return brackets.sort((a, b) => a.maxTotalCostK - b.maxTotalCostK);
}

function parseInducements(
  raw: unknown,
): readonly TournamentInducementRule[] {
  const source = parseJsonValue(raw);
  if (!Array.isArray(source)) return [];
  const out: TournamentInducementRule[] = [];
  for (const item of source) {
    if (item === null || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.slug !== 'string' || entry.slug.length === 0) continue;
    const cost = Number(entry.cost);
    if (!Number.isFinite(cost) || cost < 0) continue;
    out.push({
      slug: entry.slug,
      cost,
      ...(Number.isFinite(Number(entry.max)) && Number(entry.max) > 0
        ? { max: Number(entry.max) }
        : {}),
      ...(typeof entry.noteFr === 'string' && entry.noteFr.length > 0
        ? { noteFr: entry.noteFr }
        : {}),
    });
  }
  return out;
}

const NEUTRAL_SCORING: TournamentScoring = {
  win: 0,
  draw: 0,
  loss: 0,
  concession: 0,
};

function parseScoring(raw: unknown): TournamentScoring {
  const source = parseJsonValue(raw);
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return NEUTRAL_SCORING;
  }
  const entry = source as Record<string, unknown>;
  const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    win: num(entry.win),
    draw: num(entry.draw),
    loss: num(entry.loss),
    concession: num(entry.concession),
  };
}

/**
 * Ligne DB → définition du moteur. `null` si la ligne est inexploitable
 * (rosterRules ou skillCosts illisibles) : le caller retombe alors sur le
 * registre statique si le slug y existe.
 */
export function parseTournamentRulesetRow(
  row: TournamentRulesetRow,
): TournamentRulesetDefinition | null {
  const rosterRules = parseRosterRules(row.rosterRules);
  const skillCosts = parseSkillCosts(row.skillCosts);
  if (!rosterRules || !skillCosts) return null;
  const edition: Ruleset = (RULESETS as readonly string[]).includes(row.edition)
    ? (row.edition as Ruleset)
    : 'season_3';
  const format: GameFormat = isGameFormat(row.format) ? row.format : 'bb11';
  return {
    slug: row.slug,
    nameFr: row.nameFr,
    nameEn: row.nameEn,
    shortLabel: row.shortLabel,
    version: row.version,
    edition,
    format,
    descriptionFr: row.descriptionFr ?? '',
    resurrection: row.resurrection,
    minRegularPlayersBeforeStars: row.minRegularPlayersBeforeStars,
    rosterRules,
    skillCosts,
    eliteSkills: parseStringArray(row.eliteSkills),
    bannedStarPlayers: parseStringArray(row.bannedStarPlayers),
    starPlayerSppTax: parseTaxBrackets(row.starPlayerSppTax),
    allowedInducements: parseInducements(row.allowedInducements),
    scoring: parseScoring(row.scoring),
  };
}

// ——— Sérialisation (seed + écritures admin) ———

/**
 * Définition (moteur ou payload admin validé) → data Prisma. Les champs
 * Json sont sérialisés en string (compatibles PG + miroir SQLite) ;
 * Infinity → `maxTotalCostK: null` (tranche ouverte).
 */
export function serializeDefinitionForDb(
  def: TournamentRulesetDefinition,
): Record<string, unknown> {
  return {
    slug: def.slug,
    nameFr: def.nameFr,
    nameEn: def.nameEn,
    shortLabel: def.shortLabel,
    version: def.version,
    edition: def.edition,
    format: def.format,
    descriptionFr: def.descriptionFr || null,
    resurrection: def.resurrection,
    minRegularPlayersBeforeStars: def.minRegularPlayersBeforeStars,
    rosterRules: JSON.stringify(def.rosterRules),
    skillCosts: JSON.stringify(def.skillCosts),
    eliteSkills: JSON.stringify(def.eliteSkills),
    bannedStarPlayers: JSON.stringify(def.bannedStarPlayers),
    starPlayerSppTax: JSON.stringify(
      def.starPlayerSppTax.map((b) => ({
        maxTotalCostK: Number.isFinite(b.maxTotalCostK) ? b.maxTotalCostK : null,
        spp: b.spp,
      })),
    ),
    allowedInducements: JSON.stringify(def.allowedInducements),
    scoring: JSON.stringify(def.scoring),
  };
}

// ——— Résolution runtime ———

export interface TournamentRulesetRecord {
  readonly def: TournamentRulesetDefinition;
  readonly archived: boolean;
  /** Provenance : ligne DB ou fallback registre statique. */
  readonly source: 'db' | 'static';
  /** Id DB (null en fallback statique). */
  readonly id: string | null;
}

/**
 * Résout un slug vers sa définition, ARCHIVÉS INCLUS (labels, règles d'une
 * entité existante, build Flow B d'une coupe créée avant archivage).
 * DB d'abord, registre statique en fallback, null si inconnu des deux.
 */
export async function getTournamentRulesetRecord(
  slug: string,
): Promise<TournamentRulesetRecord | null> {
  let row: TournamentRulesetRow | null = null;
  try {
    row = (await prisma.tournamentRuleset.findUnique({
      where: { slug },
    })) as TournamentRulesetRow | null;
  } catch (e) {
    // Table absente (env non migré) ou erreur DB : fallback statique.
    serverLog.warn(
      `[tournament-rulesets] lecture DB impossible pour ${slug}, fallback registre statique`,
      e instanceof Error ? e.message : e,
    );
  }
  if (row) {
    const def = parseTournamentRulesetRow(row);
    if (def) {
      return {
        def,
        archived: row.archivedAt !== null,
        source: 'db',
        id: row.id,
      };
    }
    serverLog.error(
      `[tournament-rulesets] ligne DB illisible pour ${slug} — fallback registre statique`,
    );
  }
  const staticDef = getTournamentRuleset(slug);
  if (!staticDef) return null;
  return { def: staticDef, archived: false, source: 'static', id: null };
}

export type TournamentRulesetSelection =
  | { readonly ok: true; readonly def: TournamentRulesetDefinition | null }
  | { readonly ok: false; readonly error: string };

/**
 * Valide un slug de règlement choisi pour une NOUVELLE sélection (création
 * d'équipe, de ligue, de coupe). `null`/vide = aucun règlement (nominal) ;
 * slug inconnu OU archivé = refus explicite (pas de fallback silencieux :
 * le règlement conditionne budget et restrictions).
 */
export async function resolveTournamentRulesetSelection(
  value: unknown,
): Promise<TournamentRulesetSelection> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, def: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'Règlement de tournoi inconnu' };
  }
  const record = await getTournamentRulesetRecord(value);
  if (!record) {
    return { ok: false, error: 'Règlement de tournoi inconnu' };
  }
  if (record.archived) {
    return { ok: false, error: 'Ce règlement de tournoi est archivé' };
  }
  return { ok: true, def: record.def };
}

/**
 * Labels courts par slug, batchés (évite le N+1 des listings). Slugs
 * inconnus → fallback registre statique → slug brut.
 */
export async function getTournamentRulesetLabels(
  slugs: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(slugs.filter((s): s is string => Boolean(s))),
  ];
  const labels = new Map<string, string>();
  if (unique.length === 0) return labels;
  try {
    const rows = (await prisma.tournamentRuleset.findMany({
      where: { slug: { in: unique } },
      select: { slug: true, shortLabel: true },
    })) as Array<{ slug: string; shortLabel: string }>;
    for (const row of rows) labels.set(row.slug, row.shortLabel);
  } catch {
    // Fallback statique ci-dessous.
  }
  for (const slug of unique) {
    if (!labels.has(slug)) {
      labels.set(slug, getTournamentRuleset(slug)?.shortLabel ?? slug);
    }
  }
  return labels;
}

export async function getTournamentRulesetLabel(slug: string): Promise<string> {
  const labels = await getTournamentRulesetLabels([slug]);
  return labels.get(slug) ?? slug;
}

export interface TournamentRulesetSummary {
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string;
  readonly shortLabel: string;
  readonly version: string;
  readonly edition: string;
  readonly format: string;
  readonly resurrection: boolean;
  readonly archived: boolean;
  readonly source: 'db' | 'static';
  readonly id: string | null;
}

/**
 * Liste des règlements : lignes DB + entrées du registre statique absentes
 * de la base (env non seedé → NAF WC reste proposé). Les archivés sont
 * exclus par défaut (listes publiques / sélecteurs).
 */
export async function listTournamentRulesetSummaries(options?: {
  readonly includeArchived?: boolean;
}): Promise<TournamentRulesetSummary[]> {
  const includeArchived = options?.includeArchived ?? false;
  const summaries = new Map<string, TournamentRulesetSummary>();
  try {
    const rows = (await prisma.tournamentRuleset.findMany({
      orderBy: { nameFr: 'asc' },
    })) as TournamentRulesetRow[];
    for (const row of rows) {
      summaries.set(row.slug, {
        slug: row.slug,
        nameFr: row.nameFr,
        nameEn: row.nameEn,
        shortLabel: row.shortLabel,
        version: row.version,
        edition: row.edition,
        format: row.format,
        resurrection: row.resurrection,
        archived: row.archivedAt !== null,
        source: 'db',
        id: row.id,
      });
    }
  } catch (e) {
    serverLog.warn(
      '[tournament-rulesets] listing DB impossible, fallback registre statique',
      e instanceof Error ? e.message : e,
    );
  }
  for (const def of Object.values(TOURNAMENT_RULESETS)) {
    if (summaries.has(def.slug)) continue;
    summaries.set(def.slug, {
      slug: def.slug,
      nameFr: def.nameFr,
      nameEn: def.nameEn,
      shortLabel: def.shortLabel,
      version: def.version,
      edition: def.edition,
      format: def.format,
      resurrection: def.resurrection,
      archived: false,
      source: 'static',
      id: null,
    });
  }
  return [...summaries.values()]
    .filter((s) => includeArchived || !s.archived)
    .sort((a, b) => a.nameFr.localeCompare(b.nameFr, 'fr'));
}
