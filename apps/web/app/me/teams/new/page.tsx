"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_BASE } from "../../../auth-client";
import { apiRequest } from "../../../lib/api-client";
import StarPlayerSelector from "../../../components/StarPlayerSelector";
import SkillTooltip from "../components/SkillTooltip";
import SkillAccessBadges from "../components/SkillAccessBadges";
import SpecialRulesBadges from "../../../components/SpecialRulesBadges";
import KeywordChips from "../../../components/KeywordChips";
import QuantityStepper from "../components/QuantityStepper";
import { formatStatByLabel } from "../../../lib/format-stats";
import { useLanguage } from "../../../contexts/LanguageContext";
import {
  DEFAULT_RULESET,
  RULESETS,
  type Ruleset,
  FORMATS,
  DEFAULT_FORMAT,
  type GameFormat,
  getFormatConstraints,
  isLineman,
  isBigGuy,
  bigGuyLimitForRoster,
  countNonLinemen,
  validateFormatSelection,
  defaultStaffConfig,
  type RosterStaffConfig,
} from "@bb/game-engine";

type Position = {
  slug: string;
  displayName: string;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null; // null = pas de passe ("-")
  av: number;
  skills: string;
  // Mots-clés (lignée/type du joueur). CSV ; optionnels (serveur pré-feature).
  keywords?: string | null;
  keywordsEn?: string | null;
  // Accès aux compétences (montée de niveau, BB S3). CSV "G,A,S,P,M" ou null
  // (ex: season_2). Optionnels pour rétro-compat avec un serveur pré-E5.
  primarySkills?: string | null;
  secondarySkills?: string | null;
};

type RosterSpecialRule = {
  slug: string;
  name: string;
  description: string;
};

type Roster = {
  slug: string;
  name: string;
  /** Config staff par format (DB ; défaut dérivé sinon). Coûts en po. */
  staffConfigs?: Record<GameFormat, RosterStaffConfig>;
};

export default function NewTeamBuilder() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [ruleset, setRuleset] = useState<Ruleset>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const value = urlParams.get("ruleset") as Ruleset | null;
      if (value && RULESETS.includes(value)) {
        return value;
      }
    }
    return DEFAULT_RULESET;
  });
  const [format, setFormat] = useState<GameFormat>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const value = urlParams.get("format") as GameFormat | null;
      if (value && FORMATS.includes(value)) {
        return value;
      }
    }
    return DEFAULT_FORMAT;
  });
  const [rosterId, setRosterId] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("roster") || "skaven";
    }
    return "skaven";
  });

  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("name") || "";
    }
    return "";
  });

  const [teamValue, setTeamValue] = useState(() => {
    const defaultBudget = getFormatConstraints(format).startingBudget;
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const value = urlParams.get("teamValue");
      return value ? parseInt(value) : defaultBudget;
    }
    return defaultBudget;
  });

  const [positions, setPositions] = useState<Position[]>([]);
  const [specialRules, setSpecialRules] = useState<RosterSpecialRule[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedStarPlayers, setSelectedStarPlayers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loadingRosters, setLoadingRosters] = useState(true);

  const [rerolls, setRerolls] = useState(0);
  const [cheerleaders, setCheerleaders] = useState(0);
  const [assistants, setAssistants] = useState(0);
  const [apothecary, setApothecary] = useState(false);
  const [dedicatedFans, setDedicatedFans] = useState(1);

  // Contraintes du format (BB11 / Sevens) — pilote budget, nombre de joueurs,
  // non-Linemen, Big Guys, Star Players (source @bb/game-engine).
  const constraints = useMemo(() => getFormatConstraints(format), [format]);

  // Config staff (coûts po + plafonds + apothicaire) du roster × format, issue
  // de la base (admin). Fallback sur le défaut dérivé tant que la liste n'est
  // pas chargée ou pour un roster sans ligne.
  const staff = useMemo<RosterStaffConfig>(() => {
    const fromApi = rosters.find((r) => r.slug === rosterId)?.staffConfigs?.[
      format
    ];
    return fromApi ?? defaultStaffConfig(rosterId, format);
  }, [rosters, rosterId, format]);

  // Apothicaire disponible selon la config (par roster × format).
  const apothecaryAvailable = staff.apothecaryAllowed;

  // Réaligne le toggle quand le roster/format sélectionné interdit l'apothicaire.
  useEffect(() => {
    if (!staff.apothecaryAllowed) setApothecary(false);
  }, [staff.apothecaryAllowed]);

  // Au changement de format (hors montage initial), réaligne le budget par
  // défaut et clampe le staff / star players sur les plafonds du nouveau format.
  const formatMountRef = useRef(true);
  useEffect(() => {
    if (formatMountRef.current) {
      formatMountRef.current = false;
      return;
    }
    setTeamValue(constraints.startingBudget);
    setRerolls((v) => Math.min(v, staff.maxRerolls));
    setCheerleaders((v) => Math.min(v, staff.maxCheerleaders));
    setAssistants((v) => Math.min(v, staff.maxAssistants));
    setDedicatedFans((v) => Math.min(v, staff.maxDedicatedFans));
    if (!staff.apothecaryAllowed) setApothecary(false);
    if (!constraints.starPlayersAllowed) setSelectedStarPlayers([]);
  }, [format, constraints, staff]);

  useEffect(() => {
    const lang = language === "en" ? "en" : "fr";
    const API_BASE_PUBLIC =
      process.env.NEXT_PUBLIC_API_BASE ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8201";

    fetch(`${API_BASE_PUBLIC}/api/rosters?lang=${lang}&ruleset=${ruleset}`)
      .then((r) => r.json())
      .then((data) => {
        const rostersList = (data.rosters || []).map(
          (r: {
            slug: string;
            name: string;
            staffConfigs?: Record<GameFormat, RosterStaffConfig>;
          }) => ({
            slug: r.slug,
            name: r.name,
            staffConfigs: r.staffConfigs,
          }),
        );
        setRosters(rostersList);
        setLoadingRosters(false);

        if (rostersList.length > 0) {
          setRosterId((currentRosterId) => {
            const currentRoster = rostersList.find(
              (r: Roster) => r.slug === currentRosterId,
            );
            return currentRoster ? currentRosterId : rostersList[0].slug;
          });
        }
      })
      .catch((err) => {
        console.error("Erreur lors du chargement des rosters:", err);
        setLoadingRosters(false);
      });
  }, [language, ruleset]);

  useEffect(() => {
    const query = ruleset ? `?ruleset=${encodeURIComponent(ruleset)}` : "";
    apiRequest<{
      roster: { positions?: Position[]; specialRules?: RosterSpecialRule[] };
      ruleset: string;
    }>(`/team/rosters/${rosterId}${query}`)
      .then((d) => {
        setPositions(d.roster.positions || []);
        setSpecialRules(d.roster.specialRules || []);
        const init: Record<string, number> = {};
        (d.roster.positions || []).forEach((p: Position) => {
          init[p.slug] = p.min || 0;
        });
        setCounts(init);
      })
      .catch(() => setError(t.teams.errorLoadingRoster));
  }, [rosterId, ruleset, t]);

  const total = useMemo(
    () =>
      Object.entries(counts).reduce(
        (acc, [k, c]) =>
          acc + (positions.find((p) => p.slug === k)?.cost || 0) * (c || 0),
        0,
      ),
    [counts, positions],
  );
  const totalPlayers = useMemo(
    () => Object.values(counts).reduce((a, b) => a + (b || 0), 0),
    [counts],
  );

  const totalPlayersWithStars = useMemo(
    () => totalPlayers + selectedStarPlayers.length,
    [totalPlayers, selectedStarPlayers],
  );

  // Coûts staff en kpo (la config DB est en po). Le coût de relance inclut
  // déjà le multiplicateur de format (Sevens ×2) côté config.
  const rerollUnitCost = useMemo(
    () => staff.rerollCost / 1000,
    [staff],
  );
  const staffCost = useMemo(
    () =>
      rerolls * rerollUnitCost +
      cheerleaders * (staff.cheerleaderCost / 1000) +
      assistants * (staff.assistantCost / 1000) +
      (apothecary ? staff.apothecaryCost / 1000 : 0) +
      Math.max(0, dedicatedFans - 1) * (staff.dedicatedFanCost / 1000),
    [rerolls, rerollUnitCost, cheerleaders, assistants, apothecary, dedicatedFans, staff],
  );
  const remainingBudget = teamValue - total - staffCost;

  // Le moteur (pur) attend pa: number avec sentinel 0 = "pas de passe".
  // La DB sert null pour "-" ; on recoalesce à la frontière moteur.
  const enginePositions = useMemo(
    () => positions.map((p) => ({ ...p, pa: p.pa ?? 0 })),
    [positions],
  );

  // Joueurs non-Linemen sélectionnés (postes spécialisés + Gros Bras) et
  // plafond éventuel du format (Sevens = 4).
  const nonLinemenCount = useMemo(
    () => countNonLinemen(enginePositions, counts),
    [enginePositions, counts],
  );
  const nonLinemenFull =
    constraints.maxNonLinemen !== null &&
    nonLinemenCount >= constraints.maxNonLinemen;

  // A36 — Plafond COMBINÉ de Gros Bras (tous types confondus) pour le roster
  // courant. `null` = pas de plafond combiné (s'appuie sur les max par poste).
  const bigGuyLimit = useMemo(
    () => bigGuyLimitForRoster(rosterId),
    [rosterId],
  );
  const bigGuyCount = useMemo(
    () =>
      positions.reduce(
        (sum, p) => (isBigGuy(p) ? sum + (counts[p.slug] || 0) : sum),
        0,
      ),
    [positions, counts],
  );
  const bigGuyFull = bigGuyLimit !== null && bigGuyCount >= bigGuyLimit;

  // Validation des contraintes de format (hors budget) — réutilise la logique
  // serveur pour une cohérence parfaite entre UI et API.
  const formatValidation = useMemo(
    () =>
      validateFormatSelection({
        format,
        positions: enginePositions,
        counts,
        starPlayerCount: selectedStarPlayers.length,
        rerolls,
        cheerleaders,
        assistants,
        apothecary,
        dedicatedFans,
        // Plafonds + autorisation apothicaire par roster (config DB).
        staffConfig: staff,
      }),
    [format, enginePositions, counts, selectedStarPlayers, rerolls, cheerleaders, assistants, apothecary, dedicatedFans, staff],
  );

  const rulesetLabels: Record<Ruleset, string> = {
    season_2: t.teams.rulesetSeason2 ?? "Saison 2",
    season_3: t.teams.rulesetSeason3 ?? "Saison 3",
  };

  function change(slug: string, delta: number) {
    setCounts((prev) => {
      const pos = positions.find((p) => p.slug === slug);
      const currentCount = prev[slug] || 0;
      const next = Math.max(
        pos?.min ?? 0,
        Math.min(pos?.max ?? 16, currentCount + delta),
      );
      return { ...prev, [slug]: next };
    });
  }

  async function submit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      // S25.5ad — apiRequest unwrap l'enveloppe ApiResponse<T>
      const json = await apiRequest<{
        team: { id: string };
        cost: number;
        budget: number;
        breakdown: { players: number; starPlayers: number; staff: number };
      }>(`/team/build`, {
        method: "POST",
        body: JSON.stringify({
          name,
          roster: rosterId,
          teamValue,
          ruleset,
          format,
          choices: Object.entries(counts).map(([slug, count]) => ({
            key: slug,
            count,
          })),
          starPlayers: selectedStarPlayers,
          rerolls,
          cheerleaders,
          assistants,
          apothecary,
          dedicatedFans,
        }),
      });
      toast.success(t.teams.teamCreatedToast);
      router.push(`/me/teams/${json.team.id}`);
    } catch (e: any) {
      const message = e?.message || t.teams.error;
      setError(message);
      toast.error(message);
      submittingRef.current = false;
      setSaving(false);
    }
  }

  const isTeamValid = formatValidation.valid && remainingBudget >= 0;

  const incLabel = (label: string) =>
    t.teams.increaseLabel.replace("{label}", label);
  const decLabel = (label: string) =>
    t.teams.decreaseLabel.replace("{label}", label);

  return (
    <div className="w-full pb-32 md:pb-8">
      {/* Sticky summary bar — visible across scroll on all breakpoints */}
      <div
        className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm"
        role="region"
        aria-label={t.teams.summaryTitle}
      >
        <div className="px-4 py-3 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 md:gap-6 min-w-0 flex-1 overflow-x-auto">
              <SummaryMetric
                label={t.teams.budgetShort}
                value={`${remainingBudget}${t.teams.kpo}`}
                tone={remainingBudget < 0 ? "danger" : "success"}
                testId="remaining-budget"
              />
              <SummaryMetric
                label={t.teams.playersShort}
                value={`${totalPlayersWithStars}/${constraints.maxPlayers}`}
                tone={
                  totalPlayersWithStars < constraints.minPlayers ||
                  totalPlayersWithStars > constraints.maxPlayers
                    ? "danger"
                    : "success"
                }
              />
              <SummaryMetric
                label={t.teams.staffCost}
                value={`${staffCost}${t.teams.kpo}`}
                tone="neutral"
                testId="staff-cost-summary"
                className="hidden sm:flex"
              />
              <SummaryMetric
                label={t.teams.playersCost}
                value={`${total}${t.teams.kpo}`}
                tone="neutral"
                className="hidden md:flex"
              />
            </div>
            <button
              data-testid="create-team-submit"
              className="shrink-0 min-h-[44px] px-4 md:px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm md:text-base disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-emerald-700 active:bg-emerald-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 inline-flex items-center justify-center gap-2"
              onClick={submit}
              disabled={!isTeamValid || saving}
              aria-busy={saving}
            >
              {saving && (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
                />
              )}
              {saving ? t.teams.creatingTeamButton : t.teams.createTeamButton}
            </button>
          </div>

          {/* Validity hint line (compact on mobile) */}
          <div className="mt-2 text-xs md:text-sm" aria-live="polite">
            {remainingBudget < 0 && (
              <span className="text-red-600" data-testid="hint-budget">
                ⚠️ {t.teams.budgetExceeded.replace("{amount}", String(-remainingBudget))}
              </span>
            )}
            {remainingBudget >= 0 && !formatValidation.valid && (
              <span className="text-red-600" data-testid="hint-format">
                ⚠️ {formatValidation.error}
              </span>
            )}
            {isTeamValid && (
              <span className="text-emerald-700">
                ✅{" "}
                {t.teams.validTeam
                  .replace("{players}", totalPlayers.toString())
                  .replace("{stars}", selectedStarPlayers.length.toString())}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-4 md:py-6 space-y-5 md:space-y-6 max-w-6xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          {t.teams.createTeamTitle}
        </h1>

        {error && (
          <p
            data-testid="team-builder-error"
            className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Team basics */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-4">
          <div>
            <label
              htmlFor="team-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t.teams.teamName}
            </label>
            <input
              id="team-name"
              data-testid="team-name-input"
              className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder={t.teams.teamNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="format"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t.teams.formatLabel ?? "Format"}
              </label>
              <select
                id="format"
                data-testid="format-select"
                className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                value={format}
                onChange={(e) => setFormat(e.target.value as GameFormat)}
              >
                {FORMATS.map((value) => (
                  <option key={value} value={value}>
                    {value === "sevens"
                      ? (t.teams.formatSevens ?? "Blood Bowl à Sept")
                      : (t.teams.formatBB11 ?? "Blood Bowl à 11")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ruleset"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t.teams.rulesetLabel}
              </label>
              <select
                id="ruleset"
                data-testid="ruleset-select"
                className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                value={ruleset}
                onChange={(e) => setRuleset(e.target.value as Ruleset)}
              >
                {RULESETS.map((value) => (
                  <option key={value} value={value}>
                    {rulesetLabels[value]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="roster"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t.teams.roster}
              </label>
              <select
                id="roster"
                data-testid="roster-select"
                className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                value={rosterId}
                onChange={(e) => setRosterId(e.target.value)}
                disabled={loadingRosters}
              >
                {loadingRosters ? (
                  <option value="">{t.common.loading}</option>
                ) : (
                  rosters.map((roster) => (
                    <option key={roster.slug} value={roster.slug}>
                      {roster.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.teams.teamValue}
              </label>
              <div className="flex items-center justify-between gap-2">
                <QuantityStepper
                  value={teamValue}
                  min={100}
                  max={2000}
                  step={50}
                  onChange={setTeamValue}
                  label={t.teams.teamValue}
                  decrementAriaLabel={decLabel(t.teams.teamValue)}
                  incrementAriaLabel={incLabel(t.teams.teamValue)}
                  size="md"
                />
                <span className="text-base font-semibold text-gray-900 tabular-nums">
                  {teamValue}
                  {t.teams.kpo}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3" data-testid="builder-special-rules">
            <div className="text-sm font-medium text-gray-700 mb-1">
              {t.teams.specialRules ?? "Règles spéciales"}
            </div>
            <SpecialRulesBadges rules={specialRules} />
          </div>

          <p
            className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2"
            data-testid="format-constraints-hint"
          >
            {format === "sevens"
              ? `Blood Bowl à Sept — ${constraints.startingBudget}${t.teams.kpo} · ${constraints.minPlayers}–${constraints.maxPlayers} joueurs · max ${constraints.maxNonLinemen} non-Linemen · relances ×${constraints.rerollCostMultiplier} · sans Star Players`
              : `Blood Bowl à 11 — ${constraints.startingBudget}${t.teams.kpo} · ${constraints.minPlayers}–${constraints.maxPlayers} joueurs`}
          </p>
        </div>

        {/* Position picker: table on desktop, cards on mobile */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-lg font-semibold text-gray-900">
              {t.teams.availablePositions}
            </h2>
            {/* A36 — compteur de Gros Bras (uniquement si l'équipe a un
                plafond combiné). */}
            {bigGuyLimit !== null && (
              <span
                data-testid="big-guy-counter"
                className={`shrink-0 text-sm font-semibold tabular-nums rounded-full px-3 py-1 border ${
                  bigGuyFull
                    ? "bg-amber-50 border-amber-300 text-amber-700"
                    : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                Gros Bras : {bigGuyCount}/{bigGuyLimit}
              </span>
            )}
          </div>

          {bigGuyLimit !== null && bigGuyFull && (
            <p
              data-testid="big-guy-limit-reached"
              className="px-1 text-xs text-amber-700"
              role="status"
            >
              ⚠️ Cette équipe ne peut aligner que {bigGuyLimit} Gros Bras maximum.
            </p>
          )}

          {/* Mobile cards */}
          <ul className="md:hidden space-y-2" role="list">
            {positions.map((p) => {
              const count = counts[p.slug] || 0;
              const cannotAfford = total + staffCost + p.cost > teamValue;
              const atMax = count >= (p.max || 16);
              return (
                <li
                  key={p.slug}
                  className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 text-base truncate">
                          {p.displayName}
                        </h3>
                        <span className="shrink-0 text-sm font-semibold text-emerald-700 tabular-nums">
                          {p.cost}
                          {t.teams.kpo}
                        </span>
                      </div>
                      <KeywordChips
                        keywords={language === "fr" ? p.keywords : p.keywordsEn}
                        className="mt-1"
                      />
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                        <Stat label="MA" value={p.ma} />
                        <Stat label="ST" value={p.st} />
                        <Stat label="AG" value={p.ag} />
                        <Stat label="PA" value={p.pa} />
                        <Stat label="AV" value={p.av} />
                        <span className="text-gray-500">
                          {p.min}–{p.max}
                        </span>
                      </div>
                      {p.skills && (
                        <div className="mt-2">
                          <SkillTooltip
                            skillsString={p.skills}
                            position={p.slug}
                            className="text-xs"
                          />
                        </div>
                      )}
                      <SkillAccessBadges
                        primary={p.primarySkills}
                        secondary={p.secondarySkills}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {t.teams.quantity}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        data-testid={`position-remove-${p.slug}`}
                        type="button"
                        aria-label={`${t.teams.removePlayer} ${p.displayName}`}
                        onClick={() => change(p.slug, -1)}
                        disabled={count <= (p.min || 0)}
                        className="h-11 w-11 rounded-lg border border-gray-300 bg-white font-semibold text-lg text-gray-700 active:bg-gray-200 hover:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        −
                      </button>
                      <span
                        className="min-w-[2.5rem] text-center font-semibold text-lg tabular-nums"
                        aria-live="polite"
                      >
                        {count}
                      </span>
                      <button
                        data-testid={`position-add-${p.slug}`}
                        type="button"
                        aria-label={`${t.teams.addPlayer} ${p.displayName}`}
                        onClick={() => change(p.slug, 1)}
                        disabled={atMax || cannotAfford || (nonLinemenFull && !isLineman(p)) || (bigGuyFull && isBigGuy(p))}
                        className="h-11 w-11 rounded-lg border border-emerald-600 bg-emerald-600 font-semibold text-lg text-white active:bg-emerald-800 hover:bg-emerald-700 disabled:bg-gray-200 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700">
                    {t.teams.position}
                  </th>
                  <th className="text-left p-3 font-medium text-gray-700">
                    {t.teams.cost}
                  </th>
                  <th className="text-left p-3 font-medium text-gray-700">
                    {t.teams.min}
                  </th>
                  <th className="text-left p-3 font-medium text-gray-700">
                    {t.teams.max}
                  </th>
                  <th className="text-left p-3 font-medium text-gray-700">
                    {t.teams.skills}
                  </th>
                  <th className="text-left p-3 font-medium text-gray-700">
                    {t.teams.quantity}
                  </th>
                  <th className="text-left p-3 font-medium text-gray-700">
                    {t.teams.actions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const count = counts[p.slug] || 0;
                  const cannotAfford = total + staffCost + p.cost > teamValue;
                  const atMax = count >= (p.max || 16);
                  return (
                    <tr
                      key={p.slug}
                      className="odd:bg-white even:bg-gray-50 border-t border-gray-100"
                    >
                      <td className="p-3 font-medium">
                        <div>{p.displayName}</div>
                        <KeywordChips
                          keywords={language === "fr" ? p.keywords : p.keywordsEn}
                          className="mt-1"
                        />
                      </td>
                      <td className="p-3 tabular-nums">
                        {p.cost}
                        {t.teams.kpo}
                      </td>
                      <td className="p-3 tabular-nums">{p.min}</td>
                      <td className="p-3 tabular-nums">{p.max}</td>
                      <td className="p-3">
                        <SkillTooltip
                          skillsString={p.skills}
                          position={p.slug}
                          className="text-xs"
                        />
                        <SkillAccessBadges
                          primary={p.primarySkills}
                          secondary={p.secondarySkills}
                        />
                      </td>
                      <td className="p-3 font-semibold tabular-nums">{count}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            data-testid={`position-remove-${p.slug}`}
                            type="button"
                            aria-label={`${t.teams.removePlayer} ${p.displayName}`}
                            className="h-9 w-9 rounded-lg border border-gray-300 bg-white font-semibold text-gray-700 hover:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            onClick={() => change(p.slug, -1)}
                            disabled={count <= (p.min || 0)}
                          >
                            −
                          </button>
                          <button
                            data-testid={`position-add-${p.slug}`}
                            type="button"
                            aria-label={`${t.teams.addPlayer} ${p.displayName}`}
                            className="h-9 w-9 rounded-lg border border-emerald-600 bg-emerald-600 font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-200 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                            onClick={() => change(p.slug, 1)}
                            disabled={atMax || cannotAfford || (nonLinemenFull && !isLineman(p)) || (bigGuyFull && isBigGuy(p))}
                          >
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Staff section */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {t.teams.teamInfo ?? "Staff"}
            </h2>
            <span
              className="text-sm text-gray-600 tabular-nums"
              data-testid="staff-cost"
            >
              {t.teams.staffCost} : {staffCost}
              {t.teams.kpo}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StaffRow
              label={t.teams.rerolls}
              unitCost={`${rerollUnitCost}${t.teams.kpo}`}
              testId="staff-rerolls"
            >
              <QuantityStepper
                value={rerolls}
                min={0}
                max={staff.maxRerolls}
                onChange={setRerolls}
                label={t.teams.rerolls}
                decrementAriaLabel={decLabel(t.teams.rerolls)}
                incrementAriaLabel={incLabel(t.teams.rerolls)}
                decrementTestId="staff-rerolls-dec"
                incrementTestId="staff-rerolls-inc"
                valueTestId="staff-rerolls-value"
              />
            </StaffRow>

            <StaffRow
              label={t.teams.cheerleaders}
              unitCost={`${staff.cheerleaderCost / 1000}${t.teams.kpo}`}
              testId="staff-cheerleaders"
            >
              <QuantityStepper
                value={cheerleaders}
                min={0}
                max={staff.maxCheerleaders}
                onChange={setCheerleaders}
                label={t.teams.cheerleaders}
                decrementAriaLabel={decLabel(t.teams.cheerleaders)}
                incrementAriaLabel={incLabel(t.teams.cheerleaders)}
                decrementTestId="staff-cheerleaders-dec"
                incrementTestId="staff-cheerleaders-inc"
                valueTestId="staff-cheerleaders-value"
              />
            </StaffRow>

            <StaffRow
              label={t.teams.assistants}
              unitCost={`${staff.assistantCost / 1000}${t.teams.kpo}`}
              testId="staff-assistants"
            >
              <QuantityStepper
                value={assistants}
                min={0}
                max={staff.maxAssistants}
                onChange={setAssistants}
                label={t.teams.assistants}
                decrementAriaLabel={decLabel(t.teams.assistants)}
                incrementAriaLabel={incLabel(t.teams.assistants)}
                decrementTestId="staff-assistants-dec"
                incrementTestId="staff-assistants-inc"
                valueTestId="staff-assistants-value"
              />
            </StaffRow>

            <StaffRow
              label={t.teams.dedicatedFans}
              unitCost={`${staff.dedicatedFanCost / 1000}${t.teams.kpo}`}
              testId="staff-dedicated-fans"
            >
              <QuantityStepper
                value={dedicatedFans}
                min={1}
                max={staff.maxDedicatedFans}
                onChange={setDedicatedFans}
                label={t.teams.dedicatedFans}
                decrementAriaLabel={decLabel(t.teams.dedicatedFans)}
                incrementAriaLabel={incLabel(t.teams.dedicatedFans)}
                decrementTestId="staff-dedicated-fans-dec"
                incrementTestId="staff-dedicated-fans-inc"
                valueTestId="staff-dedicated-fans-value"
              />
            </StaffRow>

            <label
              htmlFor="staff-apothecary-input"
              className={`sm:col-span-2 flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 transition-colors ${
                apothecaryAvailable
                  ? "cursor-pointer hover:bg-gray-100"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium text-gray-900">
                  {t.teams.apothecary}
                </div>
                <div className="text-xs text-gray-600">
                  {staff.apothecaryCost / 1000}{t.teams.kpo} · {t.teams.apothecaryHelp}
                </div>
                {!staff.apothecaryAllowed && (
                  <div
                    data-testid="apothecary-forbidden-roster"
                    className="text-xs text-red-600 mt-1"
                  >
                    Indisponible pour cette équipe
                  </div>
                )}
              </div>
              <input
                id="staff-apothecary-input"
                data-testid="staff-apothecary"
                type="checkbox"
                role="switch"
                aria-checked={apothecary}
                aria-label={t.teams.apothecary}
                disabled={!apothecaryAvailable}
                className="sr-only peer"
                checked={apothecary}
                onChange={(e) => setApothecary(e.target.checked)}
              />
              <span
                aria-hidden="true"
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2 ${
                  apothecary ? "bg-emerald-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    apothecary ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </span>
            </label>
          </div>
        </div>

        {constraints.starPlayersAllowed && (
          <StarPlayerSelector
            roster={rosterId}
            ruleset={ruleset}
            selectedStarPlayers={selectedStarPlayers}
            onSelectionChange={setSelectedStarPlayers}
            currentPlayerCount={totalPlayers}
            availableBudget={Math.max(0, (teamValue - total - staffCost) * 1000)}
          />
        )}
      </div>
    </div>
  );
}

interface SummaryMetricProps {
  label: string;
  value: string;
  tone: "success" | "danger" | "neutral";
  testId?: string;
  className?: string;
}

function SummaryMetric({
  label,
  value,
  tone,
  testId,
  className,
}: SummaryMetricProps) {
  const toneClasses =
    tone === "danger"
      ? "text-red-600"
      : tone === "success"
        ? "text-emerald-700"
        : "text-gray-900";
  return (
    <div className={`flex flex-col min-w-0 ${className ?? ""}`}>
      <span className="text-[10px] md:text-xs uppercase tracking-wide text-gray-500 leading-none">
        {label}
      </span>
      <span
        data-testid={testId}
        className={`text-base md:text-lg font-bold tabular-nums leading-tight ${toneClasses}`}
      >
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  // AG/PA/AV suffixées d'un "+" (notation BB) via le formateur partagé.
  return (
    <span className="text-gray-700">
      <span className="text-gray-500">{label}</span>
      <span className="ml-1 font-medium tabular-nums">
        {formatStatByLabel(label, value)}
      </span>
    </span>
  );
}

interface StaffRowProps {
  label: string;
  unitCost: string;
  testId?: string;
  children: React.ReactNode;
}

function StaffRow({ label, unitCost, testId, children }: StaffRowProps) {
  return (
    <div
      data-testid={testId}
      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50"
    >
      <div className="min-w-0">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-600">{unitCost}</div>
      </div>
      {children}
    </div>
  );
}
