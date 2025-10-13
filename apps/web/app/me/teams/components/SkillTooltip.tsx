"use client";
import { useState } from "react";
import { getSkillDescription, parseSkills, type SkillDescription } from "../skills-data";
import { separateSkills, getBaseSkills } from "../base-skills-data";

interface SkillTooltipProps {
  skillsString: string;
  teamName?: string;
  position?: string;
  className?: string;
}

export default function SkillTooltip({ skillsString, teamName, position, className = "" }: SkillTooltipProps) {
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Utiliser les compétences de base comme source de vérité si disponibles
  const baseSkillsFromData = teamName && position ? getBaseSkills(teamName, position) : [];
  const skillsFromDB = parseSkills(skillsString);
  
  // Si on a des compétences de base définies, les utiliser comme compétences de base
  // Sinon, utiliser la logique de séparation existante
  const { baseSkills, acquiredSkills } = baseSkillsFromData.length > 0
    ? { 
        baseSkills: baseSkillsFromData, 
        acquiredSkills: skillsFromDB.filter(skill => !baseSkillsFromData.includes(skill))
      }
    : teamName && position 
      ? separateSkills(teamName, position, skillsFromDB)
      : { baseSkills: [], acquiredSkills: skillsFromDB };

  // Afficher au moins les compétences de base même si la DB est vide
  const allSkills = [...baseSkills, ...acquiredSkills];
  
  if (allSkills.length === 0) {
    return <span className="text-gray-400 text-sm">Aucune</span>;
  }

  const handleMouseEnter = (skillName: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setHoveredSkill(skillName);
  };

  const handleMouseLeave = () => {
    setHoveredSkill(null);
  };

  const skillDescription = hoveredSkill ? getSkillDescription(hoveredSkill) : null;

  return (
    <div className="relative">
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {/* Compétences de base */}
        {baseSkills.map((skillName, index) => {
          const skillInfo = getSkillDescription(skillName);
          const categoryColor = skillInfo?.category === "General" ? "bg-blue-100 text-blue-800" :
                              skillInfo?.category === "Agility" ? "bg-green-100 text-green-800" :
                              skillInfo?.category === "Strength" ? "bg-red-100 text-red-800" :
                              skillInfo?.category === "Passing" ? "bg-purple-100 text-purple-800" :
                              skillInfo?.category === "Mutation" ? "bg-orange-100 text-orange-800" :
                              skillInfo?.category === "Trait" ? "bg-gray-100 text-gray-800" :
                              "bg-gray-100 text-gray-600";

          return (
            <span
              key={`base-${index}`}
              className={`px-2 py-1 rounded text-xs font-medium cursor-help border border-gray-300 ${categoryColor}`}
              onMouseEnter={(e) => handleMouseEnter(skillName, e)}
              onMouseLeave={handleMouseLeave}
              title={`${skillInfo?.description || skillName} (Compétence de base)`}
            >
              {skillName}
            </span>
          );
        })}
        
        {/* Compétences acquises */}
        {acquiredSkills.map((skillName, index) => {
          const skillInfo = getSkillDescription(skillName);
          const categoryColor = skillInfo?.category === "General" ? "bg-blue-100 text-blue-800" :
                              skillInfo?.category === "Agility" ? "bg-green-100 text-green-800" :
                              skillInfo?.category === "Strength" ? "bg-red-100 text-red-800" :
                              skillInfo?.category === "Passing" ? "bg-purple-100 text-purple-800" :
                              skillInfo?.category === "Mutation" ? "bg-orange-100 text-orange-800" :
                              skillInfo?.category === "Trait" ? "bg-gray-100 text-gray-800" :
                              "bg-gray-100 text-gray-600";

          return (
            <span
              key={`acquired-${index}`}
              className={`px-2 py-1 rounded text-xs font-medium cursor-help border-2 border-yellow-400 ${categoryColor}`}
              onMouseEnter={(e) => handleMouseEnter(skillName, e)}
              onMouseLeave={handleMouseLeave}
              title={`${skillInfo?.description || skillName} (Compétence acquise)`}
            >
              {skillName}
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

