"use client";
import { getRerollCost } from "@bb/game-engine";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import SkillTooltip from "../../me/teams/components/SkillTooltip";
import { useLanguage } from "../../contexts/LanguageContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';

// Règles spéciales par équipe
const TEAM_SPECIAL_RULES: Record<string, Array<{ name: string; description: string }>> = {
  snotling: [
    { name: "Charge & Concussion", description: "Règle spéciale des Snotlings concernant les charges et les commotions." },
    { name: "Dédicace des Fans", description: "Règle spéciale liée aux fans dévoués." },
    { name: "L'Union fait la Force", description: "Règle spéciale sur l'unité de l'équipe." }
  ],
  // Ajouter d'autres équipes au fur et à mesure
};

// Fonction pour traduire les noms de positions en français
function translatePositionName(displayName: string): string {
  const translations: Record<string, string> = {
    // Hommes-Lézards
    "Skink Runner": "Skink Coureur",
    "Chameleon Skink": "Skink Caméléon",
    "Saurus": "Saurus",
    "Kroxigor": "Kroxigor",
    // Ajouter d'autres traductions au besoin
  };
  return translations[displayName] || displayName;
}

export default function TeamDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { language, t } = useLanguage();
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRoster() {
      if (!slug) return;
      try {
        setLoading(true);
        const lang = language === "en" ? "en" : "fr";
        const response = await fetch(`${API_BASE}/api/rosters/${slug}?lang=${lang}`);
        if (!response.ok) {
          throw new Error("Équipe introuvable");
        }
        const data = await response.json();
        setTeam(data.roster);
      } catch (err: any) {
        setError(err.message || "Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    }
    fetchRoster();
  }, [slug, language]);

  if (loading) {
    return (
      <div className="w-full p-6">
        <p>{t.common.loading}</p>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="w-full p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || t.teams.teamNotFound}
        </div>
        <Link
          href="/teams"
          className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t.teams.backToListLink}
        </Link>
      </div>
    );
  }

  const positions = team.positions.sort((a: any, b: any) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* En-tête */}
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
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">{team.name}</h1>
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
              {t.teams.budgetLabel.replace(/\{budget\}/g, team.budget.toString())}
            </span>
          </div>
        </div>
        <Link
          href={`/me/teams/new?roster=${slug}`}
          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm sm:text-base text-center whitespace-nowrap"
        >
          {t.teams.createTeamWithName.replace(/\{name\}/g, team.name)}
        </Link>
      </div>

      {/* Informations générales */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">{t.teams.teamInfo}</h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">{t.teams.tier}</div>
              <div className="text-lg font-semibold text-gray-900">{t.teams.tier} {team.tier}</div>
              <div className="text-xs text-gray-500 mt-1">
                {team.tier === "I" && t.teams.tierTop}
                {team.tier === "II" && t.teams.tierMiddle}
                {team.tier === "III" && t.teams.tierBottom}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">{t.teams.startingBudget}</div>
              <div className="text-lg font-semibold text-gray-900">{team.budget}k {t.teams.po}</div>
              <div className="text-xs text-gray-500 mt-1">
                {t.teams.startingBudgetDesc}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">{t.teams.nafStatus}</div>
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

      {/* Roster - Positions disponibles */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            {t.teams.rosterPositions.replace(/\{count\}/g, positions.length.toString())}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1.5">
            {t.teams.rosterPositionsDesc}
          </p>
        </div>
        
        {/* Version Desktop : Tableau amélioré */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 font-semibold text-gray-900 text-sm">{t.teams.position}</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">{t.teams.cost}</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">{t.teams.min}</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">{t.teams.max}</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">MA</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">ST</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">AG</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">PA</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-900 text-sm">AV</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-900 text-sm">{t.teams.skills}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {positions.map((position, index) => (
                <tr 
                  key={position.slug} 
                  className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{translatePositionName(position.displayName)}</div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono text-sm font-semibold">
                      {position.cost}k
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm text-gray-700">{position.min}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm text-gray-700">{position.max}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm font-semibold text-gray-900">{position.ma}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm font-semibold text-gray-900">{position.st}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm font-semibold text-gray-900">{position.ag}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm font-semibold text-gray-900">{position.pa}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm font-semibold text-gray-900">{position.av}</span>
                  </td>
                  <td className="px-6 py-4">
                    <SkillTooltip
                      skillsString={position.skills}
                      position={position.slug}
                      teamName={slug}
                      useDirectParsing={true}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Version Mobile/Tablet : Cartes élégantes */}
        <div className="lg:hidden p-4 sm:p-6 space-y-4">
          {positions.map((position) => (
            <div
              key={position.slug}
              className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* En-tête de la carte */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
                    {translatePositionName(position.displayName)}
                  </h3>
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

              {/* Statistiques */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Statistiques
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-blue-600 font-medium mb-0.5">MA</div>
                    <div className="text-base sm:text-lg font-bold text-blue-900 font-mono">{position.ma}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-red-600 font-medium mb-0.5">ST</div>
                    <div className="text-base sm:text-lg font-bold text-red-900 font-mono">{position.st}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-green-600 font-medium mb-0.5">AG</div>
                    <div className="text-base sm:text-lg font-bold text-green-900 font-mono">{position.ag}</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-purple-600 font-medium mb-0.5">PA</div>
                    <div className="text-base sm:text-lg font-bold text-purple-900 font-mono">{position.pa}</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-orange-600 font-medium mb-0.5">AV</div>
                    <div className="text-base sm:text-lg font-bold text-orange-900 font-mono">{position.av}</div>
                  </div>
                </div>
              </div>

              {/* Compétences */}
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
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Règles spéciales */}
      {TEAM_SPECIAL_RULES[slug] && TEAM_SPECIAL_RULES[slug].length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
            <h2 className="text-base sm:text-lg font-semibold">{t.teams.specialRules}</h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {TEAM_SPECIAL_RULES[slug].map((rule, index) => (
                <button
                  key={index}
                  className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-xs sm:text-sm"
                  title={rule.description}
                >
                  {rule.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Staff */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">{t.teams.staff}</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {t.teams.staffDesc}
          </p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="font-semibold text-lg mb-2">{t.teams.cheerleader}</div>
              <div className="text-2xl font-bold text-emerald-600 mb-1">10k {t.teams.po}</div>
              <div className="text-sm text-gray-600">{t.teams.perCheerleader}</div>
            </div>
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="font-semibold text-lg mb-2">{t.teams.assistant}</div>
              <div className="text-2xl font-bold text-emerald-600 mb-1">10k {t.teams.po}</div>
              <div className="text-sm text-gray-600">{t.teams.perAssistant}</div>
            </div>
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="font-semibold text-lg mb-2">{t.teams.rerolls}</div>
              <div className="text-2xl font-bold text-emerald-600 mb-1">
                {Math.round(getRerollCost(slug) / 1000)}k {t.teams.po}
              </div>
              <div className="text-sm text-gray-600">{t.teams.perReroll}</div>
            </div>
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="font-semibold text-lg mb-2">{t.teams.apothecary}</div>
              <div className="text-2xl font-bold text-emerald-600 mb-1">50k {t.teams.po}</div>
              <div className="text-sm text-gray-600">{t.teams.oneApothecary}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Résumé des statistiques */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">{t.teams.rosterStats}</h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">{t.teams.uniquePositions}</div>
              <div className="text-2xl font-bold text-blue-900">{positions.length}</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600 font-medium">{t.teams.minCost}</div>
              <div className="text-2xl font-bold text-green-900">
                {Math.min(...positions.map(p => p.cost * p.min))}k {t.teams.po}
              </div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-600 font-medium">{t.teams.maxCost}</div>
              <div className="text-2xl font-bold text-purple-900">
                {positions.reduce((sum, p) => sum + (p.cost * p.max), 0)}k {t.teams.po}
              </div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-sm text-orange-600 font-medium">{t.teams.maxPlayers}</div>
              <div className="text-2xl font-bold text-orange-900">
                {positions.reduce((sum, p) => sum + p.max, 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Link
          href={`/me/teams/new?roster=${slug}`}
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
