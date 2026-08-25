"use client";
import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../auth-client";
import SkillTooltip from "../me/teams/components/SkillTooltip";
import KeywordChips from "./KeywordChips";
import { useLanguage } from "../contexts/LanguageContext";
import { STAR_PLAYER_PAIR_PARTNERS } from "@bb/game-engine";
import {
  starPlayerBlock,
  starPlayerBlockLabel,
  type StarPlayerBlock,
} from "./star-player-availability";

export interface StarPlayer {
  slug: string;
  displayName: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  hirableBy: string[] | ["all"];
  specialRule?: string;
  /** Mots-clés FR (lignée + type), ex: "Humain, Blitzer". */
  keywords?: string | null;
  /** Mots-clés traduits EN, ex: "Human, Blitzer". */
  keywordsEn?: string | null;
}

interface StarPlayerSelectorProps {
  roster: string;
  selectedStarPlayers: string[];
  onSelectionChange: (selected: string[]) => void;
  currentPlayerCount: number;
  availableBudget: number; // En po (pas en K po)
  disabled?: boolean;
  ruleset?: string;
  /**
   * Ligue régionale retenue pour l'équipe. Elle seule débloque les Star
   * Players : sans elle, l'API sert l'union des Ligues du roster et le
   * sélecteur propose des recrues que la création refuse ensuite.
   */
  regionalLeague?: string | null;
  /**
   * Star Players masqués du sélecteur (ex : bannis par un règlement de
   * tournoi). Optionnel — sans effet si absent.
   */
  excludedSlugs?: readonly string[];
  /**
   * Remonte le coût total (po) de la sélection courante à chaque changement
   * (ex : calcul de la taxe SPP d'un règlement de tournoi). Optionnel.
   */
  onSelectedCostChange?: (totalCostPo: number) => void;
  /**
   * Plafond de joueurs du format (Star Players compris). Défaut 16 (BB11) ;
   * le Sevens plafonne à 11. Sert au message « plus de place ».
   */
  maxTotalPlayers?: number;
}

// Paires obligatoires de Star Players — source unique : le catalogue
// (`STAR_PLAYER_PAIR_PARTNERS`). La table cablee ici oubliait Dribl & Drull,
// pourtant declares cote serveur : le selecteur laissait donc composer une
// equipe que l'API rejetait.
const STAR_PLAYER_PAIRS: Record<string, string> = STAR_PLAYER_PAIR_PARTNERS;

export default function StarPlayerSelector({
  roster,
  selectedStarPlayers,
  onSelectionChange,
  currentPlayerCount,
  availableBudget,
  disabled = false,
  ruleset = "season_3",
  regionalLeague = null,
  excludedSlugs,
  onSelectedCostChange,
  maxTotalPlayers = 16,
}: StarPlayerSelectorProps) {
  const { t, language } = useLanguage();
  const [availableStarPlayers, setAvailableStarPlayers] = useState<
    StarPlayer[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  // Purge d'une sélection devenue invalide (changement de roster ou de Ligue
  // régionale) : lues par ref pour ne pas relancer le chargement à chaque
  // clic sur une case.
  const selectionRef = useRef(selectedStarPlayers);
  selectionRef.current = selectedStarPlayers;
  const selectionCallbackRef = useRef(onSelectionChange);
  selectionCallbackRef.current = onSelectionChange;

  useEffect(() => {
    if (!roster) return;

    setLoading(true);
    setError(null);

    const token = localStorage.getItem("auth_token");
    const params = new URLSearchParams();
    if (ruleset) params.set("ruleset", ruleset);
    if (regionalLeague) params.set("regionalLeague", regionalLeague);
    const query = params.toString() ? `?${params.toString()}` : "";
    fetch(`${API_BASE}/star-players/available/${roster}${query}`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Erreur ${r.status}`);
        return r.json();
      })
      .then((data) => {
        // A9 — défensif : dédup par slug au cas où l'API renverrait des
        // doublons (un star éligible par plusieurs critères hirableBy).
        const list: StarPlayer[] = data.starPlayers || [];
        const seen = new Set<string>();
        const deduped = list.filter((sp) => {
          if (seen.has(sp.slug)) return false;
          seen.add(sp.slug);
          return true;
        });
        setAvailableStarPlayers(deduped);
        setLoading(false);
        // Un Star Player déjà coché mais absent de la nouvelle liste (Ligue
        // changée en cours de construction) doit sortir de la sélection :
        // sinon il partait au serveur, qui refusait toute la création.
        const availableSlugs = new Set(deduped.map((sp) => sp.slug));
        const kept = selectionRef.current.filter((slug) =>
          availableSlugs.has(slug),
        );
        if (kept.length !== selectionRef.current.length) {
          selectionCallbackRef.current(kept);
        }
      })
      .catch((e) => {
        setError(e.message || t.teams.errorLoading);
        setLoading(false);
      });
  }, [roster, ruleset, regionalLeague, t]);

  const handleToggle = (slug: string) => {
    if (disabled) return;

    const isCurrentlySelected = selectedStarPlayers.includes(slug);
    let newSelection = [...selectedStarPlayers];

    if (isCurrentlySelected) {
      // Déselectionner
      newSelection = newSelection.filter((s) => s !== slug);

      // Si c'est une paire, déselectionner aussi le partenaire
      const partner = STAR_PLAYER_PAIRS[slug];
      if (partner && newSelection.includes(partner)) {
        newSelection = newSelection.filter((s) => s !== partner);
      }
    } else {
      // Sélectionner
      newSelection.push(slug);

      // Si c'est une paire, sélectionner aussi le partenaire
      const partner = STAR_PLAYER_PAIRS[slug];
      if (partner && !newSelection.includes(partner)) {
        newSelection.push(partner);
      }
    }

    onSelectionChange(newSelection);
  };

  const calculateTotalCost = () => {
    return selectedStarPlayers.reduce((sum, slug) => {
      const sp = availableStarPlayers.find((p) => p.slug === slug);
      return sum + (sp?.cost || 0);
    }, 0);
  };

  const totalCost = calculateTotalCost();

  // Remonte le coût total de la sélection au parent (ref pour éviter une
  // boucle d'effet si le callback change d'identité à chaque render).
  const costCallbackRef = useRef(onSelectedCostChange);
  costCallbackRef.current = onSelectedCostChange;
  useEffect(() => {
    costCallbackRef.current?.(totalCost);
  }, [totalCost]);

  // Les Star Players exclus (ex : bannis par un règlement de tournoi) restent
  // AFFICHÉS, désactivés avec la raison : les masquer laissait le coach
  // chercher une recrue qui n'apparaissait nulle part. Seuls ceux qui sont
  // déjà cochés doivent être purgés de la sélection — à la charge du parent.
  const visibleStarPlayers = availableStarPlayers;

  const totalPlayers = currentPlayerCount + selectedStarPlayers.length;
  const budgetExceeded = totalCost > availableBudget;
  const playerLimitExceeded = totalPlayers > maxTotalPlayers;

  /** `null` = recrutable ; sinon la raison du blocage (affichée sous la ligne). */
  const blockFor = (sp: StarPlayer): StarPlayerBlock | null =>
    starPlayerBlock({
      star: sp,
      catalog: availableStarPlayers,
      selected: selectedStarPlayers,
      selectedCostPo: totalCost,
      availableBudgetPo: availableBudget,
      currentPlayerCount,
      maxPlayers: maxTotalPlayers,
      pairPartners: STAR_PLAYER_PAIRS,
      bannedSlugs: excludedSlugs,
    });

  const isPaired = (slug: string): boolean => {
    return slug in STAR_PLAYER_PAIRS;
  };

  const getPartnerName = (slug: string): string | null => {
    const partnerSlug = STAR_PLAYER_PAIRS[slug];
    if (!partnerSlug) return null;

    const partner = availableStarPlayers.find((p) => p.slug === partnerSlug);
    return partner?.displayName || partnerSlug;
  };

  if (loading) {
    return (
      <div className="rounded border bg-white p-4">
        <h3 className="font-semibold mb-2">⭐ {t.starPlayers.title}</h3>
        <p className="text-sm text-gray-500">{t.teams.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border bg-white p-4">
        <h3 className="font-semibold mb-2">⭐ {t.starPlayers.title}</h3>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (visibleStarPlayers.length === 0) {
    return (
      <div className="rounded border bg-white p-4">
        <h3 className="font-semibold mb-2">⭐ {t.starPlayers.title}</h3>
        <p className="text-sm text-gray-500">
          {t.teams.noStarPlayersAvailable}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">⭐ {t.teams.starPlayersAvailable}</h3>
        <div className="text-sm text-gray-600">
          {selectedStarPlayers.length} {t.teams.selected}
        </div>
      </div>

      {(budgetExceeded || playerLimitExceeded) && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {budgetExceeded && (
            <div>
              ⚠️{" "}
              {t.teams.budgetExceeded.replace(
                "{amount}",
                ((totalCost - availableBudget) / 1000).toFixed(0),
              )}
            </div>
          )}
          {playerLimitExceeded && (
            <div>
              ⚠️{" "}
              {t.teams.playerLimitExceeded.replace(
                "{count}",
                totalPlayers.toString(),
              )}
            </div>
          )}
        </div>
      )}

      <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
        <div className="flex justify-between">
          <span>{t.teams.totalStarPlayersCost}</span>
          <span className="font-semibold">
            {(totalCost / 1000).toFixed(0)}
            {t.teams.kpo}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{t.teams.totalPlayersCount}</span>
          <span className="font-semibold">
            {totalPlayers} / {maxTotalPlayers}
          </span>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {visibleStarPlayers.map((sp) => {
          const isSelected = selectedStarPlayers.includes(sp.slug);
          const block = blockFor(sp);
          const canSelect = block === null;
          const paired = isPaired(sp.slug);
          const partnerName = paired ? getPartnerName(sp.slug) : null;

          return (
            <div
              key={sp.slug}
              className={`border rounded p-3 transition-colors ${
                isSelected
                  ? "bg-emerald-50 border-emerald-300"
                  : canSelect
                    ? "bg-white hover:bg-gray-50"
                    : "bg-gray-100 border-gray-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  data-testid={`star-player-${sp.slug}`}
                  aria-label={sp.displayName}
                  checked={isSelected}
                  onChange={() => handleToggle(sp.slug)}
                  disabled={disabled || (!isSelected && !canSelect)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold">{sp.displayName}</span>
                      {paired && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          {t.teams.pairWith.replace(
                            "{partner}",
                            partnerName || "",
                          )}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-emerald-700">
                      {(sp.cost / 1000).toFixed(0)}K po
                    </div>
                  </div>

                  <KeywordChips
                    keywords={
                      language === "en"
                        ? (sp.keywordsEn ?? sp.keywords)
                        : (sp.keywords ?? sp.keywordsEn)
                    }
                    className="mt-1"
                  />

                  <div className="flex items-center gap-4 text-xs text-gray-600 mt-1">
                    <span>MA {sp.ma}</span>
                    <span>ST {sp.st}</span>
                    <span>AG {sp.ag}+</span>
                    {sp.pa !== null && <span>PA {sp.pa}+</span>}
                    <span>AV {sp.av}+</span>
                  </div>

                  {block && (
                    <p
                      data-testid={`star-player-blocked-${sp.slug}`}
                      className="mt-1.5 inline-flex items-start gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-1 text-xs text-amber-800"
                    >
                      <span aria-hidden="true">🚫</span>
                      <span>{starPlayerBlockLabel(block)}</span>
                    </p>
                  )}

                  {expandedPlayer === sp.slug && (
                    <div className="mt-2 text-sm space-y-1">
                      <div className="text-gray-700">
                        <span className="font-medium">{t.teams.skills}</span>
                        <div className="mt-1">
                          <SkillTooltip
                            skillsString={sp.skills}
                            className="text-xs"
                          />
                        </div>
                      </div>
                      {sp.specialRule && (
                        <div className="text-gray-700">
                          <span className="font-medium">
                            {t.teams.specialRule}
                          </span>{" "}
                          {sp.specialRule}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setExpandedPlayer(
                        expandedPlayer === sp.slug ? null : sp.slug,
                      )
                    }
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                  >
                    {expandedPlayer === sp.slug
                      ? t.teams.hideDetails
                      : t.teams.showDetails}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedStarPlayers.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-sm text-gray-600">
            <strong>{t.teams.selectedStarPlayers}</strong>
            <ul className="mt-1 space-y-1">
              {selectedStarPlayers.map((slug) => {
                const sp = availableStarPlayers.find((p) => p.slug === slug);
                return (
                  <li key={slug} className="flex justify-between">
                    <span>{sp?.displayName || slug}</span>
                    <span className="font-medium">
                      {sp ? `${(sp.cost / 1000).toFixed(0)}K po` : "?"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
