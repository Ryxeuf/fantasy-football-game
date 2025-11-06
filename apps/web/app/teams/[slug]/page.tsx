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
      <div className="max-w-7xl mx-auto p-6">
        <p>{t.common.loading}</p>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="max-w-7xl mx-auto p-6">
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
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/teams"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ← {t.teams.backToList}
            </Link>
          </div>
          <h1 className="text-4xl font-bold">{team.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">
              {t.teams.tier} {team.tier}
            </span>
            {team.naf && (
              <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-sm font-medium">
                NAF
              </span>
            )}
            <span className="text-gray-600 text-sm">
              {t.teams.budgetLabel.replace(/\{budget\}/g, team.budget.toString())}
            </span>
          </div>
        </div>
        <Link
          href={`/me/teams/new?roster=${slug}`}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          {t.teams.createTeamWithName.replace(/\{name\}/g, team.name)}
        </Link>
      </div>

      {/* Informations générales */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b">
          <h2 className="text-lg font-semibold">{t.teams.teamInfo}</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b">
          <h2 className="text-lg font-semibold">
            {t.teams.rosterPositions.replace(/\{count\}/g, positions.length.toString())}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {t.teams.rosterPositionsDesc}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-900">{t.teams.position}</th>
                <th className="text-left p-4 font-medium text-gray-900">{t.teams.cost}</th>
                <th className="text-left p-4 font-medium text-gray-900">{t.teams.min}</th>
                <th className="text-left p-4 font-medium text-gray-900">{t.teams.max}</th>
                <th className="text-left p-4 font-medium text-gray-900">MA</th>
                <th className="text-left p-4 font-medium text-gray-900">ST</th>
                <th className="text-left p-4 font-medium text-gray-900">AG</th>
                <th className="text-left p-4 font-medium text-gray-900">PA</th>
                <th className="text-left p-4 font-medium text-gray-900">AV</th>
                <th className="text-left p-4 font-medium text-gray-900">{t.teams.skills}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {positions.map((position) => (
                <tr key={position.slug} className="hover:bg-gray-50">
                  <td className="p-4 font-medium">{translatePositionName(position.displayName)}</td>
                  <td className="p-4 text-center font-mono text-sm">
                    {position.cost}k {t.teams.po}
                  </td>
                  <td className="p-4 text-center font-mono">{position.min}</td>
                  <td className="p-4 text-center font-mono">{position.max}</td>
                  <td className="p-4 text-center font-mono">{position.ma}</td>
                  <td className="p-4 text-center font-mono">{position.st}</td>
                  <td className="p-4 text-center font-mono">{position.ag}</td>
                  <td className="p-4 text-center font-mono">{position.pa}</td>
                  <td className="p-4 text-center font-mono">{position.av}</td>
                  <td className="p-4">
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
      </div>

      {/* Règles spéciales */}
      {TEAM_SPECIAL_RULES[slug] && TEAM_SPECIAL_RULES[slug].length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b">
            <h2 className="text-lg font-semibold">{t.teams.specialRules}</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-3">
              {TEAM_SPECIAL_RULES[slug].map((rule, index) => (
                <button
                  key={index}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
        <div className="bg-gray-50 px-6 py-3 border-b">
          <h2 className="text-lg font-semibold">{t.teams.staff}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t.teams.staffDesc}
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="bg-gray-50 px-6 py-3 border-b">
          <h2 className="text-lg font-semibold">{t.teams.rosterStats}</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      <div className="flex gap-4">
        <Link
          href={`/me/teams/new?roster=${slug}`}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          {t.teams.createTeamWithName.replace(/\{name\}/g, team.name)}
        </Link>
        <Link
          href="/teams"
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          {t.teams.backToList}
        </Link>
      </div>
    </div>
  );
}
