"use client";

/**
 * Recrutement de Star Players depuis la fiche d'édition d'équipe.
 *
 * Ils ne se recrutaient qu'au builder : une fois l'équipe créée, ni ajout ni
 * retrait. On réutilise ici le MÊME sélecteur qu'à la création
 * (`StarPlayerSelector`), y compris ses raisons d'indisponibilité, et on
 * traduit chaque case cochée/décochée en appel API immédiat — contrairement
 * au builder, l'équipe existe déjà.
 *
 * Les paires obligatoires sont gérées côté serveur (le partenaire est
 * recruté / retiré avec son binôme) : on se contente de recharger l'état
 * après chaque mutation.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import StarPlayerSelector from "../../../../components/StarPlayerSelector";
import { apiRequest } from "../../../../lib/api-client";

interface HiredStarPlayer {
  readonly id: string;
  readonly slug: string;
  readonly cost: number;
  readonly displayName?: string | null;
}

interface AvailabilityResponse {
  readonly currentPlayerCount: number;
  readonly currentStarPlayerCount: number;
  readonly totalPlayers: number;
  readonly maxPlayers: number;
  /** Budget restant, en K po. */
  readonly availableBudget: number;
}

interface TeamStarPlayersEditorProps {
  readonly teamId: string;
  readonly roster: string;
  readonly ruleset?: string;
  readonly regionalLeague?: string | null;
  /** Star Players bannis par le règlement de tournoi de l'équipe. */
  readonly excludedSlugs?: readonly string[];
  readonly disabled?: boolean;
  /** Rappelé après chaque recrutement/retrait (rafraîchir budget & VE). */
  readonly onChanged?: () => void;
}

export default function TeamStarPlayersEditor({
  teamId,
  roster,
  ruleset,
  regionalLeague = null,
  excludedSlugs,
  disabled = false,
  onChanged,
}: TeamStarPlayersEditorProps) {
  const [hired, setHired] = useState<HiredStarPlayer[]>([]);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [hiredRes, availRes] = await Promise.all([
      apiRequest<{ starPlayers: HiredStarPlayer[] }>(
        `/team/${teamId}/star-players`,
      ),
      apiRequest<AvailabilityResponse>(
        `/team/${teamId}/available-star-players`,
      ),
    ]);
    setHired(hiredRes.starPlayers ?? []);
    setAvailability(availRes);
  }, [teamId]);

  useEffect(() => {
    reload().catch((e: unknown) =>
      setError(e instanceof Error ? e.message : "Chargement impossible"),
    );
  }, [reload]);

  /**
   * Traduit la nouvelle sélection en recrutements / retraits. Séquentiel :
   * chaque appel change le budget et le nombre de joueurs, donc l'ordre
   * compte — on retire d'abord pour libérer places et budget.
   */
  const applySelection = useCallback(
    async (next: string[]) => {
      const current = hired.map((sp) => sp.slug);
      const toRemove = hired.filter((sp) => !next.includes(sp.slug));
      const toAdd = next.filter((slug) => !current.includes(slug));
      if (toRemove.length === 0 && toAdd.length === 0) return;

      setBusy(true);
      setError(null);
      try {
        for (const sp of toRemove) {
          await apiRequest(`/team/${teamId}/star-players/${sp.id}`, {
            method: "DELETE",
          });
        }
        for (const slug of toAdd) {
          await apiRequest(`/team/${teamId}/star-players`, {
            method: "POST",
            body: JSON.stringify({ starPlayerSlug: slug }),
          });
        }
        await reload();
        onChanged?.();
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Échec de la mise à jour";
        setError(message);
        toast.error(message);
        // L'état serveur fait foi : on resynchronise pour ne pas laisser
        // une case cochée que l'API vient de refuser.
        await reload().catch(() => {});
      } finally {
        setBusy(false);
      }
    },
    [hired, teamId, reload, onChanged],
  );

  if (!availability) {
    return (
      <div
        data-testid="team-star-players-editor"
        className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500"
      >
        {error ?? "Chargement des Star Players…"}
      </div>
    );
  }

  // Le sélecteur raisonne en budget DISPONIBLE pour la sélection courante :
  // il additionne le coût des Star Players cochés. Comme l'API a déjà déduit
  // les recrues en place, on les recrédite pour ne pas les compter deux fois.
  const hiredCostPo = hired.reduce((sum, sp) => sum + (sp.cost ?? 0), 0);
  const budgetForSelector = availability.availableBudget * 1000 + hiredCostPo;

  return (
    <div data-testid="team-star-players-editor" className="space-y-2">
      {error && (
        <p
          data-testid="team-star-players-error"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <StarPlayerSelector
        roster={roster}
        ruleset={ruleset}
        regionalLeague={regionalLeague}
        selectedStarPlayers={hired.map((sp) => sp.slug)}
        onSelectionChange={(next) => void applySelection(next)}
        currentPlayerCount={availability.currentPlayerCount}
        availableBudget={Math.max(0, budgetForSelector)}
        excludedSlugs={excludedSlugs}
        maxTotalPlayers={availability.maxPlayers}
        disabled={disabled || busy}
      />
    </div>
  );
}
