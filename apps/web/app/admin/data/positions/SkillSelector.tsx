"use client";
import { useState, useMemo, useEffect, useRef } from "react";

type Skill = {
  slug: string;
  nameFr: string;
  nameEn: string;
  category: string;
};

type SkillSelectorProps = {
  skills: Skill[];
  selectedSlugs: string[];
  onChange: (slugs: string[]) => void;
};

const categoryColors: Record<string, string> = {
  General: "bg-blue-100 text-blue-800 border-blue-300",
  Agility: "bg-green-100 text-green-800 border-green-300",
  Strength: "bg-red-100 text-red-800 border-red-300",
  Passing: "bg-purple-100 text-purple-800 border-purple-300",
  Mutation: "bg-orange-100 text-orange-800 border-orange-300",
  Trait: "bg-gray-100 text-gray-800 border-gray-300",
};

const categoryLabels: Record<string, string> = {
  General: "Général",
  Agility: "Agilité",
  Strength: "Force",
  Passing: "Passe",
  Mutation: "Mutation",
  Trait: "Trait",
};

export default function SkillSelector({ skills, selectedSlugs, onChange }: SkillSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // S'assurer que skills est toujours un tableau
  const safeSkills = Array.isArray(skills) ? skills : [];

  const selectedSkills = useMemo(() => {
    return safeSkills.filter((skill) => selectedSlugs.includes(skill.slug));
  }, [safeSkills, selectedSlugs]);

  const availableSkills = useMemo(() => {
    let filtered = safeSkills.filter((skill) => !selectedSlugs.includes(skill.slug));

    // Filtre par catégorie
    if (selectedCategory !== "all") {
      filtered = filtered.filter((skill) => skill.category === selectedCategory);
    }

    // Filtre par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (skill) =>
          (skill.nameFr?.toLowerCase().includes(query)) ||
          (skill.nameEn?.toLowerCase().includes(query)) ||
          (skill.slug?.toLowerCase().includes(query))
      );
    }

    return filtered.sort((a, b) => (a.nameFr || a.slug || "").localeCompare(b.nameFr || b.slug || ""));
  }, [safeSkills, selectedSlugs, selectedCategory, searchQuery]);

  const skillsByCategory = useMemo(() => {
    const grouped: Record<string, Skill[]> = {};
    availableSkills.forEach((skill) => {
      if (!grouped[skill.category]) {
        grouped[skill.category] = [];
      }
      grouped[skill.category].push(skill);
    });
    return grouped;
  }, [availableSkills]);

  const categories = useMemo(() => {
    return Array.from(new Set(safeSkills.map((s) => s.category).filter(Boolean))).sort();
  }, [safeSkills]);

  const handleAddSkill = (slug: string) => {
    if (!selectedSlugs.includes(slug)) {
      onChange([...selectedSlugs, slug]);
    }
    setSearchQuery("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemoveSkill = (slug: string) => {
    onChange(selectedSlugs.filter((s) => s !== slug));
  };

  // Fermer le dropdown avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showDropdown) {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showDropdown]);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  return (
    <div className="space-y-4">
      {/* Compétences sélectionnées */}
      <div>
        <label className="block text-sm font-medium mb-2">Compétences sélectionnées</label>
        {selectedSkills.length === 0 ? (
          <div className="text-sm text-gray-500 italic p-3 border border-dashed border-gray-300 rounded">
            Aucune compétence sélectionnée
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded bg-gray-50 min-h-[60px]">
            {selectedSkills.map((skill) => (
              <span
                key={skill.slug}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${categoryColors[skill.category] || categoryColors.General}`}
              >
                {skill.nameFr || skill.slug}
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill.slug)}
                  className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
                  title="Retirer cette compétence"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Recherche et sélection */}
      <div className="relative">
        <label className="block text-sm font-medium mb-2">Ajouter une compétence</label>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Rechercher une compétence..."
            className="w-full border rounded px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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

        {/* Filtres par catégorie */}
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              selectedCategory === "all"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Toutes
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                selectedCategory === category
                  ? `${categoryColors[category]?.split(" ")[0] || "bg-blue-100"} ${categoryColors[category]?.split(" ")[1] || "text-blue-800"} border-current font-medium`
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {categoryLabels[category] || category}
            </button>
          ))}
        </div>

        {/* Dropdown avec suggestions */}
        {showDropdown && availableSkills.length > 0 && (
          <div ref={dropdownRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-96 overflow-y-auto">
            {selectedCategory === "all" ? (
              categories.map((category) => {
                const categorySkills = skillsByCategory[category];
                if (!categorySkills || categorySkills.length === 0) return null;
                return (
                  <div key={category} className="border-b border-gray-200 last:border-b-0">
                    <div className={`px-3 py-2 text-xs font-semibold uppercase ${categoryColors[category]?.split(" ")[0]}`}>
                      {categoryLabels[category] || category}
                    </div>
                    <div className="divide-y divide-gray-100">
                      {categorySkills.map((skill) => (
                        <button
                          key={skill.slug}
                          type="button"
                          onClick={() => handleAddSkill(skill.slug)}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                        >
                          <div>
                            <div className="font-medium text-gray-900">{skill.nameFr || skill.slug}</div>
                            {skill.nameEn && (
                              <div className="text-xs text-gray-500">{skill.nameEn}</div>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded border ${categoryColors[skill.category] || categoryColors.General} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            {categoryLabels[skill.category] || skill.category}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="divide-y divide-gray-100">
                {availableSkills.map((skill) => (
                  <button
                    key={skill.slug}
                    type="button"
                    onClick={() => handleAddSkill(skill.slug)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                  >
                      <div>
                        <div className="font-medium text-gray-900">{skill.nameFr || skill.slug}</div>
                        {skill.nameEn && (
                          <div className="text-xs text-gray-500">{skill.nameEn}</div>
                        )}
                      </div>
                    <span className={`text-xs px-2 py-0.5 rounded border ${categoryColors[skill.category] || categoryColors.General} opacity-0 group-hover:opacity-100 transition-opacity`}>
                      {categoryLabels[skill.category] || skill.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showDropdown && availableSkills.length === 0 && searchQuery && (
          <div ref={dropdownRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg p-4 text-center text-gray-500">
            Aucune compétence trouvée
          </div>
        )}
      </div>
    </div>
  );
}

