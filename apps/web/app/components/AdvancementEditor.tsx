"use client";
/**
 * Éditeur d'évolutions de joueurs (level-up Jeu en Ligue), extrait de la page
 * `/me/teams/[id]/level-up` pour être réutilisé tel quel dans l'onglet
 * « Évolutions » de la feuille de match.
 *
 * Auto-contenu : charge les avancements en attente
 * (`GET /team/:teamId/pending-advancements`) + le catalogue de skills, et
 * applique les choix (`POST .../advancement`). Les avancements n'existent
 * qu'après validation du match par le commissaire (création des
 * `LeaguePostMatchSequence`), ce qui garantit le staging.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  characteristicOptionsForRoll,
  type CharacteristicKind,
} from "@bb/game-engine";
import { apiRequest } from "../lib/api-client";
import { useLanguage } from "../contexts/LanguageContext";

export type AdvancementType =
  | "primary"
  | "secondary"
  | "random-primary"
  | "characteristic";

const CHARACTERISTIC_OPTIONS: ReadonlyArray<{
  code: CharacteristicKind;
  label: string;
}> = [
  { code: "ma", label: "MA (Mouvement)" },
  { code: "st", label: "ST (Force)" },
  { code: "ag", label: "AG (Agilite)" },
  { code: "pa", label: "PA (Passe)" },
  { code: "av", label: "AV (Armure)" },
];

export interface PendingAdvancementItem {
  sequenceId: string;
  matchId: string;
  seasonId: string;
  teamPlayerId: string;
  playerName: string;
  spp: number;
  advancementsTaken: number;
  nextAdvancementCost: number;
  createdAt: string;
  position: string | null;
  primarySkills: string | null;
  secondarySkills: string | null;
  // Fiche du joueur (toggle « caractéristiques & compétences »).
  stats?: {
    ma: number;
    st: number;
    ag: number;
    pa: number | null;
    av: number;
  };
  skills?: string | null;
}

interface PendingResponse {
  teamId: string;
  ruleset: string;
  items: PendingAdvancementItem[];
}

export interface SkillCatalogItem {
  slug: string;
  nameFr: string;
  category: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
}

/**
 * Choix d'évolution stagé sur la feuille de match (nouveau workflow :
 * la saisie des évolutions fait partie de la feuille, l'application au
 * roster n'a lieu qu'à la validation commissaire).
 */
export interface StagedAdvancementChoice {
  type: AdvancementType;
  skillSlug?: string | null;
  category?: string | null;
  stat?: CharacteristicKind | null;
  d8?: number | null;
  /** Renseignés par le serveur à la validation (recap). */
  applied?: boolean;
  cost?: number;
  skipReason?: string;
}

/** Description localisée d'une compétence (repli FR si EN absent). */
function skillDesc(
  s: SkillCatalogItem | undefined,
  language: string,
): string | null {
  if (!s) return null;
  const d = language === "en" ? s.descriptionEn || s.description : s.description;
  return d && d.trim().length > 0 ? d : null;
}

interface SkillsResponse {
  skills: SkillCatalogItem[];
}

/** Nom de catégorie DB -> code canonique. « Scélérates » = Sournoiserie (K). */
const CATEGORY_CODE: Record<string, string> = {
  General: "G",
  Agility: "A",
  Strength: "S",
  Passing: "P",
  Mutation: "M",
  "Scélérates": "K",
};

/** Code catégorie → libellé FR (pour le tirage random-primary, p.121). */
const CATEGORY_LABELS: Record<string, string> = {
  G: "Générales",
  A: "Agilité",
  S: "Force",
  P: "Passe",
  M: "Mutation",
  K: "Scélérates",
};
const CATEGORY_ORDER = ["G", "A", "S", "P", "M", "K"] as const;

/** Parse un CSV d'accès en Set de codes (robuste "G,S" / "GS" ; F->S alias). */
function parseAccess(csv: string | null): Set<string> {
  const out = new Set<string>();
  if (!csv) return out;
  for (const ch of csv.toUpperCase()) {
    if (ch === "F") out.add("S");
    else if ("GASPMK".includes(ch)) out.add(ch);
  }
  return out;
}

interface ApplyResponse {
  applied?: boolean;
  newSpp?: number;
  newAdvancementCount?: number;
  addedSkill?: string;
  addedStat?: string;
  currentValue?: number;
  sequenceClosed?: boolean;
}

const ADVANCEMENT_COSTS: Record<AdvancementType, number[]> = {
  primary: [6, 8, 12, 16, 20, 30],
  secondary: [10, 12, 16, 20, 24, 34],
  "random-primary": [3, 4, 6, 8, 10, 15],
  characteristic: [14, 16, 20, 24, 28, 38],
};

function costFor(type: AdvancementType, advancementsTaken: number): number {
  const idx = Math.min(Math.max(advancementsTaken, 0), 5);
  return ADVANCEMENT_COSTS[type][idx];
}

/** Métadonnées d'affichage des 4 types d'amélioration (ordre = du moins cher). */
const TYPE_META: ReadonlyArray<{
  value: AdvancementType;
  short: string;
  icon: string;
}> = [
  { value: "random-primary", short: "Hasard", icon: "🎲" },
  { value: "primary", short: "Principale", icon: "⭐" },
  { value: "secondary", short: "Secondaire", icon: "✦" },
  { value: "characteristic", short: "Carac.", icon: "💪" },
];

/** Style d'une puce/chip sélectionnable (pill). */
function chipClass(active: boolean, disabled = false): string {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition select-none";
  if (disabled) {
    return `${base} cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300`;
  }
  if (active) {
    return `${base} border-nuffle-gold bg-nuffle-gold text-white shadow-sm`;
  }
  return `${base} border-gray-300 bg-white text-nuffle-anthracite hover:border-nuffle-gold hover:text-nuffle-bronze`;
}

/**
 * E2/E6 — chip de catégorie de compétence : TOUTES les catégories sont
 * affichées ; celles autorisées par le type d'avancement sont en BLEU et
 * cliquables, les autres grisées et non sélectionnables.
 */
function categoryChipClass(active: boolean, accessible: boolean): string {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition select-none";
  if (!accessible) {
    return `${base} cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300`;
  }
  if (active) {
    return `${base} border-blue-600 bg-blue-600 text-white shadow-sm`;
  }
  return `${base} border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100`;
}

export interface AdvancementEditorProps {
  readonly teamId: string;
  /** Libellé quand aucun joueur n'est en attente. */
  readonly emptyLabel?: string;
}

/** Liste auto-contenue des avancements en attente d'une équipe + application. */
export function AdvancementEditor({
  teamId,
  emptyLabel,
}: AdvancementEditorProps): JSX.Element {
  const { t } = useLanguage();
  const [items, setItems] = useState<PendingAdvancementItem[]>([]);
  const [catalog, setCatalog] = useState<SkillCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!teamId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<PendingResponse>(
        `/team/${teamId}/pending-advancements`,
      );
      setItems(data.items ?? []);
      try {
        const skills = await apiRequest<SkillsResponse>(
          `/api/skills?ruleset=${encodeURIComponent(data.ruleset ?? "season_3")}`,
        );
        setCatalog(skills.skills ?? []);
      } catch {
        setCatalog([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.leagues.formSubmitError);
    } finally {
      setLoading(false);
    }
  }, [teamId, t.leagues.formSubmitError]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  if (loading) {
    return <div className="text-sm text-gray-500">{t.common.loading}</div>;
  }
  if (error) {
    return (
      <div
        data-testid="advancement-error"
        className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
      >
        {error}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div
        data-testid="advancement-empty"
        className="rounded border border-dashed border-gray-300 py-6 text-center text-sm text-gray-500"
      >
        {emptyLabel ??
          t.teams.levelUpEmpty ??
          "Aucun joueur en attente d'amelioration."}
      </div>
    );
  }
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      data-testid="advancement-list"
    >
      {items.map((it) => (
        <PlayerRow
          key={it.teamPlayerId}
          item={it}
          teamId={teamId}
          catalog={catalog}
          onApplied={loadItems}
        />
      ))}
    </div>
  );
}

export interface PlayerRowProps {
  item: PendingAdvancementItem;
  teamId: string;
  catalog: SkillCatalogItem[];
  onApplied: () => void;
  /**
   * Mode « staging feuille de match » : le choix n'est PAS appliqué au
   * roster (pas de POST advancement) mais remonté au parent, qui le
   * stocke sur la feuille. Le tirage random-primary reste serveur.
   */
  stage?: {
    staged: StagedAdvancementChoice | null;
    onStage: (choice: StagedAdvancementChoice) => void;
    onUnstage: () => void;
    disabled?: boolean;
  };
}

export function PlayerRow({
  item,
  teamId,
  catalog,
  onApplied,
  stage,
}: PlayerRowProps) {
  const { t, language } = useLanguage();
  const [type, setType] = useState<AdvancementType>("random-primary");
  const [skillSlug, setSkillSlug] = useState("");
  const [stat, setStat] = useState<CharacteristicKind | "">("");
  const [d8Roll, setD8Roll] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<ApplyResponse | null>(null);
  // random-primary (p.121) : catégorie choisie + 2 candidats tirés par le serveur.
  const [category, setCategory] = useState<string>("");
  const [rollCandidates, setRollCandidates] = useState<string[] | null>(null);
  const [rolling, setRolling] = useState(false);
  // Recherche dans le picker de compétence (primary/secondary).
  const [skillSearch, setSkillSearch] = useState("");
  // E2 — filtre de catégorie (picker primary/secondary). "" = toutes.
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  // Compétence survolée/focus pour prévisualiser sa description avant de choisir.
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  // Toggle « fiche du joueur » (caractéristiques + compétences actuelles).
  const [showSheet, setShowSheet] = useState(false);

  const playerSkillSlugs = useMemo(
    () =>
      (item.skills ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    [item.skills],
  );

  const isCharacteristic = type === "characteristic";
  const isRandomPrimary = type === "random-primary";

  // Catégories Principales de la position (pour le tirage random-primary).
  const primaryCategories = useMemo(() => {
    const pool = parseAccess(item.primarySkills);
    return CATEGORY_ORDER.filter((c) => pool.has(c));
  }, [item.primarySkills]);

  // slug -> item complet (nom + description) pour l'affichage.
  const catalogBySlug = useMemo(() => {
    const m = new Map<string, SkillCatalogItem>();
    for (const s of catalog) m.set(s.slug, s);
    return m;
  }, [catalog]);
  const nameOf = useCallback(
    (slug: string) => catalogBySlug.get(slug)?.nameFr ?? slug,
    [catalogBySlug],
  );

  const cost = useMemo(
    () => costFor(type, item.advancementsTaken),
    [type, item.advancementsTaken],
  );
  const canAfford = item.spp >= cost;

  const hasAccess =
    item.primarySkills != null || item.secondarySkills != null;

  // E2/E6 — catégories accessibles pour le type d'avancement choisi.
  const accessPool = useMemo(
    () =>
      parseAccess(
        type === "secondary" ? item.secondarySkills : item.primarySkills,
      ),
    [type, item.primarySkills, item.secondarySkills],
  );

  const eligibleSkills = useMemo(() => {
    if (!hasAccess || catalog.length === 0) return [];
    const isPrimary = type === "primary" || type === "random-primary";
    const pool = parseAccess(
      isPrimary ? item.primarySkills : item.secondarySkills,
    );
    const seen = new Set<string>();
    return catalog
      .filter((s) => {
        const code = CATEGORY_CODE[s.category];
        if (!code || !pool.has(code)) return false;
        if (seen.has(s.slug)) return false;
        seen.add(s.slug);
        return true;
      })
      .sort((a, b) => a.nameFr.localeCompare(b.nameFr));
  }, [hasAccess, catalog, type, item.primarySkills, item.secondarySkills]);

  const filteredSkills = useMemo(() => {
    const q = skillSearch.trim().toLowerCase();
    if (!q) return eligibleSkills;
    return eligibleSkills.filter((s) => s.nameFr.toLowerCase().includes(q));
  }, [eligibleSkills, skillSearch]);

  // Regroupement des compétences éligibles par catégorie (ordre canonique).
  const skillsByCategory = useMemo(() => {
    const groups = new Map<string, SkillCatalogItem[]>();
    for (const s of filteredSkills) {
      const code = CATEGORY_CODE[s.category] ?? s.category;
      const list = groups.get(code);
      if (list) list.push(s);
      else groups.set(code, [s]);
    }
    return CATEGORY_ORDER.filter((c) => groups.has(c))
      .filter((c) => !categoryFilter || c === categoryFilter)
      .map((c) => ({
        code: c,
        label: CATEGORY_LABELS[c],
        skills: groups.get(c) as SkillCatalogItem[],
      }));
  }, [filteredSkills, categoryFilter]);

  // Description à prévisualiser : survol prioritaire, sinon sélection courante.
  const previewDesc = useMemo(() => {
    const slug = previewSlug ?? skillSlug;
    const item = slug ? catalogBySlug.get(slug) : undefined;
    if (!item) return null;
    return { name: item.nameFr, text: skillDesc(item, language) };
  }, [previewSlug, skillSlug, catalogBySlug, language]);

  useEffect(() => {
    if (!hasAccess) return;
    if (skillSlug && !eligibleSkills.some((s) => s.slug === skillSlug)) {
      setSkillSlug("");
    }
  }, [hasAccess, eligibleSkills, skillSlug]);

  useEffect(() => {
    if (!isCharacteristic) {
      if (stat !== "") setStat("");
      if (d8Roll !== null) setD8Roll(null);
    }
  }, [isCharacteristic, stat, d8Roll]);

  // Changer de type ou de catégorie invalide le tirage en cours.
  useEffect(() => {
    setRollCandidates(null);
    if (isRandomPrimary) setSkillSlug("");
  }, [type, category, isRandomPrimary]);

  const handleRoll = useCallback(async () => {
    if (!category || rolling) return;
    setRolling(true);
    setError(null);
    setSkillSlug("");
    setRollCandidates(null);
    try {
      const res = await apiRequest<{ candidates: string[] }>(
        `/team/${teamId}/players/${item.teamPlayerId}/advancement/roll-random-primary`,
        { method: "POST", body: JSON.stringify({ category }) },
      );
      setRollCandidates(res.candidates);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : t.teams.levelUpApplyError ?? "Erreur",
      );
    } finally {
      setRolling(false);
    }
  }, [category, rolling, teamId, item.teamPlayerId, t.teams.levelUpApplyError]);

  const d8AllowedStats: readonly CharacteristicKind[] =
    d8Roll != null ? characteristicOptionsForRoll(d8Roll) : [];

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      const trimmed = skillSlug.trim();
      if (isCharacteristic) {
        if (stat === "" || d8Roll == null) return;
      } else if (trimmed.length === 0) {
        return;
      }
      if (!canAfford) {
        setError(t.teams.levelUpInsufficientSpp ?? "PSP insuffisants");
        return;
      }
      // Mode staging : pas d'application — le choix est remonté au parent
      // (stocké sur la feuille de match, appliqué à la validation).
      if (stage) {
        stage.onStage(
          isCharacteristic
            ? { type, stat: stat || null, d8: d8Roll }
            : isRandomPrimary
              ? { type, category, skillSlug: trimmed }
              : { type, skillSlug: trimmed },
        );
        setStat("");
        setD8Roll(null);
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const body = isCharacteristic
          ? { type, stat, d8: d8Roll }
          : isRandomPrimary
            ? { type, category, skillSlug: trimmed }
            : { type, skillSlug: trimmed };
        const res = await apiRequest<ApplyResponse>(
          `/team/${teamId}/players/${item.teamPlayerId}/advancement`,
          { method: "POST", body: JSON.stringify(body) },
        );
        setApplied(res);
        setStat("");
        setD8Roll(null);
        onApplied();
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : t.teams.levelUpApplyError ?? "Erreur",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      submitting,
      skillSlug,
      isCharacteristic,
      isRandomPrimary,
      category,
      stat,
      d8Roll,
      canAfford,
      teamId,
      item.teamPlayerId,
      type,
      onApplied,
      stage,
      t.teams.levelUpInsufficientSpp,
      t.teams.levelUpApplyError,
    ],
  );

  return (
    <div
      data-testid={`level-up-row-${item.teamPlayerId}`}
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      {/* En-tête joueur */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-nuffle-anthracite">
            {item.playerName}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <span className="inline-flex items-center rounded-full bg-nuffle-gold/10 px-2 py-0.5 font-semibold text-nuffle-bronze">
              {item.spp} PSP
            </span>
            <span>· {item.advancementsTaken}/6 amél.</span>
          </div>
        </div>
        <button
          type="button"
          data-testid={`level-up-toggle-sheet-${item.teamPlayerId}`}
          onClick={() => setShowSheet((v) => !v)}
          aria-expanded={showSheet}
          className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition hover:border-nuffle-gold hover:text-nuffle-bronze"
        >
          {showSheet ? "▲ Fiche" : "▼ Fiche"}
        </button>
      </div>

      {/* Fiche du joueur : caractéristiques + compétences actuelles */}
      {showSheet ? (
        <div
          data-testid={`level-up-sheet-${item.teamPlayerId}`}
          className="rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {(
              [
                ["MA", item.stats?.ma],
                ["ST", item.stats?.st],
                ["AG", item.stats?.ag],
                ["PA", item.stats?.pa],
                ["AV", item.stats?.av],
              ] as ReadonlyArray<[string, number | null | undefined]>
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-md border border-gray-200 bg-white py-1"
              >
                <div className="text-[10px] font-semibold uppercase text-gray-400">
                  {label}
                </div>
                <div className="text-sm font-bold text-nuffle-anthracite">
                  {value == null
                    ? "—"
                    : `${value}${
                        label === "AG" || label === "PA" || label === "AV"
                          ? "+"
                          : ""
                      }`}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Compétences ({playerSkillSlugs.length})
            </div>
            {playerSkillSlugs.length === 0 ? (
              <div className="mt-1 text-xs text-gray-400">
                Aucune compétence.
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {playerSkillSlugs.map((slug) => (
                  <span
                    key={slug}
                    className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs text-nuffle-anthracite"
                  >
                    {nameOf(slug)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {stage?.staged ? (
        <div
          data-testid={`level-up-staged-${item.teamPlayerId}`}
          className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <div>
            📋{" "}
            <strong>
              {stage.staged.type === "characteristic"
                ? `+${(stage.staged.stat ?? "").toUpperCase()}`
                : nameOf(stage.staged.skillSlug ?? "")}
            </strong>{" "}
            ({TYPE_META.find((tm) => tm.value === stage.staged?.type)?.short ??
              stage.staged.type}
            ) — sera appliqué à la validation du commissaire.
          </div>
          {!stage.disabled ? (
            <button
              type="button"
              data-testid={`level-up-unstage-${item.teamPlayerId}`}
              onClick={stage.onUnstage}
              className="self-start rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              Retirer de ma saisie
            </button>
          ) : null}
        </div>
      ) : stage?.disabled ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500">
          Saisie verrouillée (déjà validée de ton côté).
        </p>
      ) : applied?.applied ? (
        <div
          data-testid={`level-up-applied-${item.teamPlayerId}`}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          ✓{" "}
          <strong>
            {applied.addedStat
              ? `+${applied.addedStat.toUpperCase()}`
              : applied.addedSkill
                ? nameOf(applied.addedSkill)
                : ""}
          </strong>{" "}
          appris · {applied.newSpp} PSP restants
        </div>
      ) : (
        <>
          {/* Type d'amélioration — puces */}
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t.teams.levelUpTypeLabel ?? "Type d'amélioration"}
          >
            {TYPE_META.map((tm) => {
              const c = costFor(tm.value, item.advancementsTaken);
              const afford = item.spp >= c;
              const active = type === tm.value;
              return (
                <button
                  key={tm.value}
                  type="button"
                  data-testid={`level-up-type-${tm.value}-${item.teamPlayerId}`}
                  onClick={() => {
                    setType(tm.value);
                    setCategoryFilter("");
                  }}
                  aria-pressed={active}
                  title={afford ? undefined : `${c} PSP requis`}
                  className={`${chipClass(active)}${afford ? "" : " opacity-50"}`}
                >
                  <span>{tm.icon}</span>
                  <span>{tm.short}</span>
                  <span className={active ? "text-white/80" : "text-gray-400"}>
                    · {c}
                  </span>
                </button>
              );
            })}
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            {/* Corps selon le type choisi */}
            {isRandomPrimary ? (
              <div className="flex flex-col gap-2">
                {primaryCategories.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    Aucune catégorie principale pour ce joueur.
                  </div>
                ) : (
                  // E2/E6 — toutes les catégories affichées : accessibles en
                  // bleu, les autres grisées non sélectionnables.
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORY_ORDER.map((code) => {
                      const accessible = primaryCategories.includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          data-testid={`level-up-category-${code}-${item.teamPlayerId}`}
                          onClick={() => accessible && setCategory(code)}
                          disabled={!accessible}
                          aria-pressed={category === code}
                          title={
                            accessible
                              ? undefined
                              : "Non accessible en Principale pour ce joueur"
                          }
                          className={categoryChipClass(
                            category === code,
                            accessible,
                          )}
                        >
                          {CATEGORY_LABELS[code]}
                        </button>
                      );
                    })}
                  </div>
                )}
                {category ? (
                  <button
                    type="button"
                    data-testid={`level-up-roll-${item.teamPlayerId}`}
                    onClick={handleRoll}
                    disabled={rolling}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-600 disabled:opacity-50"
                  >
                    🎲{" "}
                    {rolling
                      ? "Tirage…"
                      : rollCandidates
                        ? "Relancer"
                        : "Tirer 2 compétences"}
                  </button>
                ) : (
                  <p className="text-xs text-gray-500">
                    Choisis une catégorie principale, puis tire : 2 compétences
                    au hasard, tu en gardes une.
                  </p>
                )}
                {rollCandidates ? (
                  <div
                    data-testid={`level-up-candidates-${item.teamPlayerId}`}
                    className="flex flex-col gap-1.5"
                  >
                    {rollCandidates.map((slug) => {
                      const active = skillSlug === slug;
                      const desc = skillDesc(catalogBySlug.get(slug), language);
                      return (
                        <button
                          key={slug}
                          type="button"
                          data-testid={`level-up-candidate-${slug}-${item.teamPlayerId}`}
                          onClick={() => setSkillSlug(slug)}
                          aria-pressed={active}
                          className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                            active
                              ? "border-nuffle-gold bg-nuffle-gold/10 ring-1 ring-nuffle-gold"
                              : "border-gray-200 bg-white hover:border-nuffle-gold"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-medium text-nuffle-anthracite">
                              {nameOf(slug)}
                            </span>
                            {active ? (
                              <span className="text-xs text-nuffle-bronze">
                                ✓ choisi
                              </span>
                            ) : null}
                          </span>
                          {desc ? (
                            <span className="mt-1 block text-xs leading-snug text-gray-500">
                              {desc}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    {rollCandidates.length < 2 ? (
                      <p className="text-xs text-amber-700">
                        Une seule compétence disponible dans cette catégorie.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : isCharacteristic ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  data-testid={`level-up-d8-${item.teamPlayerId}`}
                  onClick={() => {
                    setD8Roll(Math.floor(Math.random() * 8) + 1);
                    setStat("");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
                >
                  🎲 {d8Roll != null ? "Relancer le D8" : "Lancer le D8"}
                </button>
                {d8Roll != null ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-xs text-amber-800">
                      Jet D8 : <strong>{d8Roll}</strong> → caractéristiques
                      possibles :
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {d8AllowedStats.map((code) => (
                        <button
                          key={code}
                          type="button"
                          data-testid={`level-up-stat-${code}-${item.teamPlayerId}`}
                          onClick={() => setStat(code)}
                          aria-pressed={stat === code}
                          className={chipClass(stat === code)}
                        >
                          {CHARACTERISTIC_OPTIONS.find((o) => o.code === code)
                            ?.label ?? code.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    Lance le D8 pour révéler les caractéristiques améliorables.
                  </p>
                )}
              </div>
            ) : hasAccess ? (
              <div className="flex flex-col gap-1.5">
                {/* E2/E6 — catégories : autorisées en bleu (filtre),
                    non autorisées grisées non sélectionnables. */}
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Catégories de compétences"
                >
                  {CATEGORY_ORDER.map((code) => {
                    const accessible = accessPool.has(code);
                    const active = categoryFilter === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        data-testid={`level-up-cat-${code}-${item.teamPlayerId}`}
                        onClick={() =>
                          accessible && setCategoryFilter(active ? "" : code)
                        }
                        disabled={!accessible}
                        aria-pressed={active}
                        title={
                          accessible
                            ? undefined
                            : `Non accessible en ${
                                type === "secondary"
                                  ? "Secondaire"
                                  : "Principale"
                              } pour ce joueur`
                        }
                        className={categoryChipClass(active, accessible)}
                      >
                        {CATEGORY_LABELS[code]}
                      </button>
                    );
                  })}
                </div>
                <input
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  data-testid={`level-up-skill-search-${item.teamPlayerId}`}
                  placeholder="Rechercher une compétence…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <div className="flex max-h-56 flex-col gap-2 overflow-auto">
                  {skillsByCategory.length === 0 ? (
                    <span className="text-xs text-gray-400">
                      Aucune compétence pour ce type.
                    </span>
                  ) : (
                    skillsByCategory.map((g) => (
                      <div key={g.code}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          {g.label}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {g.skills.map((s) => (
                            <button
                              key={s.slug}
                              type="button"
                              data-testid={`level-up-skill-${s.slug}-${item.teamPlayerId}`}
                              onClick={() => setSkillSlug(s.slug)}
                              onMouseEnter={() => setPreviewSlug(s.slug)}
                              onMouseLeave={() => setPreviewSlug(null)}
                              onFocus={() => setPreviewSlug(s.slug)}
                              onBlur={() => setPreviewSlug(null)}
                              aria-pressed={skillSlug === s.slug}
                              className={chipClass(skillSlug === s.slug)}
                            >
                              {s.nameFr}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {/* Aperçu de la description (survol prioritaire, sinon choix). */}
                {previewDesc ? (
                  <div
                    data-testid={`level-up-skill-desc-${item.teamPlayerId}`}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                  >
                    <div className="font-semibold text-nuffle-anthracite">
                      {previewDesc.name}
                    </div>
                    <div className="mt-0.5 leading-snug">
                      {previewDesc.text ?? "Pas de description disponible."}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <input
                data-testid={`level-up-skill-${item.teamPlayerId}`}
                type="text"
                maxLength={64}
                value={skillSlug}
                onChange={(e) => setSkillSlug(e.target.value)}
                placeholder="block, dodge, sure-hands…"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            )}

            <button
              type="submit"
              data-testid={`level-up-apply-${item.teamPlayerId}`}
              disabled={
                !canAfford ||
                submitting ||
                (isCharacteristic
                  ? d8Roll == null || stat === ""
                  : skillSlug.trim().length === 0)
              }
              className="mt-1 inline-flex items-center justify-center rounded-lg bg-nuffle-gold px-3 py-2 text-sm font-semibold text-white transition hover:bg-nuffle-bronze disabled:opacity-40"
            >
              {submitting
                ? t.leagues.formSubmitting
                : stage
                  ? `Ajouter à ma saisie · ${cost} PSP`
                  : `${t.teams.levelUpApplyButton ?? "Appliquer"} · ${cost} PSP`}
            </button>
            {!canAfford ? (
              <p className="text-xs text-amber-700">
                {t.teams.levelUpNeedMoreSpp ?? "PSP insuffisants"} ({cost} PSP
                requis).
              </p>
            ) : null}
          </form>
        </>
      )}
    </div>
  );
}
