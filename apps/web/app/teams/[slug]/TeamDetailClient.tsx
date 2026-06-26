"use client";
import {
  getFormatConstraints,
  defaultStaffConfig,
  type RosterStaffConfig,
  FORMATS,
  type GameFormat,
  RULESETS,
  DEFAULT_RULESET,
  type Ruleset,
} from "@bb/game-engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SkillTooltip from "../../me/teams/components/SkillTooltip";
import SkillAccessBadges from "../../me/teams/components/SkillAccessBadges";
import { useLanguage } from "../../contexts/LanguageContext";
import ShareBar from "../../components/ShareBar";
import { stripRosterPrefix } from "../position-slug";
import { formatPlusStat } from "../../lib/format-stats";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr"
).replace(/\/$/, "");

const API_BASE_PUBLIC =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8201";

/**
 * Règle spéciale d'équipe résolue par l'API (A11). `name`/`description` sont
 * déjà localisés côté serveur selon la langue demandée.
 */
interface RosterSpecialRule {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
}

/** Ligue régionale ("type de ligue") résolue par l'API (A11). */
interface RosterRegionalLeague {
  readonly slug: string;
  readonly name: string;
}

function translatePositionName(displayName: string): string {
  const translations: Record<string, string> = {
    "Skink Runner": "Skink Coureur",
    "Chameleon Skink": "Skink Caméléon",
    Saurus: "Saurus",
    Kroxigor: "Kroxigor",
  };
  return translations[displayName] || displayName;
}

/**
 * Mots-clés officiels d'une position (lignée + type, ex: "Elfe, Trois-quart").
 * Source : colonne `keywords` de l'API, CSV. Affichés en petites étiquettes.
 */
function KeywordTags({
  keywords,
  keywordsEn,
  className = "",
}: {
  keywords?: string | null;
  keywordsEn?: string | null;
  className?: string;
}) {
  const { language } = useLanguage();
  const source = language === "en" ? keywordsEn ?? keywords : keywords;
  const tags = (source ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (tags.length === 0) return null;
  return (
    <div
      data-testid="position-keywords"
      className={`mt-1 flex flex-wrap gap-1 ${className}`}
    >
      {tags.map((kw) => (
        <span
          key={kw}
          className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-medium"
        >
          {kw}
        </span>
      ))}
    </div>
  );
}

export interface TeamDetailClientProps {
  slug: string;
  selectedRuleset: Ruleset;
  actualRuleset: Ruleset;
  initialTeam: any;
}

export default function TeamDetailClient({
  slug,
  selectedRuleset,
  actualRuleset,
  initialTeam,
}: TeamDetailClientProps) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [team, setTeam] = useState<any>(initialTeam);

  const rulesetLabels: Record<string, string> = {
    season_2: t.teams.rulesetSeason2 ?? "Saison 2 (2020)",
    season_3: t.teams.rulesetSeason3 ?? "Saison 3 (2025)",
  };

  // Format de jeu (BB à 11 / BB à 7). Axe orthogonal au ruleset : il ne
  // change pas la fiche des positions (servie par l'API), uniquement les
  // contraintes/coûts de sélection (budget, staff, relances, apothicaire).
  // Source unique partagée avec le builder : `FORMAT_CONSTRAINTS`.
  const [format, setFormat] = useState<GameFormat>("bb11");
  const constraints = getFormatConstraints(format);
  // Config staff (coûts po + plafonds + apothicaire) du roster × format, issue
  // de la BASE (admin) ; repli sur le défaut dérivé si la ligne n'existe pas.
  // Même source de vérité que le builder -> les éditions admin se reflètent ici.
  const staff: RosterStaffConfig =
    team?.staffConfigs?.[format] ?? defaultStaffConfig(slug, format);
  const formatLabels: Record<GameFormat, string> = {
    bb11: t.teams.formatBB11 ?? "Blood Bowl à 11",
    sevens: t.teams.formatSevens ?? "Blood Bowl à Sept",
  };

  // Re-fetch only when the user toggles language away from the default (fr).
  useEffect(() => {
    if (language === "fr") {
      setTeam(initialTeam);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `${API_BASE_PUBLIC}/api/rosters/${slug}?lang=en&ruleset=${selectedRuleset}`,
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.roster) {
          setTeam(data.roster);
        }
      } catch {
        // Keep initial server-rendered team.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [language, slug, selectedRuleset, initialTeam]);

  const handleRulesetChange = (ruleset: Ruleset) => {
    if (ruleset === selectedRuleset) return;
    router.push(`/teams/${slug}?ruleset=${ruleset}`);
  };

  const positions = [...(team?.positions ?? [])].sort((a: any, b: any) =>
    a.displayName.localeCompare(b.displayName),
  );

  // A11 — règles spéciales + ligues régionales résolues par l'API. Optionnels
  // pour rétro-compat (un frontend déployé avant le serveur reçoit `undefined`).
  const specialRules: RosterSpecialRule[] = Array.isArray(team?.specialRules)
    ? team.specialRules
    : [];
  const regionalLeagues: RosterRegionalLeague[] = Array.isArray(
    team?.regionalLeagues,
  )
    ? team.regionalLeagues
    : [];

  // Lien vers la page detail d'une position. On porte le ruleset reellement
  // affiche (actualRuleset) pour que la destination montre les memes donnees ;
  // omis quand c'est l'edition par defaut (URL propre, canonical season_3).
  const positionRulesetQuery =
    actualRuleset === DEFAULT_RULESET ? "" : `?ruleset=${actualRuleset}`;
  const positionHref = (positionSlug: string) =>
    `/teams/${slug}/${stripRosterPrefix(positionSlug, slug)}${positionRulesetQuery}`;

  return (
    <div className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/teams"
              className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm"
            >
              ← {t.teams.backToList}
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
            {team.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
            <span className="px-2 sm:px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs sm:text-sm font-medium">
              {t.teams.tier} {team.tier}
            </span>
            {team.naf && (
              <span className="px-2 sm:px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs sm:text-sm font-medium">
                NAF
              </span>
            )}
            <span className="text-gray-600 text-xs sm:text-sm">
              {t.teams.budgetLabel.replace(
                /\{budget\}/g,
                constraints.startingBudget.toString(),
              )}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ShareBar
              url={`${SITE_URL}/teams/${slug}`}
              title={
                language === "en"
                  ? `${team.name} — Blood Bowl roster on Nuffle Arena`
                  : `${team.name} — roster Blood Bowl sur Nuffle Arena`
              }
              copyLabel={language === "en" ? "Copy link" : "Copier le lien"}
              copiedLabel={language === "en" ? "Link copied!" : "Lien copié !"}
            />
            <Link
              href={`/teams/comparer?teams=${slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-1.5 text-xs sm:text-sm font-medium text-blue-700 hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              ⚔️ {language === "en" ? "Compare this team" : "Comparer cette équipe"}
            </Link>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            {RULESETS.map((ruleset) => (
              <button
                key={ruleset}
                onClick={() => handleRulesetChange(ruleset)}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedRuleset === ruleset
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {rulesetLabels[ruleset]}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            {FORMATS.map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  format === f
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {formatLabels[f]}
              </button>
            ))}
          </div>
          <Link
            href={`/me/teams/new?roster=${slug}&ruleset=${selectedRuleset}&format=${format}`}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm sm:text-base text-center whitespace-nowrap"
          >
            {t.teams.createTeamWithName.replace(/\{name\}/g, team.name)}
          </Link>
        </div>
      </div>

      {actualRuleset !== selectedRuleset && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
          ⚠️{" "}
          {t.teams.rulesetFallback
            ?.replace("{selected}", rulesetLabels[selectedRuleset])
            .replace("{actual}", rulesetLabels[actualRuleset]) ??
            `Ce roster n'est pas disponible en ${rulesetLabels[selectedRuleset]}. Affichage de la version ${rulesetLabels[actualRuleset]}.`}
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">
            {t.teams.teamInfo}
          </h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">
                {t.teams.tier}
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {t.teams.tier} {team.tier}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {team.tier === "I" && t.teams.tierTop}
                {team.tier === "II" && t.teams.tierMiddle}
                {team.tier === "III" && t.teams.tierBottom}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">
                {t.teams.startingBudget}
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {constraints.startingBudget}k {t.teams.po}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t.teams.startingBudgetDesc}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">
                {t.teams.nafStatus}
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {team.naf ? (
                  <span className="text-yellow-600">{t.teams.nafTeam}</span>
                ) : (
                  <span className="text-green-600">{t.teams.officialTeam}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {team.naf ? t.teams.nafTeamDesc : t.teams.officialTeamDesc}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            {t.teams.rosterPositions.replace(
              /\{count\}/g,
              positions.length.toString(),
            )}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1.5">
            {t.teams.rosterPositionsDesc}
          </p>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 font-semibold text-gray-900 text-sm">
                  {t.teams.position}
                </th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">
                  {t.teams.cost}
                </th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">
                  {t.teams.min}
                </th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">
                  {t.teams.max}
                </th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">
                  MA
                </th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">
                  ST
                </th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">
                  AG
                </th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">
                  PA
                </th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">
                  AV
                </th>
                <th className="text-left px-6 py-4 font-semibold text-gray-900 text-sm">
                  {t.teams.skills}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {positions.map((position: any, index: number) => (
                <tr
                  key={position.slug}
                  className={`hover:bg-blue-50 transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  }`}
                >
                  <td className="px-6 py-4">
                    <Link
                      href={positionHref(position.slug)}
                      data-testid="position-link"
                      className="font-semibold text-gray-900 hover:text-emerald-700 hover:underline transition-colors"
                    >
                      {translatePositionName(position.displayName)}
                    </Link>
                    <KeywordTags keywords={position.keywords} keywordsEn={position.keywordsEn} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono text-sm font-semibold">
                      {position.cost}k
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm text-gray-700">
                      {position.min}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm text-gray-700">
                      {position.max}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {position.ma}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {position.st}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {formatPlusStat(position.ag)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {formatPlusStat(position.pa)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {formatPlusStat(position.av)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <SkillTooltip
                      skillsString={position.skills}
                      position={position.slug}
                      teamName={slug}
                      useDirectParsing={true}
                      showAsBaseSkillsOnly={true}
                    />
                    <SkillAccessBadges
                      primary={position.primarySkills}
                      secondary={position.secondarySkills}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden p-4 sm:p-6 space-y-4">
          {positions.map((position: any) => (
            <div
              key={position.slug}
              className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
                    <Link
                      href={positionHref(position.slug)}
                      data-testid="position-link"
                      className="hover:text-emerald-700 hover:underline transition-colors"
                    >
                      {translatePositionName(position.displayName)}
                    </Link>
                  </h3>
                  <KeywordTags keywords={position.keywords} keywordsEn={position.keywordsEn} className="mb-1" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono text-xs sm:text-sm font-semibold">
                      {position.cost}k {t.teams.po}
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                      {position.min}-{position.max} {t.teams.players}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Statistiques
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-blue-600 font-medium mb-0.5">
                      MA
                    </div>
                    <div className="text-base sm:text-lg font-bold text-blue-900 font-mono">
                      {position.ma}
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-red-600 font-medium mb-0.5">
                      ST
                    </div>
                    <div className="text-base sm:text-lg font-bold text-red-900 font-mono">
                      {position.st}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-green-600 font-medium mb-0.5">
                      AG
                    </div>
                    <div className="text-base sm:text-lg font-bold text-green-900 font-mono">
                      {formatPlusStat(position.ag)}
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-purple-600 font-medium mb-0.5">
                      PA
                    </div>
                    <div className="text-base sm:text-lg font-bold text-purple-900 font-mono">
                      {formatPlusStat(position.pa)}
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-orange-600 font-medium mb-0.5">
                      AV
                    </div>
                    <div className="text-base sm:text-lg font-bold text-orange-900 font-mono">
                      {formatPlusStat(position.av)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {t.teams.skills}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <SkillTooltip
                    skillsString={position.skills}
                    position={position.slug}
                    teamName={slug}
                    useDirectParsing={true}
                    showAsBaseSkillsOnly={true}
                  />
                  <SkillAccessBadges
                    primary={position.primarySkills}
                    secondary={position.secondarySkills}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {regionalLeagues.map((league) => (
                <a
                  key={league.slug}
                  href={`/ligues/${league.slug}`}
                  data-testid={`roster-league-${league.slug}`}
                  className="px-3 sm:px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 font-medium text-xs sm:text-sm border border-indigo-100 transition-colors"
                >
                  {league.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        data-testid="roster-special-rules"
        className="bg-white rounded-lg border overflow-hidden"
      >
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">
            {t.teams.specialRules}
          </h2>
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

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">
            {t.teams.staff}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {t.teams.staffDesc}
          </p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="font-semibold text-lg mb-2">
                {t.teams.cheerleader}
              </div>
              <div className="text-2xl font-bold text-emerald-600 mb-1">
                {staff.cheerleaderCost / 1000}k {t.teams.po}
              </div>
              <div className="text-sm text-gray-600">
                {t.teams.perCheerleader}
              </div>
            </div>
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="font-semibold text-lg mb-2">
                {t.teams.assistant}
              </div>
              <div className="text-2xl font-bold text-emerald-600 mb-1">
                {staff.assistantCost / 1000}k {t.teams.po}
              </div>
              <div className="text-sm text-gray-600">
                {t.teams.perAssistant}
              </div>
            </div>
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="font-semibold text-lg mb-2">
                {t.teams.rerolls}
              </div>
              <div className="text-2xl font-bold text-emerald-600 mb-1">
                {staff.rerollCost / 1000}k {t.teams.po}
              </div>
              <div className="text-sm text-gray-600">{t.teams.perReroll}</div>
            </div>
            {/* Apothicaire : visible si la config (roster × format) l'autorise.
                Coût et autorisation issus de la BASE (repli défaut dérivé) —
                même source de vérité que le builder. */}
            {staff.apothecaryAllowed && (
              <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="font-semibold text-lg mb-2">
                  {t.teams.apothecary}
                </div>
                <div className="text-2xl font-bold text-emerald-600 mb-1">
                  {staff.apothecaryCost / 1000}k {t.teams.po}
                </div>
                <div className="text-sm text-gray-600">
                  {t.teams.oneApothecary}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">
            {t.teams.rosterStats}
          </h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">
                {t.teams.uniquePositions}
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {positions.length}
              </div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600 font-medium">
                {t.teams.minCost}
              </div>
              <div className="text-2xl font-bold text-green-900">
                {Math.min(...positions.map((p: any) => p.cost * p.min))}k{" "}
                {t.teams.po}
              </div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-600 font-medium">
                {t.teams.maxCost}
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {positions.reduce(
                  (sum: number, p: any) => sum + p.cost * p.max,
                  0,
                )}
                k {t.teams.po}
              </div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-sm text-orange-600 font-medium">
                {t.teams.maxPlayers}
              </div>
              <div className="text-2xl font-bold text-orange-900">
                {positions.reduce((sum: number, p: any) => sum + p.max, 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Link
          href={`/me/teams/new?roster=${slug}&ruleset=${selectedRuleset}&format=${format}`}
          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm sm:text-base text-center"
        >
          {t.teams.createTeamWithName.replace(/\{name\}/g, team.name)}
        </Link>
        <Link
          href="/teams"
          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm sm:text-base text-center"
        >
          {t.teams.backToList}
        </Link>
      </div>
    </div>
  );
}
