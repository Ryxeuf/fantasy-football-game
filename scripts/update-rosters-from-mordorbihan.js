#!/usr/bin/env node

/**
 * Script pour parser les fichiers HTML de mordorbihan.fr
 * et mettre à jour les rosters dans positions.ts
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data', 'mordorbihan');

// Mapping des noms de fichiers vers les slugs des rosters
const FILE_TO_ROSTER_SLUG = {
  'alliance-du-vieux-monde.html': 'old_world_alliance',
  'amazones.html': 'amazon',
  'bas-fonds.html': 'underworld',
  'bretonniens.html': 'bretonnian',
  'elfes-noirs.html': 'dark_elf',
  'elfes-sylvains.html': 'wood_elf',
  'elus-du-chaos.html': 'chaos_chosen',
  'gnomes.html': 'gnome',
  'gobelins.html': 'goblin',
  'halflings.html': 'halfling',
  'hauts-elfes.html': 'high_elf',
  'hommes-lezard.html': 'lizardmen',
  'horreurs-necromantiques.html': 'necromantic_horror',
  'humains.html': 'human',
  'khorne.html': 'khorne',
  'morts-ambulants.html': 'undead',
  'nains.html': 'dwarf',
  'nains-du-chaos.html': 'chaos_dwarf',
  'noblesse-imperiale.html': 'imperial_nobility',
  'nordiques.html': 'norse',
  'nurgle.html': 'nurgle',
  'ogres.html': 'ogre',
  'orques.html': 'orc',
  'orques-noirs.html': 'black_orc',
  'renegats-du-chaos.html': 'chaos_renegade',
  'rois-des-tombes.html': 'tomb_kings',
  'skavens.html': 'skaven',
  'snotlings.html': 'snotling',
  'union-elfique.html': 'elven_union',
  'vampires.html': 'vampire',
};

// Mapping des noms de compétences français → slugs
const SKILL_FR_TO_SLUG = {
  'Blocage': 'block',
  'Intrépide': 'dauntless',
  'Joueur Déloyal (+1)': 'dirty-player-1',
  'Joueur Déloyal (+2)': 'dirty-player-2',
  'Parade': 'fend',
  'Frénésie': 'frenzy',
  'Frappe Précise': 'kick',
  'Pro': 'pro',
  'Poursuite': 'shadowing',
  'Arracher le Ballon': 'strip-ball',
  'Prise sûre': 'sure-hands',
  'Prise Sûre': 'sure-hands',
  'Tacle': 'tackle',
  'Lutte': 'wrestle',
  'Réception': 'catch',
  'Réception Plongée': 'diving-catch',
  'Tacle Plongé': 'diving-tackle',
  'Esquive': 'dodge',
  'Défenseur': 'defensive',
  'Rétablissement': 'jump-up',
  'Saut': 'leap',
  'Libération Contrôlée': 'safe-pair-of-hands',
  'Glissade Contrôlée': 'sidestep',
  'Glissade controlée': 'sidestep',
  'Sournois': 'sneaky-git',
  'Sprint': 'sprint',
  'Équilibre': 'sure-feet',
  'Grande Main': 'big-hand',
  'Griffes': 'claws',
  'Présence Perturbante': 'disturbing-presence',
  'Présence perturbante': 'disturbing-presence',
  'Bras Supplémentaires': 'extra-arms',
  'Répulsion': 'foul-appearance',
  'Cornes': 'horns',
  'Peau de Fer': 'iron-hard-skin',
  'Grande Gueule': 'monstrous-mouth',
  'Queue Préhensile': 'prehensile-tail',
  'Tentacules': 'tentacles',
  'Deux Têtes': 'two-heads',
  'Très Longues Jambes': 'very-long-legs',
  'Précision': 'accurate',
  'Canonnier': 'cannoneer',
  'Perce-Nuages': 'cloud-burster',
  'Délestage': 'dump-off',
  'Fumblerooskie': 'fumblerooskie',
  'Passe Désespérée': 'hail-mary-pass',
  'Chef': 'leader',
  'Nerfs d\'Acier': 'nerves-of-steel',
  'Nerfs d\'acier': 'nerves-of-steel',
  'Sur le Ballon': 'on-the-ball',
  'Passe': 'pass',
  'Passe dans la Course': 'running-pass',
  'Passe Assurée': 'safe-pass',
  'Clé de Bras': 'arm-bar',
  'Bagarreur': 'brawler',
  'Esquive en Force': 'break-tackle',
  'Esquive en force': 'break-tackle',
  'Projection': 'grab',
  'Garde': 'guard',
  'Boulet de Canon': 'juggernaut',
  'Juggernaut': 'juggernaut',
  'Coup Puissant': 'mighty-blow',
  'Châtaigne': 'mighty-blow-1',
  'Blocage Multiple': 'multiple-block',
  'Pilonneur': 'pile-driver',
  'Stabilité': 'stand-firm',
  'Bras Musclé': 'strong-arm',
  'Crâne Épais': 'thick-skull',
  'Crane épais': 'thick-skull',
  'Armure Blindée': 'armored-skull',
  'Sauvagerie Animale': 'animal-savagery',
  'Cerveau Lent': 'bone-head',
  'Cerveau lent': 'bone-head',
  'Gros Débile': 'really-stupid',
  'Régénération': 'regeneration',
  'Poids Plume': 'right-stuff',
  'Poids plume': 'right-stuff',
  'Microbe': 'stunty',
  'Minus': 'titchy',
  'Essaimage': 'swarming',
  'Prendre Racine': 'take-root',
  'Solitaire (3+)': 'loner-3',
  'Solitaire (4+)': 'loner-4',
  'Solitaire (5+)': 'loner-5',
  'Lancer de coéquipier': 'throw-team-mate',
  'Lancer de Coéquipier': 'throw-team-mate',
  'Fureur Débridée': 'wild-animal',
  'Toujours Affamé': 'always-hungry',
  'Sans Ballon': 'no-hands',
  'Sans ballon': 'no-hands',
  'Arme Secrète': 'secret-weapon',
  'Arme secrète': 'secret-weapon',
  'Bombardier': 'bombardier',
  'Tronçonneuse': 'chainsaw',
  'Chaînes et Boulet': 'ball-and-chain',
  'Regard Hypnotique': 'hypnotic-gaze',
  'Décomposition': 'decay',
  'Poignard': 'stab',
  'Piqué': 'pile-on',
  'Animosité': 'animosity',
  'Soif de Sang': 'bloodlust',
  'Soif de Sang (2+)': 'bloodlust-2',
  'Soif de Sang (3+)': 'bloodlust-3',
  'Porteur de Peste': 'plague-ridden',
  'Pieux': 'stakes',
  'Timmm-ber!': 'timmm-ber',
  'Monté sur Ressort': 'pogo-stick',
  'Poivrot': 'drunkard',
  'Ivrogne': 'drunkard',
  'Animosité (Underworld)': 'animosity-underworld',
  'Gerbe de Vomi': 'projectile-vomit',
  'Gros Débile (+2)': 'really-stupid-2',
  'Botté de coéquipier': 'kick-team-mate',
  'Botté de Coéquipier': 'kick-team-mate',
  // Nouvelles compétences saison 3
  'Agresseur Solitaire': 'solitary-aggressor',
  'Agression Eclair': 'lightning-aggression',
  'Coup de Crampons': 'boot-to-the-head',
  'Fourchette': 'fork',
  'Innovateur Violent': 'violent-innovator',
  'Provocation': 'provocation',
  'Saboteur': 'saboteur',
  'Vol fatal': 'fatal-flight',
  'Vol Fatal': 'fatal-flight',
  'Dégagement': 'clearance',
  'Appuis Sûrs': 'surefoot',
  'Dans le Mille': 'bullseye',
  'Dans le mille': 'bullseye',
  'Transmission dans la course': 'running-pass-2025',
  'Farceur': 'trickster',
  'Haine': 'hate',
  'Insignifiant': 'insignifiant',
  'Contagieux': 'contagieux',
  'Instable': 'instable',
  'Souffle Ardent': 'breathe-fire',
  'Mon Ballon': 'my-ball',
  'Petit remontant': 'pick-me-up',
  // Compétences avec parenthèses
  'Haine (Mort-vivant)': 'hate',
  'Haine (Troll)': 'hate',
  // Compétences spéciales Saison 3
  'Frappe-et-cours': 'hit-and-run',
  'Tacle pongeant': 'diving-tackle',
  'Tacle plongeant': 'diving-tackle',
  'Chaîne et boulet': 'ball-and-chain',
  'Joueur déloyal': 'dirty-player-1',
  'Fumblerooski': 'fumblerooskie',
  'Perce–nuages': 'cloud-burster',
  'Perce-nuages': 'cloud-burster',
  'Réception plongeante': 'diving-catch',
  'Ma balle': 'my-ball',
  'Animosité (Gobelins des Bas-Fond)': 'animosity-underworld',
  'Animosité (Tous)': 'animosity',
  'Soif de sang (x+)': 'bloodlust',
  // Traits additionnels
  'Hit and Run': 'hit-and-run',
};

/**
 * Parse une valeur de caractéristique (ex: "3+" -> 3)
 */
function parseCharacteristic(value) {
  if (!value || value === '-') return 6; // Valeur par défaut pour "-"
  return parseInt(value.replace('+', ''), 10);
}

/**
 * Parse le coût (ex: "50K" -> 50)
 */
function parseCost(value) {
  if (!value) return 0;
  return parseInt(value.replace('K', '').replace('k', '').trim(), 10);
}

/**
 * Parse la quantité (ex: "0-16" -> { min: 0, max: 16 })
 */
function parseQuantity(value) {
  if (!value) return { min: 0, max: 16 };
  const parts = value.split('-');
  return {
    min: parseInt(parts[0], 10),
    max: parseInt(parts[1], 10),
  };
}

/**
 * Convertit une liste de compétences françaises en slugs
 */
function convertSkillsToSlugs(skillsArray) {
  const slugs = [];
  for (const skill of skillsArray) {
    const trimmed = skill.trim();
    if (!trimmed) continue;
    
    const slug = SKILL_FR_TO_SLUG[trimmed];
    if (slug) {
      slugs.push(slug);
    } else {
      // Essayer de trouver une correspondance partielle
      let found = false;
      for (const [frName, slugValue] of Object.entries(SKILL_FR_TO_SLUG)) {
        if (frName.toLowerCase() === trimmed.toLowerCase()) {
          slugs.push(slugValue);
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(`  ⚠ Compétence non reconnue: "${trimmed}"`);
        // Convertir en slug
        const generatedSlug = trimmed
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        slugs.push(generatedSlug);
      }
    }
  }
  return slugs.join(',');
}

/**
 * Parse un fichier HTML pour extraire les données des positions
 */
async function parseTeamHtml(filename) {
  const filepath = join(DATA_DIR, filename);
  const html = await readFile(filepath, 'utf-8');
  const $ = cheerio.load(html);
  
  const positions = [];
  const teamName = $('h1').first().text().trim();
  const tier = $('[ref=e83]').text().trim() || 'II'; // Tier par défaut
  
  // Trouver la table des positionnels
  const table = $('table').first();
  const rows = table.find('tbody tr');
  
  rows.each((index, row) => {
    const cells = $(row).find('td');
    if (cells.length < 10) return; // Pas assez de cellules
    
    const qteText = $(cells[0]).text().trim();
    const positionName = $(cells[1]).find('p').first().text().trim();
    const ma = parseCharacteristic($(cells[2]).text().trim());
    const st = parseCharacteristic($(cells[3]).text().trim());
    const ag = parseCharacteristic($(cells[4]).text().trim());
    const pa = parseCharacteristic($(cells[5]).text().trim());
    const av = parseCharacteristic($(cells[6]).text().trim());
    
    // Extraire les compétences
    const skillsCell = $(cells[7]);
    const skillButtons = skillsCell.find('button');
    const skills = [];
    skillButtons.each((i, btn) => {
      skills.push($(btn).text().trim());
    });
    
    const cost = parseCost($(cells[10]).text().trim());
    const qty = parseQuantity(qteText);
    
    if (positionName && cost > 0) {
      positions.push({
        displayName: positionName,
        ma,
        st,
        ag,
        pa,
        av,
        skills: skills,
        skillsSlugs: convertSkillsToSlugs(skills),
        cost,
        min: qty.min,
        max: qty.max,
      });
    }
  });
  
  return {
    teamName,
    tier: tier.replace('Tier ', ''),
    positions,
  };
}

/**
 * Fonction principale
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Parsing des fichiers HTML de mordorbihan.fr');
  console.log('='.repeat(60));
  console.log();
  
  const files = await readdir(DATA_DIR);
  const htmlFiles = files.filter(f => f.endsWith('.html'));
  
  const allTeams = {};
  
  for (const file of htmlFiles) {
    const rosterSlug = FILE_TO_ROSTER_SLUG[file];
    if (!rosterSlug) {
      console.log(`⚠ Pas de mapping pour ${file}, ignoré`);
      continue;
    }
    
    console.log(`\n📄 Parsing: ${file} → ${rosterSlug}`);
    
    try {
      const data = await parseTeamHtml(file);
      allTeams[rosterSlug] = data;
      
      console.log(`   Team: ${data.teamName} (Tier ${data.tier})`);
      console.log(`   Positions: ${data.positions.length}`);
      
      for (const pos of data.positions) {
        console.log(`   - ${pos.displayName}: M${pos.ma} F${pos.st} AG${pos.ag}+ PA${pos.pa}+ AR${pos.av}+ | ${pos.cost}K | ${pos.skillsSlugs || '(aucune)'}`);
      }
    } catch (error) {
      console.error(`   ❌ Erreur: ${error.message}`);
    }
  }
  
  // Générer le rapport de comparaison
  console.log('\n' + '='.repeat(60));
  console.log('RAPPORT DE COMPARAISON');
  console.log('='.repeat(60));
  
  // Sauvegarder les données en JSON pour référence
  const outputPath = join(__dirname, '..', 'data', 'mordorbihan-parsed.json');
  await writeFile(outputPath, JSON.stringify(allTeams, null, 2), 'utf-8');
  console.log(`\n✓ Données sauvegardées dans: ${outputPath}`);
  
  console.log('\n📝 Pour mettre à jour les rosters, utilisez ces données pour modifier:');
  console.log('   packages/game-engine/src/rosters/positions.ts');
}

main().catch(console.error);

