"use client";
import { useState } from "react";
import { getSkillDescription, parseSkills, slugsToDisplayNames } from "../skills-data";
import { separateSkills } from "../base-skills-data";
import { useLanguage } from "../../../contexts/LanguageContext";

interface SkillTooltipProps {
  skillsString: string;  // Chaîne de slugs séparés par des virgules (ex: "block,dodge,leap")
  teamName?: string;
  position?: string;     // Slug de la position (ex: "skaven_thrower")
  className?: string;
}

export default function SkillTooltip({ skillsString, teamName, position, className = "" }: SkillTooltipProps) {
  const { language } = useLanguage();
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Parser les slugs de compétences
  const skillSlugs = parseSkills(skillsString);
  
  // Séparer les compétences de base et acquises si on a une position
  let baseSkillSlugs: string[] = [];
  let acquiredSkillSlugs: string[] = [];
  
  if (position && skillSlugs.length > 0) {
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

  const handleMouseEnter = (skillSlug: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setHoveredSkill(skillSlug);
  };

  const handleMouseLeave = () => {
    setHoveredSkill(null);
  };

  const skillDescription = hoveredSkill ? getSkillDescription(hoveredSkill, language) : null;

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
          const skillInfo = getSkillDescription(skillSlug, language);
          const displayName = skillInfo?.name || skillSlug;
          const categoryColor = skillInfo ? getCategoryColor(skillInfo.category) : "bg-gray-100 text-gray-600";
          const baseSkillText = language === "fr" ? "Compétence de base" : "Base skill";

          return (
            <span
              key={`base-${skillSlug}-${index}`}
              className={`px-2 py-1 rounded text-xs font-medium cursor-help border border-gray-300 ${categoryColor}`}
              onMouseEnter={(e) => handleMouseEnter(skillSlug, e)}
              onMouseLeave={handleMouseLeave}
              title={`${skillInfo?.description || displayName} (${baseSkillText})`}
            >
              {displayName}
            </span>
          );
        })}
        
        {/* Compétences acquises */}
        {acquiredSkillSlugs.map((skillSlug, index) => {
          const skillInfo = getSkillDescription(skillSlug, language);
          const displayName = skillInfo?.name || skillSlug;
          const categoryColor = skillInfo ? getCategoryColor(skillInfo.category) : "bg-gray-100 text-gray-600";
          const acquiredSkillText = language === "fr" ? "Compétence acquise" : "Acquired skill";

          return (
            <span
              key={`acquired-${skillSlug}-${index}`}
              className={`px-2 py-1 rounded text-xs font-medium cursor-help border-2 border-orange-400 ${categoryColor}`}
              onMouseEnter={(e) => handleMouseEnter(skillSlug, e)}
              onMouseLeave={handleMouseLeave}
              title={`${skillInfo?.description || displayName} (${acquiredSkillText})`}
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
            {skillDescription.category}
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
