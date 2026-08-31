"use client";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../auth-client";
import { apiRequest } from "../../../lib/api-client";
import { useTournamentRulesetLabel } from "../../../lib/tournament-rulesets";
import SkillTooltip from "../components/SkillTooltip";
import SkillAccessBadges from "../components/SkillAccessBadges";
import KeywordChips from "../../../components/KeywordChips";
import TeamInfoDisplay from "../components/TeamInfoDisplay";
import StarPlayersPanel from "../components/StarPlayersPanel";
import {
  getPlayerCost,
  getDisplayName,
  getRerollCost,
} from "@bb/game-engine";
import { buildTeamPlayerCardData, encodeCardPayload } from "../../../lib/player-card/card-model";
import { formatPlusStat } from "../../../lib/format-stats";
import {
  buildSkillAccessByPosition,
  buildPositionMetaByPosition,
  makePositionResolvers,
} from "./roster-skill-access";
import { PlayerIdentityInlineEdit } from "./PlayerIdentityInlineEdit";
import { TeamNameInlineEdit } from "./TeamNameInlineEdit";
import PlayerImageUploader from "./PlayerImageUploader";
import { exportTeamToPDF, exportSkillsSheet, exportMatchSheet } from "../utils/exportPDF";
import { useLanguage } from "../../../contexts/LanguageContext";
import { UMAMI_EVENTS, trackUmamiEvent } from "../../../lib/umami-events";
import { shouldShowTeamLoadError } from "./team-detail-error";
import { rosterPlayersOf } from "../../../lib/roster-players";
import { useFeatureFlag } from "../../../hooks/useFeatureFlag";
import { LEAGUE_FLAG } from "../../../lib/featureFlagKeys";
import { PendingAdvancementsBanner } from "./PendingAdvancementsBanner";
import { MatchReportBanner } from "./MatchReportBanner";
import TeamShareToggle from "./TeamShareToggle";
import FirstTeamWelcomeBanner from "./FirstTeamWelcomeBanner";
import RosterBadge from "../../../components/RosterBadge";
import CaptainPanel from "./CaptainPanel";
import TeamLogo from "../../../components/TeamLogo";
import TeamLogoUploader from "../components/TeamLogoUploader";

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

// Barème SPP par palier (miroir de packages/game-engine advancements.ts) pour
// afficher les PSP dépensés au build sur la fiche d'équipe.
const ADVANCEMENT_PSP_COSTS: Record<string, number[]> = {
  primary: [6, 8, 12, 16, 20, 30],
  secondary: [10, 12, 16, 20, 24, 34],
  "random-primary": [3, 4, 6, 8, 10, 15],
  characteristic: [14, 16, 20, 24, 28, 38],
};

/** PSP dépensés par un joueur (somme des paliers de ses advancements). */
function pspSpentForPlayer(advancementsJson: unknown): number {
  if (typeof advancementsJson !== "string") return 0;
  let parsed: unknown;
  try {
    parsed = JSON.parse(advancementsJson);
  } catch {
    return 0;
  }
  if (!Array.isArray(parsed)) return 0;
  return parsed.reduce((sum: number, adv: any, index: number) => {
    const table = ADVANCEMENT_PSP_COSTS[adv?.type];
    return sum + (table ? table[Math.min(index, table.length - 1)] : 0);
  }, 0);
}

/** PSP dépensés par toute l'équipe. */
function pspSpentForTeam(players: unknown): number {
  if (!Array.isArray(players)) return 0;
  return players.reduce(
    (sum: number, p: any) => sum + pspSpentForPlayer(p?.advancements),
    0,
  );
}

/**
 * Résumé du budget tel que renvoyé par `GET /team/:id`. Tous les montants
 * sont en pièces d'or.
 */
interface TeamBudgetSummary {
  readonly initialBudget: number;
  readonly playersCost: number;
  readonly starPlayersCost: number;
  readonly staffCost: number;
  readonly rerollsCost: number;
  readonly dedicatedFansCost: number;
  readonly totalSpent: number;
  readonly remaining: number;
  readonly treasury: number;
  readonly teamValue: number;
  readonly currentValue: number;
}

/** Formatte un montant en po vers l'affichage compact « 1 000K po ». */
function formatKpo(valuePo: number, suffix: string): string {
  return `${Math.round(valuePo / 1000).toLocaleString("fr-FR")}${suffix}`;
}

/**
 * Repli local du résumé budgétaire pour un serveur pré-correctif (le champ
 * `budgetSummary` est optionnel). Approximation volontairement simple :
 * coûts de poste statiques, sans surcoût d'avancement.
 */
function resolveBudgetSummary(team: any): TeamBudgetSummary {
  if (team?.budgetSummary) return team.budgetSummary as TeamBudgetSummary;

  const sc = team?.staffConfig;
  const playersCost = (team?.players ?? []).reduce(
    (total: number, player: any) =>
      total + getPlayerCost(player.position, team?.roster),
    0,
  );
  const starPlayersCost = (team?.starPlayers ?? []).reduce(
    (total: number, sp: any) => total + (sp?.cost ?? 0),
    0,
  );
  const rerollsCost =
    (team?.rerolls || 0) * (sc?.rerollCost ?? getRerollCost(team?.roster || ""));
  const staffCost =
    (team?.cheerleaders || 0) * (sc?.cheerleaderCost ?? 10000) +
    (team?.assistants || 0) * (sc?.assistantCost ?? 10000) +
    (team?.apothecary ? (sc?.apothecaryCost ?? 50000) : 0);
  const dedicatedFansCost =
    Math.max(0, (team?.dedicatedFans || 1) - 1) * (sc?.dedicatedFanCost ?? 5000);
  const initialBudget = (team?.initialBudget || 0) * 1000;
  const totalSpent =
    playersCost + starPlayersCost + staffCost + rerollsCost + dedicatedFansCost;

  return {
    initialBudget,
    playersCost,
    starPlayersCost,
    staffCost,
    rerollsCost,
    dedicatedFansCost,
    totalSpent,
    remaining: initialBudget - totalSpent,
    treasury: team?.treasury ?? 0,
    teamValue: team?.teamValue ?? 0,
    currentValue: team?.currentValue ?? 0,
  };
}

export default function TeamDetailPage() {
  const { t, language } = useLanguage();
  const leagueEnabled = useFeatureFlag(LEAGUE_FLAG);
  const [data, setData] = useState<any>(null);
  const [userName, setUserName] = useState<string>("");
  const [rosterName, setRosterName] = useState<string>("");
  // Détail roster (positions + accès compétences + règles spéciales + ligues),
  // chargé depuis l'API publique pour enrichir la fiche d'équipe.
  const [rosterDetail, setRosterDetail] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const rulesetLabels: Record<string, string> = {
    season_2: t.teams.rulesetSeason2 ?? "Saison 2",
    season_3: t.teams.rulesetSeason3 ?? "Saison 3",
  };
  const id =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").pop()
      : "";

  useEffect(() => {
    // Garde d'annulation : la page se charge parfois 2x (ex: redirection
    // `?welcome=1` post-création + 404 transitoire en read-after-write). Sans
    // cleanup, une exécution périmée qui échoue posait un "Introuvable"
    // persistant alors qu'une autre avait déjà chargé l'équipe.
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const me = await fetchJSON("/auth/me");
        if (cancelled) return;
        if (!me?.user) {
          window.location.href = "/login";
          return;
        }
        setUserName(me.user.name || me.user.username || me.user.email || "");
        // S25.5ae — apiRequest unwrap l'enveloppe ApiResponse<T>
        const d = await apiRequest<{
          team: { roster: string; ruleset?: string };
          currentMatch: unknown;
          localMatchStats: unknown;
        }>(`/team/${id}?lang=${language === "en" ? "en" : "fr"}`);
        if (cancelled) return;
        setData(d);
        setError(null);

        // Charger le nom du roster depuis l'API selon la langue
        if (d?.team?.roster) {
          const lang = language === "en" ? "en" : "fr";
          try {
            const rulesetQuery = d.team.ruleset ? `&ruleset=${encodeURIComponent(d.team.ruleset)}` : "";
            const rosterResponse = await fetch(`${API_BASE}/api/rosters/${d.team.roster}?lang=${lang}${rulesetQuery}`);
            if (cancelled) return;
            if (rosterResponse.ok) {
              const rosterData = await rosterResponse.json();
              if (!cancelled) {
                setRosterName(rosterData.roster?.name || d.team.roster);
                setRosterDetail(rosterData.roster ?? null);
              }
            } else {
              setRosterName(d.team.roster);
              setRosterDetail(null);
            }
          } catch {
            if (!cancelled) {
              setRosterName(d.team.roster);
              setRosterDetail(null);
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || t.teams.error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, t, language]);

  // Renommage inline : mutation locale du state (le titre, l'export PDF et
  // l'uploader de logo lisent tous `data.team.name`).
  const handleTeamRenamed = (name: string) => {
    setData((prev: any) => ({ ...prev, team: { ...prev.team, name } }));
  };

  // E12 — après édition inline du nom/numéro, mutation locale du state.
  const handleIdentitySaved = (
    playerId: string,
    name: string,
    number: number,
  ) => {
    setData((prev: any) => ({
      ...prev,
      team: {
        ...prev.team,
        players: (prev.team?.players ?? []).map((pl: any) =>
          pl.id === playerId ? { ...pl, name, number } : pl,
        ),
      },
    }));
  };

  // Photo du joueur : mutation locale après upload/retrait (l'export de
  // carte lit `p.imageUrl` depuis ce state).
  const handlePlayerImageChanged = (
    playerId: string,
    imageUrl: string | null,
  ) => {
    setData((prev: any) => ({
      ...prev,
      team: {
        ...prev.team,
        players: (prev.team?.players ?? []).map((pl: any) =>
          pl.id === playerId ? { ...pl, imageUrl } : pl,
        ),
      },
    }));
  };

  /**
   * Retire du roster un joueur mort ou licencié. Le serveur refuse encore
   * ce retrait pour un joueur actif d'une équipe engagée : ici on ne
   * l'expose que sur les joueurs inactifs.
   */
  const handleRemoveInactivePlayer = async (player: {
    id: string;
    name?: string;
  }) => {
    if (
      !window.confirm(
        `Retirer ${player.name ?? "ce joueur"} de la feuille d'équipe ? Son historique est conservé.`,
      )
    ) {
      return;
    }
    setRemovingPlayerId(player.id);
    try {
      await apiRequest(`/team/${id}/players/${player.id}`, {
        method: "DELETE",
      });
      await refetchTeam();
    } catch (e: unknown) {
      alert(
        e instanceof Error ? e.message : "Impossible de retirer ce joueur",
      );
    } finally {
      setRemovingPlayerId(null);
    }
  };

  // Règle "Capitaine" : après désignation, recharger la fiche équipe (le
  // capitaine vient de gagner la compétence Pro dans son CSV de skills).
  const refetchTeam = async () => {
    try {
      const d = await apiRequest<{
        team: unknown;
        currentMatch: unknown;
        localMatchStats: unknown;
      }>(`/team/${id}`);
      setData(d);
    } catch {
      // Non-critique : la fiche affichée reste valide, le prochain
      // chargement de page reflétera la désignation.
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      // S25.5r — apiRequest unwrap l'enveloppe ApiResponse<T>
      const result = await apiRequest<{ team: unknown; message: string }>(
        `/team/${id}/recalculate`,
        { method: "POST" },
      );
      // Mettre à jour les données en conservant currentMatch si présent
      setData((prev: any) => ({
        ...prev,
        team: result.team
      }));
      alert(result.message);
    } catch (e: any) {
      alert(`${t.teams.error}: ${e.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const handleExportRoster = async () => {
    if (!team) return;
    try {
      trackUmamiEvent(UMAMI_EVENTS.PDF_EXPORT, { kind: "roster" });
      await exportTeamToPDF(
        team,
        positionResolvers.costPo,
        userName,
        language,
        { positionName: positionResolvers.displayName, rosterName },
      );
      setExportMenuOpen(false);
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert(t.teams.exportPDFError);
    }
  };

  const handleExportSkills = async () => {
    if (!team) return;
    try {
      trackUmamiEvent(UMAMI_EVENTS.PDF_EXPORT, { kind: "skills" });
      await exportSkillsSheet(team, language, {
        positionName: positionResolvers.displayName,
        rosterName,
      });
      setExportMenuOpen(false);
    } catch (error) {
      console.error('Erreur lors de l\'export des compétences:', error);
      alert(t.teams.exportPDFError);
    }
  };

  const handleExportMatch = async () => {
    if (!team) return;
    try {
      trackUmamiEvent(UMAMI_EVENTS.PDF_EXPORT, { kind: "match" });
      await exportMatchSheet(team, undefined, language);
      setExportMenuOpen(false);
    } catch (error) {
      console.error('Erreur lors de l\'export de la feuille de match:', error);
      alert(t.teams.exportPDFError);
    }
  };

  // Carte joueur PNG (change export-player-cards) : le payload est construit
  // ici depuis les données déjà chargées, le rendu satori est délégué à
  // `/api/player-card`. `download` force l'attachment, sinon aperçu en onglet.
  const handleExportPlayerCard = (p: any, download: boolean) => {
    if (!team) return;
    trackUmamiEvent(UMAMI_EVENTS.CARD_EXPORT, { kind: "team", download });
    const cost = positionResolvers.costPo(p.position, team.roster);
    const cardData = buildTeamPlayerCardData(
      {
        name: p.name,
        number: p.number,
        ma: p.ma,
        st: p.st,
        ag: p.ag,
        pa: p.pa ?? null,
        av: p.av,
        skills: p.skills ?? "",
        spp: p.spp,
        matchesPlayed: p.matchesPlayed,
        totalTouchdowns: p.totalTouchdowns,
        totalCasualties: p.totalCasualties,
        dead: !!p.dead,
        firedAt: p.firedAt ?? null,
        // Photo pleine résolution sur la carte (URL relative résolue par
        // le renderer contre sa propre origine ; absolue validée par
        // allowlist dans le décodeur). Sans photo de coach, on retombe sur
        // l'illustration du positionnel plutôt que sur l'emblème.
        imageUrl:
          p.imageUrl ?? positionMetaByPosition.get(p.position)?.imageUrl ?? null,
      },
      {
        lang: language === "en" ? "en" : "fr",
        positionName: positionResolvers.displayName(p.position),
        teamName: team.name,
        rosterSlug: team.roster,
        cost: cost > 0 ? cost : null,
      },
    );
    const url = `/api/player-card?d=${encodeCardPayload(cardData)}${download ? "&download=1" : ""}`;
    const link = document.createElement("a");
    link.href = url;
    if (!download) {
      link.target = "_blank";
      link.rel = "noopener";
    }
    link.click();
  };

  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null);

  const team = data?.team;
  // Libellé du règlement servi par l'API (les règlements sont éditables) ;
  // `?slug=` couvre aussi un règlement désactivé depuis la création.
  const tournamentRulesetLabel = useTournamentRulesetLabel(
    team?.tournamentRuleset ?? null,
  );
  const match = data?.currentMatch;
  const localMatchStats = data?.localMatchStats;
  const canEdit = !match || (match.status !== "pending" && match.status !== "active");

  // A11 — accès compétences (primaire/secondaire) indexés par position, plus
  // règles spéciales d'équipe et ligues régionales, dérivés du détail roster.
  const skillAccessByPosition = useMemo(
    () => buildSkillAccessByPosition(rosterDetail?.positions),
    [rosterDetail],
  );
  // Méta position (compétences de base DB + mots-clés), indexée par slug.
  // Coût d'embauche et libellé de poste : la BASE d'abord
  // (`/api/rosters/:slug`, déjà chargé ci-dessus), le catalogue compilé du
  // moteur en repli. Sans ça, la colonne « Coût », la carte PNG et le PDF
  // affichaient un tarif et des libellés que le serveur n'utilise plus.
  const positionMetaByPosition = useMemo(
    () => buildPositionMetaByPosition(rosterDetail?.positions),
    [rosterDetail],
  );
  const positionResolvers = useMemo(
    () =>
      makePositionResolvers(positionMetaByPosition, {
        cost: getPlayerCost,
        displayName: getDisplayName,
      }),
    [positionMetaByPosition],
  );
  // Règles spéciales EFFECTIVES de l'équipe : le serveur y ajoute
  // l'alignement « Favori de… » apporté par la Ligue régionale retenue
  // (Nordiques + Clash du Chaos ⇒ Favori de Khorne). Repli sur les règles du
  // roster tant qu'un serveur pré-correctif ne renvoie pas le champ
  // (cf. « Backwards-compat sur champs API ajoutes »).
  const specialRules: Array<{
    slug: string;
    name: string;
    description: string;
  }> = Array.isArray(team?.specialRules)
    ? team.specialRules
    : Array.isArray(rosterDetail?.specialRules)
      ? rosterDetail.specialRules
      : [];
  const regionalLeagues: Array<{ slug: string; name: string }> = Array.isArray(
    rosterDetail?.regionalLeagues,
  )
    ? rosterDetail.regionalLeagues
    : [];

  // Résumé du budget : calculé par le serveur (`GET /team/:id`) à partir de
  // la MÊME logique que la VE persistée — coûts de poste au ruleset de
  // l'équipe, surcoûts d'avancement compris. Le recalcul local qui existait
  // ici ignorait les deux et affichait donc un coût joueurs et un budget
  // restant qui ne collaient ni à la VE, ni à la trésorerie.
  // `??` : repli sur un calcul local pour rester lisible face à un serveur
  // pré-correctif (cf. « Backwards-compat sur champs API ajoutes »).
  const budget: TeamBudgetSummary = useMemo(
    () => resolveBudgetSummary(team),
    [team],
  );
  /** Composition affichée : les joueurs encore au roster (cf. module). */
  const rosterPlayers: any[] = useMemo(
    () => rosterPlayersOf((team?.players ?? []) as any[]),
    [team],
  );
  const kpo = (valuePo: number): string => formatKpo(valuePo, t.teams.kpo);

  if (loading) {
    return (
      <div className="w-full p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      {id ? (
        <FirstTeamWelcomeBanner
          teamId={id}
          teamName={team?.name}
          onExportPdf={handleExportRoster}
        />
      ) : null}
      {leagueEnabled && id ? <PendingAdvancementsBanner teamId={id} /> : null}
      {id ? <MatchReportBanner teamId={id} /> : null}
      {/* Logo d'equipe : upload / retrait. Le logo est repris devant le
          nom de l'equipe dans les matchs, le classement et la feuille de
          match ; sans logo, celui de la race sert de repli. */}
      {id && team ? (
        <TeamLogoUploader
          teamId={id}
          roster={team.roster}
          teamName={team.name}
          initialLogoUrl={team.logoUrl ?? null}
          onChange={refetchTeam}
        />
      ) : null}
      {id && team ? (
        <TeamShareToggle
          teamId={id}
          initialIsPublic={Boolean(team.isPublic)}
          initialShareToken={team.shareToken ?? null}
        />
      ) : null}
      {/* Règle spéciale "Capitaine" : rendu interne uniquement si le roster
          possède la règle (fetch autonome du statut). Après désignation, on
          recharge la fiche (le capitaine gagne la compétence Pro). */}
      {id ? (
        <CaptainPanel teamId={id} onDesignated={refetchTeam} />
      ) : null}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold">
            <TeamLogo
              slug={team?.roster}
              logoUrl={team?.logoUrl ?? null}
              size={32}
              title={team?.name}
            />
            {/* Renommage inline : disponible meme quand l'edition du roster
                est verrouillee (equipe engagee) — le nom est cosmetique. */}
            {id && team?.name ? (
              <TeamNameInlineEdit
                teamId={id}
                name={team.name}
                onRenamed={handleTeamRenamed}
              />
            ) : (
              <span>{team?.name || t.teams.team}</span>
            )}
          </h1>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">
            {t.teams.roster}:{" "}
            {team?.roster ? (
              <RosterBadge slug={team.roster} name={rosterName} />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {team?.ruleset && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5">
                {t.teams.rulesetBadge.replace(
                  "{label}",
                  rulesetLabels[team.ruleset] || team.ruleset,
                )}
              </span>
            )}
            <span
              data-testid="team-format-badge"
              className={`inline-flex items-center rounded-full text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 ${
                (team?.format ?? "bb11") === "sevens"
                  ? "bg-purple-50 text-purple-700"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              {(team?.format ?? "bb11") === "sevens"
                ? (t.teams.formatSevens ?? "Blood Bowl à Sept")
                : (t.teams.formatBB11 ?? "Blood Bowl à 11")}
            </span>
            {/* Règlement de tournoi choisi à la création (ex : NAF World
                Cup 2027). Absent = règles standard, pas de badge. */}
            {team?.tournamentRuleset && (
              <span
                data-testid="team-tournament-ruleset-badge"
                className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5"
              >
                🏆{" "}
                {t.teams.tournamentRulesetBadge.replace(
                  "{label}",
                  tournamentRulesetLabel ?? team.tournamentRuleset,
                )}
              </span>
            )}
          </div>
          {/* Fluff du coach. C'est aussi le texte servi dans l'apercu quand
              l'equipe est partagee — il doit donc etre visible ici, sinon on
              ne comprend pas d'ou il sort. Se modifie sur « Modifier
              l'equipe ». */}
          {team?.description ? (
            <p
              data-testid="team-description"
              className="mt-3 max-w-2xl whitespace-pre-line text-sm text-gray-700 leading-relaxed"
            >
              {team.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {canEdit ? (
            <a
              href={`/me/teams/${id}/edit`}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-center"
            >
              {t.teams.modifyTeam}
            </a>
          ) : (
            <div className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-gray-300 text-gray-600 rounded cursor-not-allowed text-center">
              {t.teams.teamInMatch}
            </div>
          )}
          {/* Bouton temporairement caché */}
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="hidden px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {recalculating ? t.teams.recalculating : t.teams.recalculateVE}
          </button>
          <a
            href={`/me/teams/${id}/career`}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-center"
          >
            Stats de carriere
          </a>
          <a
            data-testid="team-treasury-link"
            href={`/me/teams/${id}/treasury`}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-center"
          >
            {t.teams.treasuryTitle ?? "Tresorerie"}
          </a>
          {/* Journal : qui a modifie quoi, et quel a ete le resultat. Le
              premier reflexe quand la tresorerie ou la VE affichee ne colle
              pas a ce que le coach attend. */}
          <a
            data-testid="team-journal-link"
            href={`/me/teams/${id}/journal`}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors text-center"
          >
            Journal
          </a>
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <span className="hidden sm:inline">{t.teams.exportOptions}</span>
              <span className="sm:hidden">📥</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {exportMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10 bg-black/40 sm:bg-transparent"
                  onClick={() => setExportMenuOpen(false)}
                ></div>
                <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 mx-auto max-w-xs z-20 bg-white rounded-lg shadow-lg border border-gray-200 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:translate-y-0 sm:mx-0 sm:mt-2 sm:w-64 sm:max-w-none">
                  <div className="py-1">
                    <button
                      onClick={handleExportRoster}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      {t.teams.exportRosterPDF}
                    </button>
                    <button
                      onClick={handleExportSkills}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      {t.teams.exportSkillsSheet}
                    </button>
                    {/* Bouton d'export de la feuille de match masqué temporairement */}
                    {/* <button
                      onClick={handleExportMatch}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      {t.teams.exportMatchSheet}
                    </button> */}
                  </div>
                </div>
              </>
            )}
          </div>
          <a
            href="/me/teams"
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors border border-gray-500 text-center"
          >
            {t.teams.back}
          </a>
        </div>
      </div>

      {shouldShowTeamLoadError(error, Boolean(team)) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!canEdit && match && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          <div className="font-semibold">{t.teams.teamEngagedInMatch}</div>
          <div className="text-sm mt-1">
            {t.teams.teamEngagedDescription.replace("{status}", match.status)}
          </div>
          <a
            href="/play"
            className="mt-2 inline-block px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            {t.teams.goToMatch}
          </a>
        </div>
      )}

      {team && (
        <>
          {/* Résumé du budget */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
              <h2 className="text-base sm:text-lg font-semibold">{t.teams.budgetSummary}</h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-xs sm:text-sm text-blue-600 font-medium">{t.teams.initialBudget}</div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-900" data-testid="budget-initial">
                    {kpo(budget.initialBudget)}
                  </div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-xs sm:text-sm text-green-600 font-medium">{t.teams.currentCost}</div>
                  <div className="text-xl sm:text-2xl font-bold text-green-900" data-testid="budget-players-cost">
                    {kpo(budget.playersCost + budget.starPlayersCost)}
                  </div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-xs sm:text-sm text-purple-600 font-medium">{t.teams.teamValue}</div>
                  <div className="text-xl sm:text-2xl font-bold text-purple-900" data-testid="budget-team-value">
                    {kpo(budget.teamValue)}
                  </div>
                </div>
                {(() => {
                  // « Budget restant » = trésorerie : c'est elle qui finance les
                  // achats d'après-création (POST /team/:id/purchase), et le
                  // reliquat du budget de construction y est crédité. Le bloc
                  // « Staff de l'équipe » plus bas affiche la même valeur.
                  const positive = budget.treasury >= 0;
                  return (
                    <div className={`text-center p-3 sm:p-4 rounded-lg border ${positive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className={`text-xs sm:text-sm font-medium ${
                    positive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {t.teams.remainingBudget}
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-bold ${positive ? 'text-green-900' : 'text-red-900'}`}
                    data-testid="budget-remaining"
                  >
                    {kpo(budget.treasury)}
                  </div>
                </div>
                  );
                })()}
              </div>
              {/* Bloc PSP de départ (mode « édition avancée » / coupe). Affiché
                  seulement si un pool a été alloué à la construction. */}
              {(team.startingPspPool ?? 0) > 0 &&
                (() => {
                  const pool = team.startingPspPool ?? 0;
                  const spent = pspSpentForTeam(team.players);
                  const available = Math.max(0, pool - spent);
                  return (
                    <div
                      className="mt-3 sm:mt-4 grid grid-cols-3 gap-3 sm:gap-4"
                      data-testid="team-psp-summary"
                    >
                      <div className="text-center p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="text-xs sm:text-sm text-amber-700 font-medium">
                          {t.teams.pspPool ?? "Pool de PSP"}
                        </div>
                        <div
                          className="text-xl sm:text-2xl font-bold text-amber-900"
                          data-testid="team-psp-pool"
                        >
                          {pool}
                        </div>
                      </div>
                      <div className="text-center p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="text-xs sm:text-sm text-amber-700 font-medium">
                          {t.teams.pspSpent ?? "PSP dépensés"}
                        </div>
                        <div
                          className="text-xl sm:text-2xl font-bold text-amber-900"
                          data-testid="team-psp-spent"
                        >
                          {spent}
                        </div>
                      </div>
                      <div className="text-center p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="text-xs sm:text-sm text-amber-700 font-medium">
                          {t.teams.pspAvailable ?? "PSP disponibles"}
                        </div>
                        <div
                          className="text-xl sm:text-2xl font-bold text-amber-900"
                          data-testid="team-psp-available"
                        >
                          {available}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              <div className="mt-3 sm:mt-4 text-xs text-gray-500">
                <p><strong>{t.teams.initialBudget}</strong> : {t.teams.initialBudgetDesc}</p>
                <p><strong>{t.teams.currentCost}</strong> : {t.teams.currentCostDesc}</p>
                <p><strong>{t.teams.teamValue}</strong> : {t.teams.teamValueDesc}</p>
                <p><strong>{t.teams.remainingBudget}</strong> : {t.teams.remainingBudgetDesc}</p>
              </div>
            </div>
          </div>

          {/* Statistiques de l'équipe */}
          {localMatchStats && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
                <h2 className="text-base sm:text-lg font-semibold">
                  {t.teams.teamStatsTitle}
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-xs sm:text-sm text-blue-600 font-medium">
                      {t.teams.teamStatsLocalMatches}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-blue-900">
                      {localMatchStats.total}
                    </div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-xs sm:text-sm text-green-600 font-medium">
                      {t.teams.teamStatsCompleted}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-green-900">
                      {localMatchStats.completed}
                    </div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-xs sm:text-sm text-purple-600 font-medium">
                      {t.teams.teamStatsRecord}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-purple-900 font-mono">
                      {localMatchStats.wins} / {localMatchStats.draws} / {localMatchStats.losses}
                    </div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-xs sm:text-sm text-orange-600 font-medium">
                      {t.teams.teamStatsTouchdowns}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-orange-900 font-mono">
                      {localMatchStats.touchdownsFor} / {localMatchStats.touchdownsAgainst}{" "}
                      <span className="text-sm">
                        ({localMatchStats.touchdownDiff >= 0 ? "+" : ""}
                        {localMatchStats.touchdownDiff})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
              <h2 className="text-base sm:text-lg font-semibold">{t.teams.teamComposition}</h2>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">
                {rosterPlayers.length} {t.teams.players}
                {(team.starPlayers?.length ?? 0) > 0 && (
                  <span data-testid="team-composition-star-count">
                    {" "}
                    + {team.starPlayers.length} ⭐ Star Player
                    {team.starPlayers.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-2 hidden sm:block">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 border border-gray-300 bg-blue-100 rounded"></span>
                  {t.teams.baseSkillsLegend}
                </span>
                <span className="ml-4 inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-orange-400 bg-blue-100 rounded"></span>
                  {t.teams.acquiredSkillsLegend}
                </span>
                <div className="mt-1 text-xs text-gray-400">
                  {t.teams.skillColorsLegend}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              {/* Version desktop : tableau */}
              <table className="min-w-full hidden md:table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">{t.teams.tableNumber}</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">{t.teams.tableName}</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">{t.teams.tablePosition}</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">{t.teams.tableCost}</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">MA</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">ST</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">AG</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">PA</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">AV</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">{t.teams.tableSkills}</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[...rosterPlayers].sort((a: any, b: any) => a.number - b.number).map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-3 sm:p-4 font-mono text-base sm:text-lg font-semibold">{p.number}</td>
                      <td className="p-3 sm:p-4 font-medium text-sm sm:text-base">
                        <span className="inline-flex items-center gap-1.5">
                          {/* Photo du joueur (clic = upload, défaut initiales). */}
                          <PlayerImageUploader
                            teamId={String(id)}
                            player={p}
                            size={32}
                            onChange={handlePlayerImageChanged}
                          />
                          <PlayerIdentityInlineEdit
                            teamId={String(id)}
                            player={p}
                            onSaved={handleIdentitySaved}
                          />
                          {p.isCaptain && !p.dead && !p.firedAt ? (
                            <span
                              data-testid={`captain-badge-${p.number}`}
                              title="Capitaine d'équipe"
                              className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5"
                            >
                              C
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4 text-gray-600 text-xs sm:text-sm">
                        <div>{positionResolvers.displayName(p.position)}</div>
                        <KeywordChips
                          keywords={
                            language === "fr"
                              ? positionMetaByPosition.get(p.position)?.keywords
                              : positionMetaByPosition.get(p.position)?.keywordsEn
                          }
                          className="mt-1"
                        />
                      </td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">
                        {Math.round(positionResolvers.costPo(p.position, team.roster) / 1000)}{t.teams.kpo}
                      </td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">{p.ma}</td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">{p.st}</td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">{formatPlusStat(p.ag)}</td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">{formatPlusStat(p.pa)}</td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">{formatPlusStat(p.av)}</td>
                      <td className="p-3 sm:p-4">
                        <SkillTooltip
                          ruleset={team?.ruleset}
                          skillsString={p.skills}
                          teamName={team.roster}
                          position={p.position}
                          dbBaseSkills={positionMetaByPosition.get(p.position)?.baseSkills}
                        />
                        <SkillAccessBadges
                          primary={skillAccessByPosition.get(p.position)?.primary ?? null}
                          secondary={skillAccessByPosition.get(p.position)?.secondary ?? null}
                        />
                      </td>
                      <td className="p-3 sm:p-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid={`player-card-${p.id}`}
                            onClick={() => handleExportPlayerCard(p, false)}
                            title="Voir la carte du joueur (PNG façon carte officielle)"
                            className="whitespace-nowrap rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                          >
                            🃏 Carte
                          </button>
                          <button
                            type="button"
                            data-testid={`player-card-download-${p.id}`}
                            onClick={() => handleExportPlayerCard(p, true)}
                            title="Télécharger la carte PNG"
                            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                          >
                            ⬇️
                          </button>
                          {p.dead || p.firedAt ? (
                            <button
                              type="button"
                              data-testid={`remove-player-${p.id}`}
                              disabled={removingPlayerId === p.id}
                              onClick={() => void handleRemoveInactivePlayer(p)}
                              title={
                                p.dead
                                  ? "Retirer ce joueur mort de la feuille d'équipe"
                                  : "Retirer ce joueur licencié de la feuille d'équipe"
                              }
                              className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {removingPlayerId === p.id ? "…" : "Retirer"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Version mobile : cartes */}
              <div className="md:hidden space-y-3 p-4">
                {[...rosterPlayers].sort((a: any, b: any) => a.number - b.number).map((p: any) => (
                  <div key={p.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <PlayerImageUploader
                          teamId={String(id)}
                          player={p}
                          size={40}
                          onChange={handlePlayerImageChanged}
                        />
                        <span className="font-mono text-xl font-bold text-gray-900">{p.number}</span>
                        <div>
                          <div className="font-semibold text-base inline-flex items-center gap-1.5">
                            <PlayerIdentityInlineEdit
                              teamId={String(id)}
                              player={p}
                              onSaved={handleIdentitySaved}
                            />
                            {p.isCaptain && !p.dead && !p.firedAt ? (
                              <span
                                title="Capitaine d'équipe"
                                className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5"
                              >
                                C
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-gray-600">{positionResolvers.displayName(p.position)}</div>
                          <KeywordChips
                            keywords={
                              language === "fr"
                                ? positionMetaByPosition.get(p.position)?.keywords
                                : positionMetaByPosition.get(p.position)?.keywordsEn
                            }
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">{t.teams.tableCost}</div>
                        <div className="font-mono text-sm font-semibold">
                          {Math.round(positionResolvers.costPo(p.position, team.roster) / 1000)}{t.teams.kpo}
                        </div>
                        {p.dead || p.firedAt ? (
                          <button
                            type="button"
                            data-testid={`remove-player-mobile-${p.id}`}
                            disabled={removingPlayerId === p.id}
                            onClick={() => void handleRemoveInactivePlayer(p)}
                            className="mt-2 rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {removingPlayerId === p.id ? "…" : "Retirer"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2 mb-3 text-xs">
                      <div className="text-center">
                        <div className="text-gray-500">MA</div>
                        <div className="font-mono font-semibold">{p.ma}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">ST</div>
                        <div className="font-mono font-semibold">{p.st}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">AG</div>
                        <div className="font-mono font-semibold">{formatPlusStat(p.ag)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">PA</div>
                        <div className="font-mono font-semibold">{formatPlusStat(p.pa)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">AV</div>
                        <div className="font-mono font-semibold">{formatPlusStat(p.av)}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">{t.teams.tableSkills}</div>
                      <SkillTooltip
                        ruleset={team?.ruleset}
                        skillsString={p.skills}
                        teamName={team.roster}
                        position={p.position}
                        dbBaseSkills={positionMetaByPosition.get(p.position)?.baseSkills}
                      />
                      <SkillAccessBadges
                        primary={skillAccessByPosition.get(p.position)?.primary ?? null}
                        secondary={skillAccessByPosition.get(p.position)?.secondary ?? null}
                      />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        data-testid={`player-card-mobile-${p.id}`}
                        onClick={() => handleExportPlayerCard(p, false)}
                        className="rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        🃏 Voir la carte
                      </button>
                      <button
                        type="button"
                        data-testid={`player-card-download-mobile-${p.id}`}
                        onClick={() => handleExportPlayerCard(p, true)}
                        className="rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        ⬇️ PNG
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Star Players recrutés — ils ne sont pas des `TeamPlayer`, donc
              absents du tableau de composition ci-dessus. */}
          <StarPlayersPanel starPlayers={team.starPlayers ?? []} />

          {/* A11 — Ligues régionales ("type de ligue") du roster */}
          {regionalLeagues.length > 0 && (
            <div
              data-testid="roster-leagues"
              className="bg-white rounded-lg border overflow-hidden"
            >
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
                <h2 className="text-base sm:text-lg font-semibold">
                  {t.teams.leagues}
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                {/* La Ligue CHOISIE à la création est celle qui compte : elle
                    seule débloque Star Players et Coups de Pouce. Les autres
                    Ligues du roster restent affichées, mais grisées. */}
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {regionalLeagues.map((league) => {
                    const chosen = team.regionalLeague === league.slug;
                    // Sans choix enregistré (équipe antérieure à la règle),
                    // toutes les Ligues du roster restent actives.
                    const active = !team.regionalLeague || chosen;
                    return (
                      <span
                        key={league.slug}
                        data-testid={`roster-league-${league.slug}`}
                        aria-current={chosen ? "true" : undefined}
                        className={`px-3 sm:px-4 py-1.5 rounded-full font-medium text-xs sm:text-sm border ${
                          active
                            ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                            : "bg-gray-50 text-gray-400 border-gray-200 line-through"
                        }`}
                      >
                        {league.name}
                      </span>
                    );
                  })}
                </div>
                {team.regionalLeague && (
                  <p
                    className="mt-3 text-xs text-gray-600"
                    data-testid="team-regional-league"
                  >
                    {t.teams.regionalLeague ?? "Ligue régionale"} :{" "}
                    <strong>
                      {regionalLeagues.find(
                        (l) => l.slug === team.regionalLeague,
                      )?.name ?? team.regionalLeague}
                    </strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* A11 — Règles spéciales d'équipe (certaines modifient les PSP) */}
          <div
            data-testid="roster-special-rules"
            className="bg-white rounded-lg border overflow-hidden"
          >
            <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
              <h2 className="text-base sm:text-lg font-semibold">
                {t.teams.specialRules}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {t.teams.specialRulesSppNote ??
                  "Certaines règles spéciales modifient les PSP gagnés en match."}
              </p>
            </div>
            <div className="p-4 sm:p-6 space-y-2">
              {specialRules.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {language === "fr" ? "Aucune" : "None"}
                </p>
              ) : (
                specialRules.map((rule) => (
                  <details
                    key={rule.slug}
                    data-testid={`special-rule-${rule.slug}`}
                    className="group rounded-lg border border-gray-200 bg-gray-50/60 open:bg-white"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 sm:px-4 py-2.5 font-medium text-sm sm:text-base text-gray-900">
                      <span>{rule.name}</span>
                      <span className="text-gray-400 transition-transform group-open:rotate-180">
                        ▾
                      </span>
                    </summary>
                    <p className="px-3 sm:px-4 pb-3 pt-1 text-xs sm:text-sm text-gray-600 leading-relaxed">
                      {rule.description}
                    </p>
                  </details>
                ))
              )}
            </div>
          </div>

          {match && (
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-base sm:text-lg">{t.teams.matchInProgress}</div>
                  <div className="text-xs sm:text-sm text-gray-600 mt-1">
                    {t.teams.matchID}: {match.id} • {t.teams.status}: {match.status} •{" "}
                    {new Date(match.createdAt).toLocaleString()}
                  </div>
                </div>
                <a
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-center text-sm sm:text-base"
                  href="/play"
                >
                  {t.teams.goToPlay}
                </a>
              </div>
            </div>
          )}

          {/* Informations d'équipe */}
        <TeamInfoDisplay
          info={{
            treasury: team.treasury || 0,
            rerolls: team.rerolls || 0,
            cheerleaders: team.cheerleaders || 0,
            assistants: team.assistants || 0,
            apothecary: team.apothecary || false,
            dedicatedFans: team.dedicatedFans || 1,
            teamValue: team.teamValue || 0,
            currentValue: team.currentValue || 0,
            roster: team.roster,
            staffConfig: team.staffConfig,
            playersCost: budget.playersCost,
            starPlayersCost: budget.starPlayersCost,
          }}
        />
        </>
      )}
    </div>
  );
}
