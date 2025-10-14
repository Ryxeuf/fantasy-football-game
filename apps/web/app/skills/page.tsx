"use client";
import { useState, useMemo } from "react";

// Types pour les compétences et traits
interface Skill {
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: string;
  isCompulsory?: boolean;
}

interface SkillCategory {
  name: string;
  nameEn: string;
  skills: Skill[];
}

// Données des compétences organisées par catégories
const skillsData: SkillCategory[] = [
  {
    name: "Compétences d'Agilité",
    nameEn: "Agility Skills",
    skills: [
      {
        name: "Attraper",
        nameEn: "Catch",
        description: "Ce joueur peut relancer un test d'Agilité raté lorsqu'il tente d'attraper le ballon.",
        descriptionEn: "This player may re-roll a failed Agility test when attempting to catch the ball.",
        category: "Agility"
      },
      {
        name: "Plongée",
        nameEn: "Diving Catch",
        description: "Ce joueur peut tenter d'attraper le ballon si une passe, remise en jeu ou coup d'envoi le fait atterrir dans une case de sa Zone de Tackle après dispersion ou déviation.",
        descriptionEn: "This player may attempt to catch the ball if a pass, throw-in or kick-off causes it to land in a square within their Tackle Zone after scattering or deviating.",
        category: "Agility"
      },
      {
        name: "Esquive",
        nameEn: "Dodge",
        description: "Une fois par tour d'équipe, pendant son activation, ce joueur peut relancer un test d'Agilité raté lorsqu'il tente d'Esquiver.",
        descriptionEn: "Once per team turn, during their activation, this player may re-roll a failed Agility test when attempting to Dodge.",
        category: "Agility"
      },
      {
        name: "Saut",
        nameEn: "Jump Up",
        description: "Si ce joueur est à Terre, il peut se relever gratuitement.",
        descriptionEn: "If this player is Prone they may stand up for free.",
        category: "Agility"
      }
    ]
  },
  {
    name: "Compétences Générales",
    nameEn: "General Skills",
    skills: [
      {
        name: "Bloc",
        nameEn: "Block",
        description: "Lorsqu'un résultat Double à Terre est appliqué pendant une action de Bloc, ce joueur peut choisir de l'ignorer.",
        descriptionEn: "When a Both Down result is applied during a Block action, this player may choose to ignore it.",
        category: "General"
      },
      {
        name: "Intrépide",
        nameEn: "Dauntless",
        description: "Lorsque ce joueur effectue une action de Bloc, si la cible a une Force plus élevée, lancez un D6.",
        descriptionEn: "When this player performs a Block action, if the target has higher Strength, roll a D6.",
        category: "General"
      },
      {
        name: "Frénésie",
        nameEn: "Frenzy",
        description: "Chaque fois que ce joueur effectue une action de Bloc, il doit suivre si la cible est repoussée.",
        descriptionEn: "Each time this player performs a Block action, they must follow if the target is pushed back.",
        category: "General",
        isCompulsory: true
      }
    ]
  },
  {
    name: "Mutations",
    nameEn: "Mutations",
    skills: [
      {
        name: "Grande Main",
        nameEn: "Big Hand",
        description: "Ce joueur peut ignorer tout modificateur pour être Marquage lorsqu'il tente de ramasser le ballon.",
        descriptionEn: "This player may ignore any modifier for being Marked when attempting to pick up the ball.",
        category: "Mutations"
      },
      {
        name: "Griffes",
        nameEn: "Claws",
        description: "Lorsque vous faites un jet d'Armure contre un joueur adverse Renversé, un jet de 8+ brisera son armure.",
        descriptionEn: "When you make an Armour roll against an opposition player that has been Knocked Down, a roll of 8+ will break their armour.",
        category: "Mutations"
      }
    ]
  },
  {
    name: "Compétences de Passe",
    nameEn: "Passing Skills",
    skills: [
      {
        name: "Précision",
        nameEn: "Accurate",
        description: "Lorsque ce joueur effectue une Passe Rapide ou Courte, vous pouvez appliquer un modificateur +1.",
        descriptionEn: "When this player performs a Quick Pass or Short Pass, you may apply a +1 modifier.",
        category: "Passing"
      },
      {
        name: "Canonnier",
        nameEn: "Cannon",
        description: "Lorsque ce joueur effectue une Passe Longue ou Longue Bombe, vous pouvez appliquer un modificateur +1.",
        descriptionEn: "When this player performs a Long Pass or Long Bomb, you may apply a +1 modifier.",
        category: "Passing"
      }
    ]
  },
  {
    name: "Compétences de Force",
    nameEn: "Strength Skills",
    skills: [
      {
        name: "Garde",
        nameEn: "Guard",
        description: "Ce joueur peut offrir des assistances offensives et défensives peu importe combien de joueurs adverses le Marquage.",
        descriptionEn: "This player may offer offensive and defensive assists regardless of how many opposition players are Marking them.",
        category: "Strength"
      },
      {
        name: "Tenir Bon",
        nameEn: "Stand Firm",
        description: "Ce joueur peut choisir de ne pas être repoussé, soit à la suite d'une action de Bloc, soit par un repoussement en chaîne.",
        descriptionEn: "This player may choose not to be pushed back, either as a result of a Block action or by a chain-push.",
        category: "Strength"
      }
    ]
  },
  {
    name: "Traits",
    nameEn: "Traits",
    skills: [
      {
        name: "Sauvagerie Animale",
        nameEn: "Animal Savagery",
        description: "Lorsque ce joueur est activé, lancez un D6 après avoir déclaré l'action.",
        descriptionEn: "When this player is activated, roll a D6 after declaring the action.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Bombardier",
        nameEn: "Bombardier",
        description: "Lorsqu'il est activé et s'il est Debout, ce joueur peut effectuer une action Spéciale 'Lancer de Bombe'.",
        descriptionEn: "When activated and if Standing, this player may perform a Special 'Bomb' action.",
        category: "Traits"
      }
    ]
  },
  {
    name: "Extraordinaires",
    nameEn: "Extraordinary",
    skills: [
      {
        name: "Frappe et Cours",
        nameEn: "Hit and Run",
        description: "Après qu'un joueur avec ce trait ait effectué une action de Bloc, il peut immédiatement bouger d'une case gratuite.",
        descriptionEn: "After a player with this trait has performed a Block action, they may immediately move one square for free.",
        category: "Extraordinary"
      },
      {
        name: "Mon Ballon",
        nameEn: "My Ball",
        description: "Un joueur avec ce trait ne peut pas abandonner volontairement le ballon quand il en est en possession.",
        descriptionEn: "A player with this trait cannot voluntarily give up the ball when they are in possession of it.",
        category: "Extraordinary"
      }
    ]
  }
];

export default function SkillsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [language, setLanguage] = useState<"fr" | "en">("fr");

  // Filtrer les compétences basé sur la recherche et la catégorie
  const filteredData = useMemo(() => {
    let filtered = skillsData;

    // Filtrer par catégorie si sélectionnée
    if (selectedCategory) {
      filtered = filtered.filter(category => category.name === selectedCategory);
    }

    // Filtrer par terme de recherche
    if (searchTerm) {
      filtered = filtered.map(category => ({
        ...category,
        skills: category.skills.filter(skill =>
          skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          skill.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
          skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          skill.descriptionEn.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })).filter(category => category.skills.length > 0);
    }

    return filtered;
  }, [searchTerm, selectedCategory]);

  const categories = skillsData.map(category => category.name);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {language === "fr" ? "Compétences, Mutations et Traits" : "Skills, Mutations and Traits"}
        </h1>
        <p className="text-gray-600 mb-6">
          {language === "fr" 
            ? "Découvrez toutes les compétences, mutations et traits disponibles dans Blood Bowl, organisés par catégories avec leurs descriptions complètes."
            : "Discover all skills, mutations and traits available in Blood Bowl, organized by categories with their complete descriptions."
          }
        </p>

        {/* Sélecteur de langue */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">{language === "fr" ? "Langue :" : "Language:"}</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setLanguage("fr")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  language === "fr"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Français
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  language === "en"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                English
              </button>
            </div>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder={language === "fr" ? "Rechercher une compétence, mutation ou trait..." : "Search for a skill, mutation or trait..."}
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
              {language === "fr" ? "Toutes les catégories" : "All categories"}
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
                {language === "fr" ? category : skillsData.find(c => c.name === category)?.nameEn}
              </button>
            ))}
          </div>
        </div>

        {/* Statistiques */}
        <div className="mb-6 text-sm text-gray-600">
          {searchTerm || selectedCategory ? (
            <>
              {filteredData.reduce((total, category) => total + category.skills.length, 0)} {language === "fr" ? "résultat(s) trouvé(s)" : "result(s) found"}
              {searchTerm && ` ${language === "fr" ? "pour" : "for"} "${searchTerm}"`}
              {selectedCategory && ` ${language === "fr" ? "dans" : "in"} "${language === "fr" ? selectedCategory : skillsData.find(c => c.name === selectedCategory)?.nameEn}"`}
            </>
          ) : (
            `${skillsData.reduce((total, category) => total + category.skills.length, 0)} ${language === "fr" ? "compétences, mutations et traits au total" : "skills, mutations and traits in total"}`
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
                {category.skills.length} {language === "fr" ? (category.skills.length === 1 ? 'élément' : 'éléments') : (category.skills.length === 1 ? 'item' : 'items')}
              </p>
            </div>
            <div className="p-6">
              <div className="grid gap-4">
                {category.skills.map((skill) => (
                  <div key={skill.name} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {language === "fr" ? skill.name : skill.nameEn}
                          {skill.isCompulsory && (
                            <span className="ml-2 text-red-600 text-sm font-normal">
                              ({language === "fr" ? "Obligatoire" : "Compulsory"})
                            </span>
                          )}
                        </h3>
                        <p className="text-gray-700 leading-relaxed">
                          {language === "fr" ? skill.description : skill.descriptionEn}
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