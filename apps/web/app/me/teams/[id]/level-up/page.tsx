"use client";
/**
 * L2.B.4 — Sprint Ligues v2 PR5 : page level-up Jeu en Ligue.
 *
 * Liste les joueurs de l'equipe avec un avancement en attente (servis
 * par GET /team/:teamId/pending-advancements) et propose pour chacun
 * un choix de type (primary/secondary/random-primary/characteristic)
 * + skill (ou stat pour une amelioration de caracteristique). Au submit,
 * applique via POST .../advancement et refresh la liste.
 *
 * Gate par le feature flag unique `league` : redirige vers /me/teams/:id
 * si le flag est off (cosmetique, le serveur reste accessible).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CharacteristicKind } from "@bb/game-engine";
import { apiRequest } from "../../../../lib/api-client";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { useFeatureFlag } from "../../../../hooks/useFeatureFlag";
import { LEAGUE_FLAG } from "../../../../lib/featureFlagKeys";

type AdvancementType =
  | "primary"
  | "secondary"
  | "random-primary"
  | "characteristic";

/** Les 5 caractéristiques améliorables, affichées dans le picker. */
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
  // Accès primaire/secondaire de la position (CSV codes G/A/S/P/M).
  // null = non renseigné -> picker non filtré (saisie libre).
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

/** Nom de catégorie DB -> code canonique (aligné serveur skill-access.ts).
 *  « Scélérates » = Sournoiserie (code K). */
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
  // S3 — amelioration de caracteristique : la stat ajoutee (ex: "st").
  addedStat?: string;
  currentValue?: number;
  sequenceClosed?: boolean;
  // skipped path: server returns 4xx + sendError, never reaches here.
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

export default function LevelUpPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const flagEnabled = useFeatureFlag(LEAGUE_FLAG);
  const teamId = typeof params.id === "string" ? params.id : "";

  const [items, setItems] = useState<PendingAdvancementItem[]>([]);
  const [catalog, setCatalog] = useState<SkillCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!flagEnabled) {
      router.replace(`/me/teams/${teamId}`);
    }
  }, [flagEnabled, teamId, router]);

  const loadItems = useCallback(async () => {
    if (!teamId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<PendingResponse>(
        `/team/${teamId}/pending-advancements`,
      );
      setItems(data.items ?? []);
      // Catalogue de skills pour le ruleset de l'equipe -> picker filtre.
      // Echec non bloquant : le formulaire retombe sur la saisie libre.
      try {
        const skills = await apiRequest<SkillsResponse>(
          `/skills?ruleset=${encodeURIComponent(data.ruleset ?? "season_3")}`,
        );
        setCatalog(skills.skills ?? []);
      } catch {
        setCatalog([]);
      }
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : t.leagues.formSubmitError,
      );
    } finally {
      setLoading(false);
    }
  }, [teamId, t.leagues.formSubmitError]);

  useEffect(() => {
    if (flagEnabled) loadItems();
  }, [flagEnabled, loadItems]);

  if (!flagEnabled) return null;

  return (
    <div
      data-testid="level-up-page"
      className="w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-6"
    >
      <div>
        <Link
          href={`/me/teams/${teamId}`}
          className="text-sm text-gray-600 hover:text-gray-800 inline-flex items-center gap-1"
        >
          ← {t.teams.backToTeam ?? "Retour a l'equipe"}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-nuffle-anthracite mt-2">
          {t.teams.levelUpTitle ?? "Ameliorations de joueurs"}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {t.teams.levelUpDescription ??
            "Les joueurs ayant assez de PSP peuvent prendre une nouvelle competence ou amelioration."}
        </p>
      </div>

      {error ? (
        <div
          data-testid="level-up-error"
          className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-gray-500">{t.common.loading}</div>
      ) : items.length === 0 ? (
        <div
          data-testid="level-up-empty"
          className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-300 rounded"
        >
          {t.teams.levelUpEmpty ?? "Aucun joueur en attente d'amelioration."}
        </div>
      ) : (
        <ul className="space-y-3" data-testid="level-up-list">
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
      )}
    </div>
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<ApplyResponse | null>(null);

  const isCharacteristic = type === "characteristic";

  const cost = useMemo(
    () => costFor(type, item.advancementsTaken),
    [type, item.advancementsTaken],
  );
  const canAfford = item.spp >= cost;

  // Accès renseigné ? (sinon -> saisie libre, rétro-compat season_2).
  const hasAccess =
    item.primarySkills != null || item.secondarySkills != null;

  // Pool de skills éligibles pour le type courant : on filtre le catalogue
  // par code catégorie du pool primaire/secondaire de la position.
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
        if (seen.has(s.slug)) return false; // dédoublonne (multi-ruleset)
        seen.add(s.slug);
        return true;
      })
      .sort((a, b) => a.nameFr.localeCompare(b.nameFr));
  }, [hasAccess, catalog, type, item.primarySkills, item.secondarySkills]);

  // Si le type change et que la skill sélectionnée n'est plus éligible, reset.
  useEffect(() => {
    if (!hasAccess) return;
    if (skillSlug && !eligibleSkills.some((s) => s.slug === skillSlug)) {
      setSkillSlug("");
    }
  }, [hasAccess, eligibleSkills, skillSlug]);

  // Reset de la stat quand on quitte le mode caractéristique.
  useEffect(() => {
    if (!isCharacteristic && stat !== "") setStat("");
  }, [isCharacteristic, stat]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      const trimmed = skillSlug.trim();
      // Validation specifique : stat pour une caracteristique, skill sinon.
      if (isCharacteristic) {
        if (stat === "") return;
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
          ? { type, stat }
          : { type, skillSlug: trimmed };
        const res = await apiRequest<ApplyResponse>(
          `/team/${teamId}/players/${item.teamPlayerId}/advancement`,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
        );
        setApplied(res);
        onApplied();
      } catch (e: unknown) {
        setError(
          e instanceof Error
            ? e.message
            : t.teams.levelUpApplyError ?? "Erreur",
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
      className="border border-gray-200 rounded-lg bg-white p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
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
            className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1"
          >
            ✓ +{applied.addedStat ? applied.addedStat.toUpperCase() : applied.addedSkill}
            {" • "}
            {t.teams.levelUpRemainingSpp ?? "PSP restants"}: {applied.newSpp}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-1.5 text-xs">
          {error}
        </div>
      ) : null}

      {!applied?.applied ? (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end"
        >
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              {t.teams.levelUpTypeLabel ?? "Type"}
            </span>
            <select
              data-testid={`level-up-type-${item.teamPlayerId}`}
              value={type}
              onChange={(e) => setType(e.target.value as AdvancementType)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="random-primary">
                Random Primary ({costFor("random-primary", item.advancementsTaken)} PSP)
              </option>
              <option value="primary">
                Primary ({costFor("primary", item.advancementsTaken)} PSP)
              </option>
              <option value="secondary">
                Secondary ({costFor("secondary", item.advancementsTaken)} PSP)
              </option>
              <option value="characteristic">
                Caractéristique ({costFor("characteristic", item.advancementsTaken)} PSP)
              </option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              {isCharacteristic
                ? "Caractéristique"
                : (t.teams.levelUpSkillLabel ?? "Compétence")}
            </span>
            {isCharacteristic ? (
              <select
                data-testid={`level-up-stat-${item.teamPlayerId}`}
                required
                value={stat}
                onChange={(e) =>
                  setStat(e.target.value as CharacteristicKind | "")
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
              >
                <option value="">— choisir —</option>
                {CHARACTERISTIC_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            ) : hasAccess ? (
              <select
                data-testid={`level-up-skill-${item.teamPlayerId}`}
                required
                value={skillSlug}
                onChange={(e) => setSkillSlug(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
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
                ? stat === ""
                : skillSlug.trim().length === 0)
            }
            className="px-3 py-1.5 rounded-md bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting
              ? t.leagues.formSubmitting
              : (t.teams.levelUpApplyButton ?? "Appliquer")}
          </button>
        </form>
      ) : null}

      {!canAfford && !applied?.applied ? (
        <div className="text-xs text-amber-700">
          {t.teams.levelUpNeedMoreSpp ?? "PSP insuffisants pour ce type"}{" "}
          ({cost} PSP requis)
        </div>
      ) : null}
    </li>
  );
}
