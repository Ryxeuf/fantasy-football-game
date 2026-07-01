"use client";
import { useState } from "react";
import { parseSkillSlugs } from "@bb/game-engine";
import { getSkillDescription, getSkillDescriptionAsync, parseSkills, slugsToDisplayNames } from "../skills-data";
import { separateSkills } from "../base-skills-data";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useSkillsCacheReady } from "../use-skills-cache";
import {
  useSkillsCatalog,
  resolveFromCatalog,
} from "../skills-catalog-context";
import { getSkillCategoryLabel } from "../../../lib/skill-category-labels";

interface SkillTooltipProps {
  skillsString: string;  // Chaîne de slugs séparés par des virgules (ex: "block,dodge,leap")
  teamName?: string;
  position?: string;     // Slug de la position (ex: "skaven_thrower")
  className?: string;
  useDirectParsing?: boolean; // Si true, utilise parseSkillSlugs directement (pour les positions du roster)
  showAsBaseSkillsOnly?: boolean; // Si true, toutes les compétences sont affichées comme compétences de base (pour les définitions de roster)
  // Slugs des compétences PAR DÉFAUT de la position, sourcés depuis la base de
  // données (`Position.skills`). Quand fourni, prioritaire sur la liste
  // hardcodée du game-engine pour distinguer base vs acquise : évite que des
  // compétences par défaut soient affichées par erreur en encadré orange.
  dbBaseSkills?: readonly string[];
}

export default function SkillTooltip({ skillsString, teamName, position, className = "", useDirectParsing = false, showAsBaseSkillsOnly = false, dbBaseSkills }: SkillTooltipProps) {
  const { language } = useLanguage();
  // Catalogue résolu côté serveur (si fourni par la page) : prioritaire sur le
  // cache client async → noms corrects dès le 1er rendu, aucun flash.
  const catalog = useSkillsCatalog();
  // Résolution unifiée : catalogue SSR d'abord, puis fallback cache/game-engine.
  const resolveSkill = (slug: string) =>
    resolveFromCatalog(catalog, slug, language) ??
    getSkillDescription(slug, language);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [skillDescription, setSkillDescription] = useState<{ name: string; description: string; category: string } | null>(null);

  // Précharge le cache API au montage ET force un re-render quand il est prêt,
  // pour que les noms/catégories des badges (getSkillDescription synchrone)
  // reflètent l'API au lieu du fallback game-engine — sinon ils ne se mettaient
  // à jour qu'au premier survol. Voir use-skills-cache.ts.
  useSkillsCacheReady(language);

  // Parser les slugs de compétences
  // Si useDirectParsing est true, on utilise parseSkillSlugs directement (pour les positions du roster)
  // Sinon, on utilise parseSkills qui peut transformer les noms français en slugs (pour les joueurs)
  const skillSlugs = useDirectParsing ? parseSkillSlugs(skillsString) : parseSkills(skillsString);
  
  // Séparer les compétences de base et acquises si on a une position
  let baseSkillSlugs: string[] = [];
  let acquiredSkillSlugs: string[] = [];
  
  // Si showAsBaseSkillsOnly est true, on considère toutes les compétences comme de base
  // (utile pour afficher les définitions de roster où il n'y a pas de compétences acquises)
  if (showAsBaseSkillsOnly) {
    baseSkillSlugs = skillSlugs;
  } else if (dbBaseSkills) {
    // Source de vérité = compétences par défaut de la position en base de
    // données. Une compétence du joueur présente dans cette liste est "de
    // base" (encadré neutre), sinon "acquise" (encadré orange).
    const baseSet = new Set(dbBaseSkills);
    for (const slug of skillSlugs) {
      if (baseSet.has(slug)) baseSkillSlugs.push(slug);
      else acquiredSkillSlugs.push(slug);
    }
  } else if (position && skillSlugs.length > 0) {
    const separated = separateSkills(position, skillSlugs);
    baseSkillSlugs = separated.baseSkills;
    acquiredSkillSlugs = separated.acquiredSkills;
  } else {
    // Si pas de position, tout est considéré comme compétence de base
    baseSkillSlugs = skillSlugs;
  }

  // Si aucune compétence, afficher "Aucune" / "None"
  if (skillSlugs.length === 0) {
    return <span className="text-gray-400 text-sm">{language === "fr" ? "Aucune" : "None"}</span>;
  }

  const handleMouseEnter = async (skillSlug: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setHoveredSkill(skillSlug);

    // Catalogue SSR d'abord (synchrone) ; sinon API async pour la bonne langue.
    const desc =
      resolveFromCatalog(catalog, skillSlug, language) ??
      (await getSkillDescriptionAsync(skillSlug, language));
    setSkillDescription(desc);
  };

  const handleMouseLeave = () => {
    setHoveredSkill(null);
    setSkillDescription(null);
  };

  // Fonction pour obtenir la couleur selon la catégorie
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "General": return "bg-blue-100 text-blue-800";
      case "Agility": return "bg-green-100 text-green-800";
      case "Strength": return "bg-red-100 text-red-800";
      case "Passing": return "bg-purple-100 text-purple-800";
      case "Mutation": return "bg-orange-100 text-orange-800";
      case "Trait": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="relative">
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {/* Compétences de base */}
        {baseSkillSlugs.map((skillSlug, index) => {
          const skillInfo = resolveSkill(skillSlug);
          const displayName = skillInfo?.name || skillSlug;
          const categoryColor = skillInfo ? getCategoryColor(skillInfo.category) : "bg-gray-100 text-gray-600";
          const baseSkillText = language === "fr" ? "Compétence de base" : "Base skill";

          return (
            <span
              key={`base-${skillSlug}-${index}`}
              className={`px-2 py-1 rounded text-xs font-medium cursor-help border border-gray-300 ${categoryColor}`}
              onMouseEnter={(e) => handleMouseEnter(skillSlug, e)}
              onMouseLeave={handleMouseLeave}
            >
              {displayName}
            </span>
          );
        })}
        
        {/* Compétences acquises */}
        {acquiredSkillSlugs.map((skillSlug, index) => {
          const skillInfo = resolveSkill(skillSlug);
          const displayName = skillInfo?.name || skillSlug;
          const categoryColor = skillInfo ? getCategoryColor(skillInfo.category) : "bg-gray-100 text-gray-600";
          const acquiredSkillText = language === "fr" ? "Compétence acquise" : "Acquired skill";

          return (
            <span
              key={`acquired-${skillSlug}-${index}`}
              className={`px-2 py-1 rounded text-xs font-medium cursor-help border-2 border-orange-400 ${categoryColor}`}
              onMouseEnter={(e) => handleMouseEnter(skillSlug, e)}
              onMouseLeave={handleMouseLeave}
            >
              {displayName}
            </span>
          );
        })}
      </div>

      {/* Tooltip */}
      {hoveredSkill && skillDescription && (
        <div
          className="fixed z-50 max-w-sm p-3 bg-gray-900 text-white text-sm rounded shadow-lg pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: "translate(-50%, -100%)"
          }}
        >
          <div className="font-semibold text-yellow-300 mb-1">
            {skillDescription.name}
          </div>
          <div className="text-xs text-gray-300 mb-1">
            {getSkillCategoryLabel(skillDescription.category, language)}
          </div>
          <div className="text-xs leading-relaxed">
            {skillDescription.description}
          </div>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}
