"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../contexts/LanguageContext";

export interface Skill {
  id: string;
  slug: string;
  ruleset: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn?: string | null;
  category: string;
}

const RULESET_OPTIONS = [
  { value: "season_2", label: "Saison 2 (2020)", labelEn: "Season 2 (2020)" },
  { value: "season_3", label: "Saison 3 (2025)", labelEn: "Season 3 (2025)" },
] as const;

const categoryNames: Record<string, { fr: string; en: string }> = {
  General: { fr: "Compétences Générales", en: "General Skills" },
  Agility: { fr: "Compétences d'Agilité", en: "Agility Skills" },
  Strength: { fr: "Compétences de Force", en: "Strength Skills" },
  Passing: { fr: "Compétences de Passe", en: "Passing Skills" },
  Mutation: { fr: "Mutations", en: "Mutations" },
  Trait: { fr: "Traits", en: "Traits" },
};

interface SkillsClientProps {
  skills: Skill[];
  selectedRuleset: string;
}

export default function SkillsClient({
  skills,
  selectedRuleset,
}: SkillsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const router = useRouter();
  const { language, t } = useLanguage();

  const skillsByCategory = useMemo(() => {
    const grouped: Record<string, Skill[]> = {};
    skills.forEach((skill) => {
      if (!grouped[skill.category]) {
        grouped[skill.category] = [];
      }
      grouped[skill.category].push(skill);
    });
    return Object.entries(grouped).map(([category, categorySkills]) => ({
      name: categoryNames[category]?.fr || category,
      nameEn: categoryNames[category]?.en || category,
      skills: categorySkills.sort((a, b) => a.nameFr.localeCompare(b.nameFr)),
    }));
  }, [skills]);

  const filteredData = useMemo(() => {
    let filtered = skillsByCategory;
    if (selectedCategory) {
      filtered = filtered.filter(
        (category) => category.name === selectedCategory,
      );
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered
        .map((category) => ({
          ...category,
          skills: category.skills.filter(
            (skill) =>
              skill.nameFr.toLowerCase().includes(q) ||
              skill.nameEn.toLowerCase().includes(q) ||
              skill.description.toLowerCase().includes(q) ||
              (skill.descriptionEn &&
                skill.descriptionEn.toLowerCase().includes(q)),
          ),
        }))
        .filter((category) => category.skills.length > 0);
    }
    return filtered;
  }, [searchTerm, selectedCategory, skillsByCategory]);

  const categories = skillsByCategory.map((category) => category.name);

  const handleRulesetChange = (ruleset: string) => {
    if (ruleset === selectedRuleset) return;
    router.push(`/skills?ruleset=${ruleset}`);
  };

  return (
    <div className="w-full">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
          {t.skills.title}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
          {t.skills.description}
        </p>

        <div className="mb-4 sm:mb-6">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-gray-700 mr-2">
              {language === "fr" ? "Édition des règles :" : "Rules Edition:"}
            </span>
            {RULESET_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleRulesetChange(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedRuleset === option.value
                    ? option.value === "season_3"
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-amber-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {language === "fr" ? option.label : option.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder={t.skills.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 sm:py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {t.skills.allCategories}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {language === "fr"
                  ? category
                  : skillsByCategory.find((c) => c.name === category)?.nameEn ||
                    category}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-600">
          {searchTerm || selectedCategory ? (
            <>
              {filteredData.reduce(
                (total, category) => total + category.skills.length,
                0,
              )}{" "}
              {t.skills.resultsFound}
              {searchTerm && ` ${t.skills.for} "${searchTerm}"`}
              {selectedCategory &&
                ` ${t.skills.in} "${
                  language === "fr"
                    ? selectedCategory
                    : skillsByCategory.find((c) => c.name === selectedCategory)
                        ?.nameEn || selectedCategory
                }"`}
            </>
          ) : (
            t.skills.total.replace("{count}", skills.length.toString())
          )}
        </div>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {filteredData.map((category) => (
          <div
            key={category.name}
            className="bg-white rounded-lg shadow-sm border border-gray-200"
          >
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {language === "fr" ? category.name : category.nameEn}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {category.skills.length}{" "}
                {category.skills.length === 1
                  ? t.footer.items
                  : t.footer.itemsPlural}
              </p>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid gap-3 sm:gap-4">
                {category.skills.map((skill) => (
                  <div
                    key={skill.id || skill.slug}
                    className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                          {language === "fr"
                            ? `${skill.nameFr} (${skill.nameEn})`
                            : `${skill.nameEn} (${skill.nameFr})`}
                        </h3>
                        <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                          {language === "fr"
                            ? skill.description
                            : skill.descriptionEn || skill.description}
                        </p>
                      </div>
                      <div className="sm:ml-4 flex-shrink-0">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            skill.category === "General"
                              ? "bg-blue-100 text-blue-800"
                              : skill.category === "Agility"
                                ? "bg-green-100 text-green-800"
                                : skill.category === "Strength"
                                  ? "bg-red-100 text-red-800"
                                  : skill.category === "Passing"
                                    ? "bg-purple-100 text-purple-800"
                                    : skill.category === "Mutations"
                                      ? "bg-orange-100 text-orange-800"
                                      : skill.category === "Traits"
                                        ? "bg-gray-100 text-gray-800"
                                        : skill.category === "Extraordinary"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {skill.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredData.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">
            {language === "fr"
              ? "Aucun résultat trouvé pour votre recherche."
              : "No results found for your search."}
          </div>
          <p className="text-gray-400 mt-2">
            {language === "fr"
              ? "Essayez de modifier vos critères de recherche."
              : "Try modifying your search criteria."}
          </p>
        </div>
      )}

      <div className="mt-8 sm:mt-12 bg-gray-50 rounded-lg p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
          {language === "fr" ? "Légende des couleurs" : "Color Legend"}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></span>
            <span className="text-gray-700">General</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-green-100 border border-green-300 rounded"></span>
            <span className="text-gray-700">Agility</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-red-100 border border-red-300 rounded"></span>
            <span className="text-gray-700">Strength</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></span>
            <span className="text-gray-700">Passing</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></span>
            <span className="text-gray-700">Mutations</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></span>
            <span className="text-gray-700">Traits</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></span>
            <span className="text-gray-700">Extraordinary</span>
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-500">
          {language === "fr" ? "Les compétences marquées " : "Skills marked "}
          <span className="text-red-600 font-semibold">
            ({language === "fr" ? "Obligatoire" : "Compulsory"})
          </span>
          {language === "fr"
            ? " doivent être utilisées quand les conditions sont remplies."
            : " must be used when conditions are met."}
        </div>
      </div>
    </div>
  );
}
