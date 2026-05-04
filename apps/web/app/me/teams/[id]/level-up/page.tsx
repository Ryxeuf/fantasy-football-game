"use client";
/**
 * L2.B.4 — Sprint Ligues v2 PR5 : page level-up Jeu en Ligue.
 *
 * Liste les joueurs de l'equipe avec un avancement en attente (servis
 * par GET /team/:teamId/pending-advancements) et propose pour chacun
 * un choix de type (primary/secondary/random-primary/random-secondary)
 * + skill. Au submit, applique via POST .../advancement et refresh
 * la liste.
 *
 * Gate par feature flag `leagues_v2_ui` : redirige vers /me/teams/:id
 * si le flag est off (cosmetique, le serveur reste accessible).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../lib/api-client";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { useFeatureFlag } from "../../../../hooks/useFeatureFlag";
import { LEAGUES_V2_UI_FLAG } from "../../../../lib/featureFlagKeys";

type AdvancementType =
  | "primary"
  | "secondary"
  | "random-primary"
  | "random-secondary";

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
}

interface PendingResponse {
  teamId: string;
  items: PendingAdvancementItem[];
}

interface ApplyResponse {
  applied?: boolean;
  newSpp?: number;
  newAdvancementCount?: number;
  addedSkill?: string;
  currentValue?: number;
  sequenceClosed?: boolean;
  // skipped path: server returns 4xx + sendError, never reaches here.
}

const ADVANCEMENT_COSTS: Record<AdvancementType, number[]> = {
  primary: [6, 8, 12, 16, 20, 30],
  secondary: [12, 14, 18, 22, 26, 40],
  "random-primary": [3, 4, 6, 8, 10, 15],
  "random-secondary": [6, 8, 12, 16, 20, 30],
};

function costFor(type: AdvancementType, advancementsTaken: number): number {
  const idx = Math.min(Math.max(advancementsTaken, 0), 5);
  return ADVANCEMENT_COSTS[type][idx];
}

export default function LevelUpPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const flagEnabled = useFeatureFlag(LEAGUES_V2_UI_FLAG);
  const teamId = typeof params.id === "string" ? params.id : "";

  const [items, setItems] = useState<PendingAdvancementItem[]>([]);
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
  onApplied: () => void;
}

function PlayerRow({ item, teamId, onApplied }: PlayerRowProps) {
  const { t } = useLanguage();
  const [type, setType] = useState<AdvancementType>("random-primary");
  const [skillSlug, setSkillSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<ApplyResponse | null>(null);

  const cost = useMemo(
    () => costFor(type, item.advancementsTaken),
    [type, item.advancementsTaken],
  );
  const canAfford = item.spp >= cost;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      const trimmed = skillSlug.trim();
      if (trimmed.length === 0) return;
      if (!canAfford) {
        setError(t.teams.levelUpInsufficientSpp ?? "PSP insuffisants");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await apiRequest<ApplyResponse>(
          `/team/${teamId}/players/${item.teamPlayerId}/advancement`,
          {
            method: "POST",
            body: JSON.stringify({ type, skillSlug: trimmed }),
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
            ✓ +{applied.addedSkill}
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
                Random Primary ({ADVANCEMENT_COSTS["random-primary"][item.advancementsTaken]} PSP)
              </option>
              <option value="primary">
                Primary ({ADVANCEMENT_COSTS["primary"][item.advancementsTaken]} PSP)
              </option>
              <option value="random-secondary">
                Random Secondary (
                {ADVANCEMENT_COSTS["random-secondary"][item.advancementsTaken]}
                {" "}PSP)
              </option>
              <option value="secondary">
                Secondary ({ADVANCEMENT_COSTS["secondary"][item.advancementsTaken]} PSP)
              </option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              {t.teams.levelUpSkillLabel ?? "Skill (slug)"}
            </span>
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
          </label>
          <button
            type="submit"
            data-testid={`level-up-apply-${item.teamPlayerId}`}
            disabled={!canAfford || submitting || skillSlug.trim().length === 0}
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
