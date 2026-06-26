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

interface PendingAdvancementItem {
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
}

interface PendingResponse {
  teamId: string;
  ruleset: string;
  items: PendingAdvancementItem[];
}

interface SkillCatalogItem {
  slug: string;
  nameFr: string;
  category: string;
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
          `/skills?ruleset=${encodeURIComponent(data.ruleset ?? "season_3")}`,
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
    <ul className="space-y-3" data-testid="advancement-list">
      {items.map((it) => (
        <PlayerRow
          key={it.teamPlayerId}
          item={it}
          teamId={teamId}
          catalog={catalog}
          onApplied={loadItems}
        />
      ))}
    </ul>
  );
}

interface PlayerRowProps {
  item: PendingAdvancementItem;
  teamId: string;
  catalog: SkillCatalogItem[];
  onApplied: () => void;
}

function PlayerRow({ item, teamId, catalog, onApplied }: PlayerRowProps) {
  const { t } = useLanguage();
  const [type, setType] = useState<AdvancementType>("random-primary");
  const [skillSlug, setSkillSlug] = useState("");
  const [stat, setStat] = useState<CharacteristicKind | "">("");
  const [d8Roll, setD8Roll] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<ApplyResponse | null>(null);

  const isCharacteristic = type === "characteristic";

  const cost = useMemo(
    () => costFor(type, item.advancementsTaken),
    [type, item.advancementsTaken],
  );
  const canAfford = item.spp >= cost;

  const hasAccess =
    item.primarySkills != null || item.secondarySkills != null;

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
      setSubmitting(true);
      setError(null);
      try {
        const body = isCharacteristic
          ? { type, stat, d8: d8Roll }
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
      stat,
      d8Roll,
      canAfford,
      teamId,
      item.teamPlayerId,
      type,
      onApplied,
      t.teams.levelUpInsufficientSpp,
      t.teams.levelUpApplyError,
    ],
  );

  return (
    <li
      data-testid={`level-up-row-${item.teamPlayerId}`}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-nuffle-anthracite">
            {item.playerName}
          </div>
          <div className="text-xs text-gray-500">
            PSP: <strong>{item.spp}</strong>
            {" • "}
            {t.teams.levelUpAdvancementsTaken ?? "Ameliorations prises"}:{" "}
            <strong>{item.advancementsTaken}</strong>
          </div>
        </div>
        {applied?.applied ? (
          <div
            data-testid={`level-up-applied-${item.teamPlayerId}`}
            className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
          >
            ✓ +
            {applied.addedStat
              ? applied.addedStat.toUpperCase()
              : applied.addedSkill}
            {" • "}
            {t.teams.levelUpRemainingSpp ?? "PSP restants"}: {applied.newSpp}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {!applied?.applied ? (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-end gap-2 sm:grid-cols-3"
        >
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              {t.teams.levelUpTypeLabel ?? "Type"}
            </span>
            <select
              data-testid={`level-up-type-${item.teamPlayerId}`}
              value={type}
              onChange={(e) => setType(e.target.value as AdvancementType)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="random-primary">
                Random Primary (
                {costFor("random-primary", item.advancementsTaken)} PSP)
              </option>
              <option value="primary">
                Primary ({costFor("primary", item.advancementsTaken)} PSP)
              </option>
              <option value="secondary">
                Secondary ({costFor("secondary", item.advancementsTaken)} PSP)
              </option>
              <option value="characteristic">
                Caractéristique (
                {costFor("characteristic", item.advancementsTaken)} PSP)
              </option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              {isCharacteristic
                ? "Caractéristique"
                : t.teams.levelUpSkillLabel ?? "Compétence"}
            </span>
            {isCharacteristic ? (
              <div className="mt-1 space-y-1.5">
                <button
                  type="button"
                  data-testid={`level-up-d8-${item.teamPlayerId}`}
                  onClick={() => {
                    setD8Roll(Math.floor(Math.random() * 8) + 1);
                    setStat("");
                  }}
                  className="block w-full rounded-md bg-amber-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                >
                  🎲 {d8Roll != null ? "Relancer le D8" : "Lancer le D8"}
                </button>
                {d8Roll != null ? (
                  <>
                    <div className="text-xs text-amber-800">
                      Jet D8 : {d8Roll} →{" "}
                      {d8AllowedStats
                        .map(
                          (s) =>
                            CHARACTERISTIC_OPTIONS.find((o) => o.code === s)
                              ?.label ?? s.toUpperCase(),
                        )
                        .join(" ou ")}
                    </div>
                    <select
                      data-testid={`level-up-stat-${item.teamPlayerId}`}
                      required
                      value={stat}
                      onChange={(e) =>
                        setStat(e.target.value as CharacteristicKind | "")
                      }
                      className="block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">— choisir —</option>
                      {d8AllowedStats.map((code) => (
                        <option key={code} value={code}>
                          {CHARACTERISTIC_OPTIONS.find((o) => o.code === code)
                            ?.label ?? code.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <div className="text-xs text-gray-500">
                    Lancez le D8 pour révéler les caractéristiques améliorables.
                  </div>
                )}
              </div>
            ) : hasAccess ? (
              <select
                data-testid={`level-up-skill-${item.teamPlayerId}`}
                required
                value={skillSlug}
                onChange={(e) => setSkillSlug(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">
                  {eligibleSkills.length === 0
                    ? "— aucune compétence pour ce type —"
                    : "— choisir —"}
                </option>
                {eligibleSkills.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.nameFr}
                  </option>
                ))}
              </select>
            ) : (
              <input
                data-testid={`level-up-skill-${item.teamPlayerId}`}
                type="text"
                required
                maxLength={64}
                value={skillSlug}
                onChange={(e) => setSkillSlug(e.target.value)}
                placeholder="block, dodge, sure-hands..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            )}
          </label>
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
            className="rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting
              ? t.leagues.formSubmitting
              : t.teams.levelUpApplyButton ?? "Appliquer"}
          </button>
        </form>
      ) : null}

      {!canAfford && !applied?.applied ? (
        <div className="text-xs text-amber-700">
          {t.teams.levelUpNeedMoreSpp ?? "PSP insuffisants pour ce type"} ({cost}{" "}
          PSP requis)
        </div>
      ) : null}
    </li>
  );
}
