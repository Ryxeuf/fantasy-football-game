#!/usr/bin/env node

/**
 * Script pour télécharger les pages d'équipes depuis mordorbihan.fr
 * et les sauvegarder dans data/mordorbihan/
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'https://mordorbihan.fr';
const TEAMS_LIST_URL = `${BASE_URL}/fr/bloodbowl/2025/equipes`;
const OUTPUT_DIR = join(__dirname, '..', 'data', 'mordorbihan');

// Liste des équipes identifiées sur la page
const TEAMS = [
  'Alliance du Vieux Monde',
  'Amazones',
  'Bas-Fonds',
  'Bretonniens',
  'Elfes noirs',
  'Elfes sylvains',
  'Élus du Chaos',
  'Gnomes',
  'Gobelins',
  'Halflings',
  'Hauts elfes',
  'Hommes Lézard',
  'Horreurs nécromantiques',
  'Humains',
  'Khorne',
  'Morts ambulants',
  'Nains',
  'Nains du chaos',
  'Noblesse Impériale',
  'Nordiques',
  'Nurgle',
  'Ogres',
  'Orques',
  'Orques Noirs',
  'Renégats du Chaos',
  'Rois des tombes',
  'Skavens',
  'Snotlings',
  'Union elfique',
  'Vampires'
];

/**
 * Convertit le nom d'équipe en slug pour le nom de fichier
 */
function toSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Télécharge le contenu HTML d'une page
 */
async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.text();
}

/**
 * Sauvegarde le contenu HTML dans un fichier
 */
async function saveHtml(filename, content) {
  const filepath = join(OUTPUT_DIR, filename);
  await writeFile(filepath, content, 'utf-8');
  console.log(`✓ Sauvegardé: ${filename}`);
}

/**
 * Télécharge une équipe
 */
async function downloadTeam(teamName) {
  const url = `${BASE_URL}/fr/bloodbowl/2025/equipe/${encodeURIComponent(teamName)}`;
  const slug = toSlug(teamName);
  const filename = `${slug}.html`;
  
  try {
    console.log(`Téléchargement: ${teamName}...`);
    const html = await fetchHtml(url);
    await saveHtml(filename, html);
    return { success: true, team: teamName };
  } catch (error) {
    console.error(`✗ Erreur pour ${teamName}: ${error.message}`);
    return { success: false, team: teamName, error: error.message };
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Scraping des équipes Blood Bowl depuis mordorbihan.fr');
  console.log('='.repeat(60));
  console.log();

  // Créer le dossier de sortie
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Dossier de sortie: ${OUTPUT_DIR}`);
  } catch (error) {
    // Le dossier existe déjà, pas de problème
  }

  console.log(`\nTéléchargement de ${TEAMS.length} équipes...\n`);

  // Télécharger chaque équipe avec un petit délai pour être poli
  const results = [];
  for (const team of TEAMS) {
    const result = await downloadTeam(team);
    results.push(result);
    
    // Attendre 500ms entre chaque requête pour ne pas surcharger le serveur
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('RÉSUMÉ');
  console.log('='.repeat(60));
  
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
  
  console.log(`\n✓ Succès: ${successes.length}/${TEAMS.length}`);
  
  if (failures.length > 0) {
    console.log(`\n✗ Échecs: ${failures.length}`);
    failures.forEach(f => console.log(`  - ${f.team}: ${f.error}`));
  }

  console.log(`\nFichiers sauvegardés dans: ${OUTPUT_DIR}`);
}

main().catch(console.error);

