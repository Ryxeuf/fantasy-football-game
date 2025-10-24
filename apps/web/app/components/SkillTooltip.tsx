"use client";
import { useState } from "react";
import { getSkillDescription } from "../me/teams/skills-data";

interface SkillTooltipProps {
  skillSlug: string;
  className?: string;
}

export default function SkillTooltip({ skillSlug, className = "" }: SkillTooltipProps) {
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (event: React.MouseEvent) => {
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

  const skillDescription = hoveredSkill ? getSkillDescription(hoveredSkill) : null;

  // Fonction pour obtenir la couleur selon la catégorie
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "General": return "bg-blue-100 text-blue-800";
      case "Agility": return "bg-green-100 text-green-800";
      case "Strength": return "bg-red-100 text-red-800";
      case "Passing": return "bg-purple-100 text-purple-800";
      case "Mutation": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const skillInfo = getSkillDescription(skillSlug);
  const displayName = skillInfo?.name || skillSlug;
  const categoryColor = skillInfo ? getCategoryColor(skillInfo.category) : "bg-gray-100 text-gray-600";

  return (
    <div className="relative">
      <span
        className={`px-3 py-2 rounded-full text-sm font-medium cursor-help border border-gray-300 hover:shadow-md transition-shadow ${categoryColor} ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {displayName}
      </span>

      {/* Tooltip */}
      {hoveredSkill && skillDescription && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-sm rounded-lg shadow-lg p-3 max-w-xs pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateX(-50%) translateY(-100%)',
          }}
        >
          <div className="font-semibold text-blue-300 mb-1">
            {skillDescription.name}
          </div>
          <div className="text-gray-200 text-xs leading-relaxed">
            {skillDescription.description}
          </div>
          <div className="text-gray-400 text-xs mt-1">
            Catégorie: {skillDescription.category}
          </div>
          
          {/* Flèche vers le bas */}
          <div 
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
          />
        </div>
      )}
    </div>
  );
}
