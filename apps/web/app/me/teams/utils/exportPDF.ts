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
 * Format inspiré des feuilles de match officielles Blood Bowl
 */
export async function exportMatchSheet(
  team: TeamData,
  opponentTeam?: TeamData,
  language: 'fr' | 'en' = 'fr',
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  const translations = {
    fr: {
      team1: 'Equipe 1',
      team2: 'Equipe 2',
      name: 'Nom',
      coach: 'Coach',
      popularityFactor: 'Facteur popularité (1d3+Fan dévoués)',
      weather: 'Météo',
      score: 'Score',
      playerNumber: 'N° du Joueur',
      td: 'TD',
      pass: 'Passe',
      elimination: 'Elimination',
      aggression: 'Agression',
      injuries: 'Blessures',
    },
    en: {
      team1: 'Team 1',
      team2: 'Team 2',
      name: 'Name',
      coach: 'Coach',
      popularityFactor: 'Popularity Factor (1d3+Dedicated Fans)',
      weather: 'Weather',
      score: 'Score',
      playerNumber: 'Player #',
      td: 'TD',
      pass: 'Pass',
      elimination: 'Elimination',
      aggression: 'Aggression',
      injuries: 'Injuries',
    },
  };
  const t = translations[language];

  let currentY = margin;

  // Section d'informations générales en haut
  const headerRowHeight = 8;
  const infoRowHeight = 6;
  const headerStartY = currentY;

  // Ligne d'en-tête avec "Equipe 1" et "Equipe 2"
  const col1Width = 60; // Colonne de gauche pour les labels
  const col2Width = (pageWidth - margin - col1Width - margin) / 2; // Colonnes équipes
  const col3Width = col2Width;

  // Dessiner les bordures de la section d'en-tête
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);

  // Ligne d'en-tête principale
  const headerY = headerStartY;
  // Cellule gauche (vide, pour le logo qui n'est pas inclus)
  doc.rect(margin, headerY, col1Width, headerRowHeight);
  
  // Cellule Equipe 1 (fond bleu foncé)
  const team1X = margin + col1Width;
  doc.setFillColor(0, 51, 102); // Bleu foncé
  doc.rect(team1X, headerY, col2Width, headerRowHeight, 'F');
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.rect(team1X, headerY, col2Width, headerRowHeight);
  
  // Cellule Equipe 2 (fond rouge)
  const team2X = team1X + col2Width;
  doc.setFillColor(204, 0, 0); // Rouge
  doc.rect(team2X, headerY, col3Width, headerRowHeight, 'F');
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.rect(team2X, headerY, col3Width, headerRowHeight);

  // Texte "Equipe 1" et "Equipe 2"
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(t.team1, team1X + col2Width / 2, headerY + headerRowHeight / 2 + 2, { align: 'center' });
  doc.text(t.team2, team2X + col3Width / 2, headerY + headerRowHeight / 2 + 2, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Lignes d'informations
  const infoLabels = [
    { key: 'name', label: t.name },
    { key: 'coach', label: t.coach },
    { key: 'popularityFactor', label: t.popularityFactor },
    { key: 'weather', label: t.weather },
    { key: 'score', label: t.score },
  ];

  let infoY = headerY + headerRowHeight;
  infoLabels.forEach((info, index) => {
    // Label à gauche
    doc.rect(margin, infoY, col1Width, infoRowHeight);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(info.label, margin + 2, infoY + infoRowHeight / 2 + 2);
    
    // Cellule Equipe 1
    doc.rect(team1X, infoY, col2Width, infoRowHeight);
    // Remplir avec le nom de l'équipe si c'est la première ligne
    if (info.key === 'name') {
      doc.setFontSize(9);
      doc.text(team.name || '', team1X + 2, infoY + infoRowHeight / 2 + 2);
    }
    
    // Cellule Equipe 2
    doc.rect(team2X, infoY, col3Width, infoRowHeight);
    if (info.key === 'name' && opponentTeam) {
      doc.setFontSize(9);
      doc.text(opponentTeam.name || '', team2X + 2, infoY + infoRowHeight / 2 + 2);
    }
    
    infoY += infoRowHeight;
  });

  currentY = infoY + 5;

  // Tableau des statistiques - Équipe 1
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Équipe 1', pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  const playersData1 = (team.players && Array.isArray(team.players) ? team.players : [])
    .sort((a, b) => a.number - b.number)
    .slice(0, 10) // Limiter à 10 joueurs
    .map(player => [
      '', // N° du Joueur - laisser vide
      '', // TD
      '', // Passe
      '', // Elimination
      '', // Agression
      '', // Blessures
    ]);

  // Ajouter des lignes vides si moins de 10 joueurs
  while (playersData1.length < 10) {
    playersData1.push(['', '', '', '', '', '']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [[t.playerNumber, t.td, t.pass, t.elimination, t.aggression, t.injuries]],
    body: playersData1,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.2,
      textColor: [0, 0, 0], // Par défaut noir, sera modifié dans willDrawCell
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 25 }, // N° du Joueur
      1: { halign: 'center', cellWidth: 20 }, // TD
      2: { halign: 'center', cellWidth: 20 }, // Passe
      3: { halign: 'center', cellWidth: 25 }, // Elimination
      4: { halign: 'center', cellWidth: 25 }, // Agression
      5: { halign: 'center', cellWidth: 30 }, // Blessures
    },
    margin: { left: margin, right: margin },
    willDrawCell: (data) => {
      // Colorier les en-têtes selon l'image
      if (data.section === 'head') {
        if (data.column.index === 0) {
          // N° du Joueur - fond bleu foncé
          doc.setFillColor(0, 51, 102);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
        } else if (data.column.index === 5) {
          // Blessures - fond rouge
          doc.setFillColor(204, 0, 0);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
        } else {
          // Autres colonnes - fond bleu clair
          doc.setFillColor(173, 216, 230);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
        }
      }
    },
    didDrawCell: (data) => {
      // Redessiner le texte en blanc pour les colonnes avec fond sombre
      if (data.section === 'head' && (data.column.index === 0 || data.column.index === 5)) {
        // Effacer le texte noir en redessinant le fond avec les bordures
        if (data.column.index === 0) {
          doc.setFillColor(0, 51, 102);
        } else {
          doc.setFillColor(204, 0, 0);
        }
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'FD');
        
        // Redessiner le texte en blanc
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const text = Array.isArray(data.cell.text) ? data.cell.text[0] : (data.cell.text || '');
        const textX = data.cell.x + data.cell.width / 2;
        const textY = data.cell.y + data.cell.height / 2 + 2;
        doc.text(text, textX, textY, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }
    },
  });

  const finalYTeam1 = (doc as any).lastAutoTable?.finalY || currentY + 50;
  currentY = finalYTeam1 + 8;

  // Tableau des statistiques - Équipe 2
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Équipe 2', pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  const playersData2 = opponentTeam && opponentTeam.players && Array.isArray(opponentTeam.players)
    ? opponentTeam.players
        .sort((a, b) => a.number - b.number)
        .slice(0, 10)
        .map(player => [
          '', // N° du Joueur - laisser vide
          '', // TD
          '', // Passe
          '', // Elimination
          '', // Agression
          '', // Blessures
        ])
    : [];

  // Ajouter des lignes vides si moins de 10 joueurs
  while (playersData2.length < 10) {
    playersData2.push(['', '', '', '', '', '']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [[t.playerNumber, t.td, t.pass, t.elimination, t.aggression, t.injuries]],
    body: playersData2,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.2,
      textColor: [0, 0, 0], // Par défaut noir, sera modifié dans willDrawCell
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 25 }, // N° du Joueur
      1: { halign: 'center', cellWidth: 20 }, // TD
      2: { halign: 'center', cellWidth: 20 }, // Passe
      3: { halign: 'center', cellWidth: 25 }, // Elimination
      4: { halign: 'center', cellWidth: 25 }, // Agression
      5: { halign: 'center', cellWidth: 30 }, // Blessures
    },
    margin: { left: margin, right: margin },
    willDrawCell: (data) => {
      // Colorier les en-têtes selon l'image
      if (data.section === 'head') {
        if (data.column.index === 0) {
          // N° du Joueur - fond bleu foncé
          doc.setFillColor(0, 51, 102);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
        } else if (data.column.index === 5) {
          // Blessures - fond rouge
          doc.setFillColor(204, 0, 0);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
        } else {
          // Autres colonnes - fond bleu clair
          doc.setFillColor(173, 216, 230);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
        }
      }
    },
    didDrawCell: (data) => {
      // Redessiner le texte en blanc pour les colonnes avec fond sombre
      if (data.section === 'head' && (data.column.index === 0 || data.column.index === 5)) {
        // Effacer le texte noir en redessinant le fond avec les bordures
        if (data.column.index === 0) {
          doc.setFillColor(0, 51, 102);
        } else {
          doc.setFillColor(204, 0, 0);
        }
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'FD');
        
        // Redessiner le texte en blanc
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const text = Array.isArray(data.cell.text) ? data.cell.text[0] : (data.cell.text || '');
        const textX = data.cell.x + data.cell.width / 2;
        const textY = data.cell.y + data.cell.height / 2 + 2;
        doc.text(text, textX, textY, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }
    },
  });

  const fileName = `${team.name.replace(/[^a-z0-9]/gi, '_')}_match.pdf`;
  doc.save(fileName);
}

