#!/usr/bin/env node

/**
 * Script pour appliquer les rosters Saison 3 de mordorbihan.fr
 * au fichier positions.ts
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_PATH = join(__dirname, '..', 'data', 'mordorbihan-parsed.json');
const POSITIONS_PATH = join(__dirname, '..', 'packages', 'game-engine', 'src', 'rosters', 'positions.ts');

// Mapping des slugs de roster
const ROSTER_PREFIX = {
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
};

/**
 * Génère un slug de position
 */
function generatePositionSlug(rosterSlug, displayName) {
  const prefix = ROSTER_PREFIX[rosterSlug] || rosterSlug;
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
 * Génère le code pour les positions d'un roster
 */
function generatePositionsArray(positions, rosterSlug) {
  return positions.map(pos => {
    const slug = generatePositionSlug(rosterSlug, pos.displayName);
    return `      {
        slug: "${slug}",
        displayName: "${pos.displayName}",
        cost: ${pos.cost},
        min: ${pos.min},
        max: ${pos.max},
        ma: ${pos.ma},
        st: ${pos.st},
        ag: ${pos.ag},
        pa: ${pos.pa},
        av: ${pos.av},
        skills: "${pos.skillsSlugs || ''}",
      }`;
  }).join(',\n');
}

/**
 * Génère le contenu d'un roster complet
 */
function generateRosterContent(slug, data, existingRoster) {
  // Garder les descriptions et autres métadonnées de l'existant si disponible
  const descFr = existingRoster?.descriptionFr ? 
    `\n    descriptionFr: "${existingRoster.descriptionFr.replace(/"/g, '\\"')}",` : '';
  const descEn = existingRoster?.descriptionEn ? 
    `\n    descriptionEn: "${existingRoster.descriptionEn.replace(/"/g, '\\"')}",` : '';
  const regional = existingRoster?.regionalRules ? 
    `\n    regionalRules: ${JSON.stringify(existingRoster.regionalRules)},` : '';
  const special = existingRoster?.specialRules ? 
    `\n    specialRules: "${existingRoster.specialRules}",` : '';

  const positions = generatePositionsArray(data.positions, slug);
  
  return `  ${slug}: {
    name: "${data.teamName}",
    budget: 1000,
    tier: "${data.tier}",
    naf: false,${descFr}${descEn}${regional}${special}
    positions: [
${positions}
    ],
  }`;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Application des rosters Saison 3 à positions.ts');
  console.log('='.repeat(60));
  console.log();

  // Lire les données
  const parsedData = JSON.parse(await readFile(DATA_PATH, 'utf-8'));
  const currentContent = await readFile(POSITIONS_PATH, 'utf-8');

  // Générer le nouveau contenu pour SEASON_THREE
  console.log('📝 Génération du fichier season3-rosters.ts...\n');

  const season3Rosters = [];
  for (const [slug, data] of Object.entries(parsedData)) {
    if (!ROSTER_PREFIX[slug]) {
      console.log(`⚠️  ${slug}: Non supporté`);
      continue;
    }
    season3Rosters.push(generateRosterContent(slug, data, null));
    console.log(`✅ ${slug}: ${data.positions.length} positions`);
  }

  // Générer le fichier de rosters Saison 3
  const season3Content = `/**
 * Rosters Saison 3 de Blood Bowl
 * Générés automatiquement à partir de mordorbihan.fr
 * Source: https://mordorbihan.fr/fr/bloodbowl/2025/equipes
 * 
 * Ces données sont conformes aux règles Saison 3 (2025)
 */

import type { TeamRoster } from './positions';

export const SEASON_THREE_ROSTERS: Record<string, TeamRoster> = {
${season3Rosters.join(',\n\n')}
};
`;

  const outputPath = join(__dirname, '..', 'packages', 'game-engine', 'src', 'rosters', 'season3-rosters.ts');
  await writeFile(outputPath, season3Content, 'utf-8');
  
  console.log(`\n✓ Fichier généré: ${outputPath}`);

  // Afficher les instructions pour intégration
  console.log('\n' + '='.repeat(60));
  console.log('PROCHAINES ÉTAPES');
  console.log('='.repeat(60));
  console.log(`
Pour intégrer les rosters Saison 3, modifiez positions.ts:

1. Importez le fichier:
   import { SEASON_THREE_ROSTERS } from './season3-rosters';

2. Mettez à jour TEAM_ROSTERS_BY_RULESET:
   export const TEAM_ROSTERS_BY_RULESET: Record<Ruleset, TeamRosterMap> = {
     season_2: SEASON_TWO_ROSTERS,
     season_3: SEASON_THREE_ROSTERS,
   };
`);
}

main().catch(console.error);

