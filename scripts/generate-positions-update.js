#!/usr/bin/env node

/**
 * Script pour générer une mise à jour de positions.ts
 * basée sur les données parsées de mordorbihan.fr
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_PATH = join(__dirname, '..', 'data', 'mordorbihan-parsed.json');
const POSITIONS_PATH = join(__dirname, '..', 'packages', 'game-engine', 'src', 'rosters', 'positions.ts');

// Mapping des slugs de roster vers le format des positions
const ROSTER_POSITION_PREFIX = {
  'skaven': 'skaven',
  'lizardmen': 'lizardmen',
  'wood_elf': 'wood_elf',
  'dark_elf': 'dark_elf',
  'dwarf': 'dwarf',
  'goblin': 'goblin',
  'undead': 'undead',
  'chaos_renegade': 'chaos_renegade',
  'ogre': 'ogre',
  'halfling': 'halfling',
  'underworld': 'underworld',
  'chaos_chosen': 'chaos_chosen',
  'imperial_nobility': 'imperial_nobility',
  'necromantic_horror': 'necromantic_horror',
  'orc': 'orc',
  'nurgle': 'nurgle',
  'old_world_alliance': 'old_world_alliance',
  'elven_union': 'elven_union',
  'human': 'human',
  'black_orc': 'black_orc',
  'chaos_dwarf': 'chaos_dwarf',
  'high_elf': 'high_elf',
  'khorne': 'khorne',
  'vampire': 'vampire',
  'tomb_kings': 'tomb_kings',
  'gnome': 'gnome',
  'norse': 'norse',
  'snotling': 'snotling',
  'amazon': 'amazon',
  'bretonnian': 'bretonnian',
  'slann': 'slann',
};

/**
 * Génère un slug de position à partir du nom et du préfixe de roster
 */
function generatePositionSlug(rosterSlug, displayName) {
  const prefix = ROSTER_POSITION_PREFIX[rosterSlug] || rosterSlug;
  const normalized = displayName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '')
    .replace(/_+/g, '_');
  return `${prefix}_${normalized}`;
}

/**
 * Génère le code TypeScript pour une position
 */
function generatePositionCode(position, rosterSlug) {
  const slug = generatePositionSlug(rosterSlug, position.displayName);
  return `      {
        slug: "${slug}",
        displayName: "${position.displayName}",
        cost: ${position.cost},
        min: ${position.min},
        max: ${position.max},
        ma: ${position.ma},
        st: ${position.st},
        ag: ${position.ag},
        pa: ${position.pa},
        av: ${position.av},
        skills: "${position.skillsSlugs}",
      }`;
}

/**
 * Génère le code TypeScript pour un roster
 */
function generateRosterCode(rosterSlug, data) {
  const positions = data.positions.map(pos => generatePositionCode(pos, rosterSlug)).join(',\n');
  
  // Tier mapping
  const tierMap = {
    '1': 'I',
    '2': 'II',
    '3': 'III',
    '4': 'IV',
    'I': 'I',
    'II': 'II',
    'III': 'III',
    'IV': 'IV',
  };
  const tier = tierMap[data.tier] || 'II';
  
  return `  ${rosterSlug}: {
    name: "${data.teamName}",
    budget: 1000,
    tier: "${tier}",
    naf: false,
    positions: [
${positions}
    ],
  }`;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Génération de la mise à jour de positions.ts');
  console.log('='.repeat(60));
  console.log();
  
  // Lire les données parsées
  const parsedData = JSON.parse(await readFile(DATA_PATH, 'utf-8'));
  
  // Lire le fichier positions.ts actuel
  const currentContent = await readFile(POSITIONS_PATH, 'utf-8');
  
  // Générer les mises à jour roster par roster
  console.log('📊 Comparaison des données:\n');
  
  const updates = [];
  
  for (const [rosterSlug, data] of Object.entries(parsedData)) {
    // Vérifier si le roster existe dans le fichier actuel
    const rosterPattern = new RegExp(`${rosterSlug}:\\s*\\{`, 'g');
    const exists = rosterPattern.test(currentContent);
    
    if (exists) {
      console.log(`✅ ${rosterSlug}: ${data.positions.length} positions`);
      updates.push({ slug: rosterSlug, data });
    } else {
      console.log(`⚠️  ${rosterSlug}: Non trouvé dans le fichier actuel`);
    }
  }
  
  // Générer un fichier de comparaison
  console.log('\n' + '='.repeat(60));
  console.log('Génération du fichier de comparaison...');
  console.log('='.repeat(60));
  
  // Générer le nouveau code pour chaque roster
  const newRosters = {};
  for (const { slug, data } of updates) {
    newRosters[slug] = generateRosterCode(slug, data);
  }
  
  // Sauvegarder un fichier avec les nouveaux rosters
  const outputPath = join(__dirname, '..', 'data', 'positions-update.ts');
  const outputContent = `/**
 * Mise à jour des rosters générée à partir de mordorbihan.fr
 * Source: https://mordorbihan.fr/fr/bloodbowl/2025/equipes
 * 
 * Ces données représentent les règles Saison 3 de Blood Bowl
 */

// Voici les rosters mis à jour:

${Object.values(newRosters).join(',\n\n')}
`;
  
  await writeFile(outputPath, outputContent, 'utf-8');
  console.log(`\n✓ Fichier de mise à jour généré: ${outputPath}`);
  
  // Générer un rapport de différences
  console.log('\n📝 Résumé des changements par équipe:');
  for (const { slug, data } of updates) {
    console.log(`\n  ${slug} (${data.teamName}):`);
    for (const pos of data.positions) {
      console.log(`    - ${pos.displayName}: M${pos.ma} F${pos.st} AG${pos.ag}+ PA${pos.pa}+ AR${pos.av}+ | ${pos.cost}K | ${pos.skillsSlugs || '(aucune)'}`);
    }
  }
}

main().catch(console.error);

