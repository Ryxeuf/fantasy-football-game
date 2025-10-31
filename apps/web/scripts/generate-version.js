#!/usr/bin/env node

/**
 * Script pour générer un fichier version.json pour le frontend
 * À exécuter lors du build pour mettre à jour la version affichée
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Le script est dans apps/web/scripts/, donc on remonte pour trouver le package.json racine
const rootPackageJsonPath = join(__dirname, '../../../package.json');
const rootPackageJson = JSON.parse(
  readFileSync(rootPackageJsonPath, 'utf-8')
);

const version = rootPackageJson.version || '0.1.0';

const versionData = {
  version,
  buildDate: new Date().toISOString(),
};

// apps/web/public/version.json
const outputPath = join(__dirname, '../public/version.json');
writeFileSync(outputPath, JSON.stringify(versionData, null, 2), 'utf-8');

console.log(`✓ Version ${version} générée dans ${outputPath}`);

