/**
 * Utilitaire pour exporter un roster d'équipe en PDF
 */

import { getDisplayName, getDisplayNames, getRerollCost, parseSkillSlugs, getSkillBySlug } from '@bb/game-engine';

interface TeamData {
  name: string;
  roster: string;
  players: any[];
  initialBudget?: number;
  teamValue?: number;
  treasury?: number;
  rerolls?: number;
  cheerleaders?: number;
  assistants?: number;
  apothecary?: boolean;
  dedicatedFans?: number;
}

const ROSTER_DISPLAY_NAMES: Record<string, string> = {
  skaven: "Skaven",
  lizardmen: "Lizardmen",
  woodelf: "Wood Elf",
  wood_elf: "Wood Elf",
  "wood elf": "Wood Elf",
  darkelf: "Dark Elf",
  dark_elf: "Dark Elf",
  "dark elf": "Dark Elf",
  highelf: "High Elf",
  high_elf: "High Elf",
  "high elf": "High Elf",
  human: "Human",
  orc: "Orc",
  dwarf: "Dwarf",
  chaos: "Chaos",
  undead: "Undead",
  necromantic: "Necromantic Horror",
  norse: "Norse",
  amazon: "Amazon",
  elvenunion: "Elven Union",
  elven_union: "Elven Union",
  underworld: "Underworld Denizens",
  vampire: "Vampire",
  khorne: "Khorne",
  nurgle: "Nurgle",
  chaosdwarf: "Chaos Dwarf",
  chaos_dwarf: "Chaos Dwarf",
  goblin: "Goblin",
  halfling: "Halfling",
  ogre: "Ogre",
  snotling: "Snotling",
  blackorc: "Black Orc",
  black_orc: "Black Orc",
  chaosrenegades: "Chaos Renegades",
  chaos_renegades: "Chaos Renegades",
  oldworldalliance: "Old World Alliance",
  old_world_alliance: "Old World Alliance",
  tombkings: "Tomb Kings",
  tomb_kings: "Tomb Kings",
  imperial: "Imperial Nobility",
  gnome: "Gnome",
};

function getRosterDisplayName(slug: string): string {
  return ROSTER_DISPLAY_NAMES[slug] || slug;
}

export async function exportTeamToPDF(
  team: TeamData,
  getPlayerCost: (position: string, roster: string) => number,
  coachName?: string,
  language: 'fr' | 'en' = 'fr',
) {
  // Import dynamique pour éviter les erreurs SSR
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  
  // Créer un document PDF en format paysage (landscape)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Configuration des couleurs et marges
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Traductions
  const translations = {
    fr: {
      roster: 'Roster',
      team: 'Équipe',
      coach: "NOM DE L'ENTRAÎNEUR",
      rerolls: 'RELANCES',
      teamValue: "VALEUR DE L'ÉQUIPE",
      rosterTotal: 'ROSTER TOTAL',
      treasury: 'TRÉSORERIE',
      assistants: 'ENTRAÎNEURS ADJOINTS',
      cheerleaders: 'POM-POM GIRLS',
      fans: 'FANS DÉVOUÉS',
      apothecary: 'APOTHICAIRE',
      headers: ['#', 'NOM', 'POSITION', 'MA', 'ST', 'AG', 'PA', 'AV', 'COMPÉTENCES ET TRAITS', 'COÛT', 'PSP', 'RPM', 'BP', 'RC', 'VALEUR\nACTUELLE'],
    },
    en: {
      roster: 'Roster',
      team: 'Team',
      coach: "COACH NAME",
      rerolls: 'REROLLS',
      teamValue: 'TEAM VALUE',
      rosterTotal: 'ROSTER TOTAL',
      treasury: 'TREASURY',
      assistants: 'ASSISTANT COACHES',
      cheerleaders: 'CHEERLEADERS',
      fans: 'DEDICATED FANS',
      apothecary: 'APOTHECARY',
      headers: ['#', 'NAME', 'POSITION', 'MA', 'ST', 'AG', 'PA', 'AV', 'SKILLS AND TRAITS', 'COST', 'SPP', 'TDS', 'CAS', 'INT', 'CURRENT\nVALUE'],
    },
  };
  const t = translations[language];

  // En-tête du document
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`BB ${t.roster} - ${team.name}`, margin, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US');
  doc.text(`${t.team} ${getRosterDisplayName(team.roster)} - ${dateStr}`, margin, 22);

  // Calculer les valeurs
  const totalCost = team.players.reduce((sum, p) => sum + getPlayerCost(p.position, team.roster), 0);
  const rerollUnit = getRerollCost(team.roster || '');
  const rerollsCost = (team.rerolls || 0) * rerollUnit;
  const cheerleadersCost = (team.cheerleaders || 0) * 10000;
  const assistantsCost = (team.assistants || 0) * 10000;
  const fansCount = typeof team.dedicatedFans === 'number' ? team.dedicatedFans : 0;
  const fansCost = Math.max(0, fansCount - 1) * 10000;
  const apothecaryCost = team.apothecary ? 50000 : 0;

  const rosterTotal = totalCost + rerollsCost + cheerleadersCost + assistantsCost + fansCost + apothecaryCost;
  const treasury = (team.initialBudget || 0) * 1000 - rosterTotal;

  // Préparer les données du tableau des joueurs
  const playersData = team.players
    .sort((a, b) => a.number - b.number)
    .map(player => {
      // Formater les compétences sur plusieurs lignes si nécessaire
      const skills = player.skills || '';
      // Convertir les slugs en noms selon la langue
      const skillsArray = getDisplayNames(skills, language);
      const skillsText = skillsArray.join(', ');

      return [
        player.number.toString(),
        player.name,
        getDisplayName(player.position),
        player.ma.toString(),
        player.st.toString(),
        `${player.ag}+`,
        player.pa ? `${player.pa}+` : '-',
        `${player.av}+`,
        skillsText,
        `${Math.round(getPlayerCost(player.position, team.roster) / 1000)}`,
        '', // PSP
        '', // RPM
        '', // BP
        '', // RC
        `${Math.round(getPlayerCost(player.position, team.roster) / 1000)}`, // Valeur actuelle
      ];
    });

  // Créer le tableau des joueurs
  autoTable(doc, {
    startY: 28,
    head: [t.headers],
    body: playersData,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 }, // #
      1: { halign: 'left', cellWidth: 'auto' }, // NOM
      2: { halign: 'left', cellWidth: 'auto' }, // POSITION
      3: { halign: 'center', cellWidth: 8 }, // MA
      4: { halign: 'center', cellWidth: 8 }, // ST
      5: { halign: 'center', cellWidth: 8 }, // AG
      6: { halign: 'center', cellWidth: 8 }, // PA
      7: { halign: 'center', cellWidth: 8 }, // AV
      8: { halign: 'left', cellWidth: 'auto' }, // COMPÉTENCES
      9: { halign: 'right', cellWidth: 12 }, // COÛT
      10: { halign: 'center', cellWidth: 10 }, // PSP
      11: { halign: 'center', cellWidth: 10 }, // RPM
      12: { halign: 'center', cellWidth: 10 }, // BP
      13: { halign: 'center', cellWidth: 10 }, // RC
      14: { halign: 'right', cellWidth: 15 }, // VALEUR ACTUELLE
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      // Permettre le retour à la ligne pour les compétences
      if (data.column.index === 8) { // Colonne COMPÉTENCES
        data.cell.styles.cellWidth = 'wrap';
      }
    },
  });

  // Obtenir la position après le tableau
  const finalY = (doc as any).lastAutoTable.finalY || 120;

  // Ajouter les informations supplémentaires de l'équipe dans un tableau
  // Tableau d'infos d'équipe compact (colonnes condensées)
  const teamInfoData = [
    [
      t.coach,
      coachName || '',
      t.rerolls,
      `${team.rerolls || 0} / 8`,
      `${Math.round(rerollsCost / 1000)}000`,
    ],
    [
      t.teamValue,
      `${Math.round((team.teamValue || 0) / 1000)}000`,
      t.assistants,
      `${team.assistants || 0} / 6`,
      `${Math.round(assistantsCost / 1000)}000`,
    ],
    [
      t.rosterTotal,
      `${Math.round(rosterTotal / 1000)}000`,
      t.cheerleaders,
      `${team.cheerleaders || 0} / 12`,
      `${Math.round(cheerleadersCost / 1000)}000`,
    ],
    [
      t.treasury,
      `${Math.round(treasury / 1000)}000`,
      t.fans,
      `${fansCount} / 6`,
      `${Math.round(fansCost / 1000)}000`,
    ],
    ['', '', t.apothecary, team.apothecary ? '1 / 1' : '0 / 1', `${Math.round(apothecaryCost / 1000)}000`],
  ];

  autoTable(doc, {
    startY: finalY + 5,
    body: teamInfoData,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 40, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 35 },
      2: { halign: 'left', cellWidth: 35, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 20 },
    },
    // Poser le tableau compact sur une seule colonne à gauche
    margin: { left: margin, right: pageWidth / 2 + 10 },
  });

  // Sauvegarder le PDF
  const fileName = `${team.name.replace(/[^a-z0-9]/gi, '_')}_roster.pdf`;
  doc.save(fileName);
}

/**
 * Exporte une feuille récapitulative des compétences de l'équipe
 * Liste toutes les compétences avec leur description et les joueurs qui les possèdent
 */
export async function exportSkillsSheet(
  team: TeamData,
  language: 'fr' | 'en' = 'fr',
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  const translations = {
    fr: {
      title: 'Feuille récapitulative des compétences',
      team: 'Équipe',
      skill: 'Compétence',
      description: 'Description',
      players: 'Joueurs ayant cette compétence',
      number: '#',
      name: 'Nom',
      position: 'Position',
    },
    en: {
      title: 'Skills summary sheet',
      team: 'Team',
      skill: 'Skill',
      description: 'Description',
      players: 'Players with this skill',
      number: '#',
      name: 'Name',
      position: 'Position',
    },
  };
  const t = translations[language];

  // En-tête
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(t.title, margin, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${t.team}: ${team.name}`, margin, 28);
  doc.text(`${t.team} ${getRosterDisplayName(team.roster)}`, margin, 34);
  
  const dateStr = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US');
  doc.setFontSize(10);
  doc.text(dateStr, margin, 40);

  // Charger les compétences depuis l'API pour obtenir les descriptions en anglais
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';
  let apiSkills: Array<{ slug: string; nameFr: string; nameEn: string; description: string; descriptionEn?: string | null; category: string }> = [];
  
  try {
    const response = await fetch(`${API_BASE}/api/skills`);
    if (response.ok) {
      const data = await response.json();
      apiSkills = data.skills || [];
    }
  } catch (error) {
    console.warn('Impossible de charger les compétences depuis l\'API, utilisation du game-engine uniquement', error);
  }

  // Traductions des catégories
  const categoryTranslations = {
    fr: {
      General: 'Général',
      Agility: 'Agilité',
      Strength: 'Force',
      Passing: 'Passe',
      Mutation: 'Mutation',
      Trait: 'Trait',
    },
    en: {
      General: 'General',
      Agility: 'Agility',
      Strength: 'Strength',
      Passing: 'Passing',
      Mutation: 'Mutation',
      Trait: 'Trait',
    },
  };
  const catT = categoryTranslations[language];

  // Collecter toutes les compétences avec les joueurs qui les possèdent
  const skillsMap = new Map<string, { skill: { nameFr: string; nameEn: string; description: string; category: string }, players: Array<{ number: number; name: string; position: string }> }>();
  
  team.players.forEach(player => {
    const skillsString = player.skills || '';
    const skillSlugs = parseSkillSlugs(skillsString);
    
    skillSlugs.forEach(slug => {
      // Chercher d'abord dans l'API
      const apiSkill = apiSkills.find(s => s.slug === slug);
      const skillDef = apiSkill ? null : getSkillBySlug(slug);
      
      if (apiSkill || skillDef) {
        if (!skillsMap.has(slug)) {
          if (apiSkill) {
            skillsMap.set(slug, {
              skill: {
                nameFr: apiSkill.nameFr,
                nameEn: apiSkill.nameEn,
                description: language === 'en' && apiSkill.descriptionEn ? apiSkill.descriptionEn : apiSkill.description,
                category: apiSkill.category
              },
              players: []
            });
          } else if (skillDef) {
            skillsMap.set(slug, {
              skill: {
                nameFr: skillDef.nameFr,
                nameEn: skillDef.nameEn,
                description: skillDef.description, // Fallback: description FR seulement depuis game-engine
                category: skillDef.category
              },
              players: []
            });
          }
        }
        skillsMap.get(slug)!.players.push({
          number: player.number,
          name: player.name,
          position: getDisplayName(player.position)
        });
      }
    });
  });

  // Trier les compétences par nom (dans la langue sélectionnée)
  const skillsArray = Array.from(skillsMap.entries())
    .map(([slug, data]) => ({
      slug,
      name: language === 'fr' ? data.skill.nameFr : data.skill.nameEn,
      description: data.skill.description,
      category: data.skill.category,
      categoryLabel: catT[data.skill.category as keyof typeof catT] || data.skill.category,
      players: data.players.sort((a, b) => a.number - b.number)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, language === 'fr' ? 'fr' : 'en'));

  let currentY = 45;
  const lineHeight = 5;
  const skillSpacing = 3;

  // Parcourir chaque compétence
  skillsArray.forEach((skillData, index) => {
    // Vérifier si on a besoin d'une nouvelle page
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 20;
    }

    // Nom de la compétence avec catégorie
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const skillNameWithCategory = `${skillData.name} (${skillData.categoryLabel})`;
    doc.text(skillNameWithCategory, margin, currentY);
    currentY += lineHeight + 2;

    // Description
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const descriptionLines = doc.splitTextToSize(skillData.description, pageWidth - 2 * margin);
    doc.text(descriptionLines, margin, currentY);
    currentY += descriptionLines.length * lineHeight + 2;

    // Liste des joueurs
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`${t.players}:`, margin, currentY);
    currentY += lineHeight;

    doc.setFont('helvetica', 'normal');
    const playersText = skillData.players
      .map(p => `#${p.number} ${p.name} (${p.position})`)
      .join(', ');
    const playersLines = doc.splitTextToSize(playersText, pageWidth - 2 * margin);
    doc.text(playersLines, margin + 5, currentY);
    currentY += playersLines.length * lineHeight + skillSpacing;

    // Ligne de séparation
    if (index < skillsArray.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.line(margin, currentY - 1, pageWidth - margin, currentY - 1);
      currentY += 2;
    }
  });

  const fileName = `${team.name.replace(/[^a-z0-9]/gi, '_')}_skills.pdf`;
  doc.save(fileName);
}

/**
 * Exporte une feuille de match pour l'équipe
 */
export async function exportMatchSheet(
  team: TeamData,
  language: 'fr' | 'en' = 'fr',
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const translations = {
    fr: {
      title: 'Feuille de match',
      team: 'Équipe',
      opponent: 'Adversaire',
      date: 'Date',
      player: 'Joueur',
      position: 'Position',
      number: '#',
      name: 'Nom',
      ma: 'MA',
      st: 'ST',
      ag: 'AG',
      pa: 'PA',
      av: 'AV',
      skills: 'Compétences',
      spp: 'PSP',
      tds: 'RPM',
      cas: 'BP',
      int: 'RC',
      mv: 'MV',
      notes: 'Notes',
    },
    en: {
      title: 'Match sheet',
      team: 'Team',
      opponent: 'Opponent',
      date: 'Date',
      player: 'Player',
      position: 'Position',
      number: '#',
      name: 'Name',
      ma: 'MA',
      st: 'ST',
      ag: 'AG',
      pa: 'PA',
      av: 'AV',
      skills: 'Skills',
      spp: 'SPP',
      tds: 'TDS',
      cas: 'CAS',
      int: 'INT',
      mv: 'MV',
      notes: 'Notes',
    },
  };
  const t = translations[language];

  // En-tête
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(t.title, margin, 15);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${t.team}: ${team.name}`, margin, 22);
  doc.text(`${t.opponent}: ________________`, margin + 80, 22);
  doc.text(`${t.date}: ${new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}`, pageWidth - margin - 50, 22);

  // Tableau des joueurs pour le match
  const playersData = team.players
    .sort((a, b) => a.number - b.number)
    .map(player => {
      const skills = player.skills || '';
      const skillsArray = getDisplayNames(skills, language);
      const skillsText = skillsArray.length > 0 ? skillsArray.join(', ') : '-';
      
      return [
        player.number.toString(),
        player.name,
        getDisplayName(player.position),
        player.ma.toString(),
        player.st.toString(),
        `${player.ag}+`,
        player.pa ? `${player.pa}+` : '-',
        `${player.av}+`,
        skillsText,
        '', // PSP
        '', // RPM
        '', // BP
        '', // RC
        '', // MV
        '', // Notes
      ];
    });

  // Tableau principal
  autoTable(doc, {
    startY: 28,
    head: [[t.number, t.name, t.position, t.ma, t.st, t.ag, t.pa, t.av, t.skills, t.spp, t.tds, t.cas, t.int, t.mv, t.notes]],
    body: playersData,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 25 },
      2: { halign: 'left', cellWidth: 25 },
      3: { halign: 'center', cellWidth: 8 },
      4: { halign: 'center', cellWidth: 8 },
      5: { halign: 'center', cellWidth: 8 },
      6: { halign: 'center', cellWidth: 8 },
      7: { halign: 'center', cellWidth: 8 },
      8: { halign: 'left', cellWidth: 40 },
      9: { halign: 'center', cellWidth: 10 },
      10: { halign: 'center', cellWidth: 10 },
      11: { halign: 'center', cellWidth: 10 },
      12: { halign: 'center', cellWidth: 10 },
      13: { halign: 'center', cellWidth: 10 },
      14: { halign: 'left', cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.column.index === 8 || data.column.index === 14) {
        data.cell.styles.cellWidth = 'wrap';
      }
    },
  });

  const fileName = `${team.name.replace(/[^a-z0-9]/gi, '_')}_match.pdf`;
  doc.save(fileName);
}

