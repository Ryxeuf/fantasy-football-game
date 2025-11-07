"use client";
import { useState, useMemo, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";

// Types pour les compétences et traits
interface Skill {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn?: string | null;
  category: string;
}

interface SkillCategory {
  name: string;
  nameEn: string;
  skills: Skill[];
}

const API_URL = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';

// Mapping des catégories pour l'affichage
const categoryNames: Record<string, { fr: string; en: string }> = {
  "General": { fr: "Compétences Générales", en: "General Skills" },
  "Agility": { fr: "Compétences d'Agilité", en: "Agility Skills" },
  "Strength": { fr: "Compétences de Force", en: "Strength Skills" },
  "Passing": { fr: "Compétences de Passe", en: "Passing Skills" },
  "Mutation": { fr: "Mutations", en: "Mutations" },
  "Trait": { fr: "Traits", en: "Traits" },
};

// Les données statiques ont été migrées vers apps/server/src/static-skills-data.ts
// et sont maintenant gérées via le seed dans apps/server/src/seed.ts
// Toutes les compétences sont maintenant chargées depuis l'API /api/skills

export default function SkillsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { language, t } = useLanguage();

  // Charger les compétences depuis l'API
  useEffect(() => {
    const loadSkills = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_URL}/api/skills`);
        if (!response.ok) {
          throw new Error("Erreur lors du chargement des compétences");
        }
        const data = await response.json();
        setSkills(data.skills || []);
      } catch (err: any) {
        console.error("Erreur lors du chargement des compétences:", err);
        setError(err.message || "Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    };
    loadSkills();
  }, []);

  // Organiser les compétences par catégorie
  const skillsByCategory = useMemo(() => {
    const grouped: Record<string, Skill[]> = {};
    skills.forEach(skill => {
      if (!grouped[skill.category]) {
        grouped[skill.category] = [];
      }
      grouped[skill.category].push(skill);
    });
    
    // Convertir en format SkillCategory[]
    return Object.entries(grouped).map(([category, categorySkills]) => ({
      name: categoryNames[category]?.fr || category,
      nameEn: categoryNames[category]?.en || category,
      skills: categorySkills.sort((a, b) => a.nameFr.localeCompare(b.nameFr)),
    }));
  }, [skills]);

  // Filtrer les compétences basé sur la recherche et la catégorie
  const filteredData = useMemo(() => {
    let filtered = skillsByCategory;

    // Filtrer par catégorie si sélectionnée
    if (selectedCategory) {
      filtered = filtered.filter(category => category.name === selectedCategory);
    }

    // Filtrer par terme de recherche
    if (searchTerm) {
      filtered = filtered.map(category => ({
        ...category,
        skills: category.skills.filter(skill =>
          skill.nameFr.toLowerCase().includes(searchTerm.toLowerCase()) ||
          skill.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
          skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (skill.descriptionEn && skill.descriptionEn.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      })).filter(category => category.skills.length > 0);
    }

    return filtered;
  }, [searchTerm, selectedCategory, skillsByCategory]);

  const categories = skillsByCategory.map(category => category.name);

  if (loading) {
    return (
      <div className="w-full">
        <div className="text-center py-12">
          <p className="text-gray-600">Chargement des compétences...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {t.skills.title}
        </h1>
        <p className="text-gray-600 mb-6">
          {t.skills.description}
        </p>

        {/* Barre de recherche */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder={t.skills.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filtres par catégorie */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {language === "fr" ? category : skillsByCategory.find(c => c.name === category)?.nameEn || category}
              </button>
            ))}
          </div>
        </div>

        {/* Statistiques */}
        <div className="mb-6 text-sm text-gray-600">
          {searchTerm || selectedCategory ? (
            <>
              {filteredData.reduce((total, category) => total + category.skills.length, 0)} {t.skills.resultsFound}
              {searchTerm && ` ${t.skills.for} "${searchTerm}"`}
              {selectedCategory && ` ${t.skills.in} "${language === "fr" ? selectedCategory : skillsByCategory.find(c => c.name === selectedCategory)?.nameEn || selectedCategory}"`}
            </>
          ) : (
            t.skills.total.replace("{count}", skills.length.toString())
          )}
        </div>
      </div>

      {/* Liste des compétences par catégorie */}
      <div className="space-y-8">
        {filteredData.map((category) => (
          <div key={category.name} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {language === "fr" ? category.name : category.nameEn}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {category.skills.length} {category.skills.length === 1 ? t.footer.items : t.footer.itemsPlural}
              </p>
            </div>
            <div className="p-6">
              <div className="grid gap-4">
                {category.skills.map((skill) => (
                  <div key={skill.id || skill.slug} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {language === "fr" 
                            ? `${skill.nameFr} (${skill.nameEn})` 
                            : `${skill.nameEn} (${skill.nameFr})`
                          }
                        </h3>
                        <p className="text-gray-700 leading-relaxed">
                          {language === "fr" 
                            ? skill.description 
                            : (skill.descriptionEn || skill.description)
                          }
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          skill.category === "General" ? "bg-blue-100 text-blue-800" :
                          skill.category === "Agility" ? "bg-green-100 text-green-800" :
                          skill.category === "Strength" ? "bg-red-100 text-red-800" :
                          skill.category === "Passing" ? "bg-purple-100 text-purple-800" :
                          skill.category === "Mutations" ? "bg-orange-100 text-orange-800" :
                          skill.category === "Traits" ? "bg-gray-100 text-gray-800" :
                          skill.category === "Extraordinary" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-600"
                        }`}>
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
            {language === "fr" ? "Aucun résultat trouvé pour votre recherche." : "No results found for your search."}
          </div>
          <p className="text-gray-400 mt-2">
            {language === "fr" ? "Essayez de modifier vos critères de recherche." : "Try modifying your search criteria."}
          </p>
        </div>
      )}

      {/* Légende des couleurs */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{language === "fr" ? "Légende des couleurs" : "Color Legend"}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
          {language === "fr" 
            ? "Les compétences marquées " 
            : "Skills marked "
          }
          <span className="text-red-600 font-semibold">
            ({language === "fr" ? "Obligatoire" : "Compulsory"})
          </span>
          {language === "fr" 
            ? " doivent être utilisées quand les conditions sont remplies."
            : " must be used when conditions are met."
          }
        </div>
      </div>
    </div>
  );
}