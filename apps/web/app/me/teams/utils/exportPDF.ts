/**
 * Utilitaire pour exporter un roster d'équipe en PDF
 */

import { getDisplayName } from '@bb/game-engine';

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

export async function exportTeamToPDF(team: TeamData, getPlayerCost: (position: string, roster: string) => number) {
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

  // En-tête du document
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`BB Roster - ${team.name}`, margin, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Équipe ${getRosterDisplayName(team.roster)} - ${new Date().toLocaleDateString('fr-FR')}`, margin, 22);

  // Calculer les valeurs
  const totalCost = team.players.reduce((sum, p) => sum + getPlayerCost(p.position, team.roster), 0);
  const rosterTotal = totalCost + 
    ((team.rerolls || 0) * 50000) + 
    ((team.cheerleaders || 0) * 10000) + 
    ((team.assistants || 0) * 10000) + 
    ((team.dedicatedFans || 1) * 10000) + 
    (team.apothecary ? 50000 : 0);
  const treasury = (team.initialBudget || 0) * 1000 - rosterTotal;

  // Préparer les données du tableau des joueurs
  const playersData = team.players
    .sort((a, b) => a.number - b.number)
    .map(player => {
      // Formater les compétences sur plusieurs lignes si nécessaire
      const skills = player.skills || '';
      const skillsArray = skills.split(',').map((s: string) => s.trim()).filter(Boolean);
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
    head: [['#', 'NOM', 'POSITION', 'MA', 'ST', 'AG', 'PA', 'AV', 'COMPÉTENCES ET TRAITS', 'COÛT', 'PSP', 'RPM', 'BP', 'RC', 'VALEUR\nACTUELLE']],
    body: playersData,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
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
  const teamInfoData = [
    ['NOM DE L\'ENTRAÎNEUR', '', 'RELANCES', `${team.rerolls || 0} / 8`, `${(team.rerolls || 0) * 50}000`],
    ['VALEUR DE L\'ÉQUIPE', `${Math.round((team.teamValue || 0) / 1000)}000`, 'ENTRAÎNEURS ADJOINTS', `${team.assistants || 0} / 6`, '10000'],
    ['ROSTER TOTAL', `${Math.round(rosterTotal / 1000)}000`, 'POM-POM GIRLS', `${team.cheerleaders || 0} / 12`, '10000'],
    ['TRÉSORERIE', `${Math.round(treasury / 1000)}000`, 'FANS DÉVOUÉS', `${team.dedicatedFans || 1} / 6`, '10000'],
    ['', '', 'APOTHICAIRE', team.apothecary ? '1 / 1' : '0 / 1', '50000'],
  ];

  autoTable(doc, {
    startY: finalY + 5,
    body: teamInfoData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 50, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'left', cellWidth: 45, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 25 },
    },
    margin: { left: margin, right: pageWidth / 2 + 5 },
  });

  // Sauvegarder le PDF
  const fileName = `${team.name.replace(/[^a-z0-9]/gi, '_')}_roster.pdf`;
  doc.save(fileName);
}

