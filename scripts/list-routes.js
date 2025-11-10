#!/usr/bin/env node

/**
 * Script pour lister toutes les routes disponibles dans l'application
 * Usage: node scripts/list-routes.js
 */

const fs = require('fs');
const path = require('path');

console.log('📋 Liste des routes disponibles\n');
console.log('='.repeat(80));

// Routes API Backend (depuis les fichiers de routes)
const serverRoutesPath = path.join(__dirname, '../apps/server/src/routes');
const routesFiles = [
  'auth.ts',
  'admin.ts',
  'admin-data.ts',
  'match.ts',
  'team.ts',
  'user.ts',
  'star-players.ts',
  'public-skills.ts',
  'public-rosters.ts',
  'public-positions.ts',
];

console.log('\n🔌 Routes API Backend\n');
console.log('-'.repeat(80));

const routeCategories = {
  'auth.ts': 'Authentification',
  'admin.ts': 'Administration',
  'admin-data.ts': 'Données Admin',
  'match.ts': 'Parties',
  'team.ts': 'Équipes',
  'user.ts': 'Utilisateurs',
  'star-players.ts': 'Star Players',
  'public-skills.ts': 'API Publique - Compétences',
  'public-rosters.ts': 'API Publique - Rosters',
  'public-positions.ts': 'API Publique - Positions',
};

routesFiles.forEach(file => {
  const filePath = path.join(serverRoutesPath, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const category = routeCategories[file] || file;
    console.log(`\n${category}:`);
    
    // Extraire les routes avec regex
    const routePatterns = [
      /router\.(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/gi,
      /router\.(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/gi,
    ];
    
    const routes = [];
    let match;
    const regex = /router\.(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/gi;
    while ((match = regex.exec(content)) !== null) {
      routes.push({ method: match[1].toUpperCase(), path: match[2] });
    }
    
    if (routes.length > 0) {
      routes.forEach(route => {
        const methodColor = {
          GET: '\x1b[34m',      // Blue
          POST: '\x1b[32m',     // Green
          PUT: '\x1b[33m',      // Yellow
          DELETE: '\x1b[31m',   // Red
          PATCH: '\x1b[35m',    // Magenta
        }[route.method] || '';
        const reset = '\x1b[0m';
        console.log(`  ${methodColor}${route.method.padEnd(6)}${reset} ${route.path}`);
      });
    } else {
      console.log('  (Aucune route trouvée)');
    }
  }
});

// Routes Next.js (depuis la structure des fichiers)
console.log('\n\n🌐 Pages Next.js\n');
console.log('-'.repeat(80));

const appPath = path.join(__dirname, '../apps/web/app');

function findNextjsRoutes(dir, basePath = '') {
  const routes = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const routePath = path.join(basePath, item.name);
    
    if (item.isDirectory()) {
      // Ignorer certains dossiers
      if (!['node_modules', '.next', 'api'].includes(item.name)) {
        routes.push(...findNextjsRoutes(fullPath, routePath));
      }
    } else if (item.name === 'page.tsx' || item.name === 'page.ts') {
      // Convertir le chemin en route
      let route = basePath.replace(/\\/g, '/');
      // Remplacer [param] par :param
      route = route.replace(/\[([^\]]+)\]/g, ':$1');
      // Ajouter / si ce n'est pas la racine
      if (route && !route.startsWith('/')) {
        route = '/' + route;
      }
      if (!route) route = '/';
      routes.push(route);
    }
  }
  
  return routes;
}

if (fs.existsSync(appPath)) {
  const nextjsRoutes = findNextjsRoutes(appPath);
  nextjsRoutes.sort().forEach(route => {
    console.log(`  GET     ${route}`);
  });
}

// Routes API Next.js
console.log('\n\n🔗 Routes API Next.js\n');
console.log('-'.repeat(80));

const apiPath = path.join(__dirname, '../apps/web/app/api');

function findApiRoutes(dir, basePath = '/api') {
  const routes = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    let routePath = path.join(basePath, item.name);
    
    if (item.isDirectory()) {
      routes.push(...findApiRoutes(fullPath, routePath));
    } else if (item.name === 'route.ts' || item.name === 'route.js') {
      // Convertir le chemin en route
      let route = routePath.replace(/\\/g, '/');
      // Remplacer [param] par :param
      route = route.replace(/\[([^\]]+)\]/g, ':$1');
      routes.push(route);
    }
  }
  
  return routes;
}

if (fs.existsSync(apiPath)) {
  const apiRoutes = findApiRoutes(apiPath);
  apiRoutes.sort().forEach(route => {
    console.log(`  *       ${route} (toutes méthodes)`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('\n💡 Pour voir la liste complète avec descriptions, visitez /admin/routes\n');

