# Star Players - Guide de Démarrage Rapide

## 🚀 Démarrage en 5 minutes

### 1. Tester le système

```bash
# Tests unitaires
cd packages/game-engine
npm test -- star-players.test.ts --run
```

Résultat attendu : ✅ 19/19 tests passent

### 2. Utiliser dans le code

```typescript
// Importer les Star Players
import { 
  STAR_PLAYERS,
  getStarPlayerBySlug,
  getAvailableStarPlayers,
  TEAM_REGIONAL_RULES
} from '@bb/game-engine';

// Obtenir un Star Player spécifique
const griff = getStarPlayerBySlug('griff_oberwald');
console.log(`${griff.displayName} coûte ${griff.cost} po`);

// Obtenir les Star Players disponibles pour une équipe
const skaven = 'skaven';
const regionalRules = TEAM_REGIONAL_RULES[skaven];
const available = getAvailableStarPlayers(skaven, regionalRules);
console.log(`${available.length} star players disponibles pour les Skavens`);
```

### 3. Utiliser l'API

```bash
# Démarrer le serveur
cd apps/server
npm run dev

# Dans un autre terminal, tester l'API
curl http://localhost:8000/star-players
curl http://localhost:8000/star-players/griff_oberwald
curl http://localhost:8000/star-players/available/skaven
```

### 4. Tester l'interface web

```bash
# Démarrer l'application web
cd apps/web
npm run dev

# Ouvrir dans le navigateur
open http://localhost:3000/star-players
```

## 📖 Exemples Courants

### Lister tous les Star Players

```typescript
import { STAR_PLAYERS } from '@bb/game-engine';

const allStarPlayers = Object.values(STAR_PLAYERS);
allStarPlayers.forEach(sp => {
  console.log(`${sp.displayName} - ${sp.cost} po`);
});
```

### Rechercher par compétence

```typescript
import { STAR_PLAYERS } from '@bb/game-engine';

const blockPlayers = Object.values(STAR_PLAYERS).filter(sp =>
  sp.skills.includes('block')
);

console.log(`${blockPlayers.length} star players ont la compétence Block`);
```

### Filtrer par coût

```typescript
import { STAR_PLAYERS } from '@bb/game-engine';

const affordable = Object.values(STAR_PLAYERS).filter(sp =>
  sp.cost > 0 && sp.cost <= 200000
);

console.log(`${affordable.length} star players coûtent moins de 200K po`);
```

### Star Players disponibles pour une équipe

```typescript
import { getAvailableStarPlayers, TEAM_REGIONAL_RULES } from '@bb/game-engine';

const team = 'wood_elf';
const regionalRules = TEAM_REGIONAL_RULES[team];
const available = getAvailableStarPlayers(team, regionalRules);

console.log('Star Players disponibles pour les Elfes Sylvains:');
available.forEach(sp => {
  console.log(`- ${sp.displayName} (${sp.cost} po)`);
});
```

### Trouver les plus chers

```typescript
import { STAR_PLAYERS } from '@bb/game-engine';

const mostExpensive = Object.values(STAR_PLAYERS)
  .filter(sp => sp.cost > 0)
  .sort((a, b) => b.cost - a.cost)
  .slice(0, 5);

console.log('Top 5 des star players les plus chers:');
mostExpensive.forEach((sp, i) => {
  console.log(`${i + 1}. ${sp.displayName} - ${sp.cost.toLocaleString()} po`);
});
```

## 🎯 Cas d'Usage Pratiques

### 1. Afficher les Star Players dans un menu de sélection

```typescript
import { getAvailableStarPlayers, TEAM_REGIONAL_RULES } from '@bb/game-engine';

function StarPlayerSelector({ teamRoster }: { teamRoster: string }) {
  const regionalRules = TEAM_REGIONAL_RULES[teamRoster];
  const available = getAvailableStarPlayers(teamRoster, regionalRules);

  return (
    <select>
      <option value="">-- Sélectionner un Star Player --</option>
      {available.map(sp => (
        <option key={sp.slug} value={sp.slug}>
          {sp.displayName} - {(sp.cost / 1000).toLocaleString()} K po
        </option>
      ))}
    </select>
  );
}
```

### 2. Calculer le coût d'une équipe avec Star Players

```typescript
import { getStarPlayerBySlug } from '@bb/game-engine';

function calculateTeamValue(playerSlugs: string[], starPlayerSlugs: string[]) {
  // Coût des joueurs normaux (à implémenter selon votre système)
  const playersCost = calculatePlayersCost(playerSlugs);
  
  // Coût des Star Players
  const starPlayersCost = starPlayerSlugs.reduce((total, slug) => {
    const sp = getStarPlayerBySlug(slug);
    return total + (sp?.cost || 0);
  }, 0);
  
  return playersCost + starPlayersCost;
}
```

### 3. Valider le recrutement d'un Star Player

```typescript
import { 
  getStarPlayerBySlug, 
  getAvailableStarPlayers,
  TEAM_REGIONAL_RULES 
} from '@bb/game-engine';

function canHireStarPlayer(
  teamRoster: string, 
  starPlayerSlug: string,
  budget: number
): { canHire: boolean; reason?: string } {
  const starPlayer = getStarPlayerBySlug(starPlayerSlug);
  
  if (!starPlayer) {
    return { canHire: false, reason: 'Star Player inconnu' };
  }
  
  // Vérifier le budget
  if (starPlayer.cost > budget) {
    return { 
      canHire: false, 
      reason: `Budget insuffisant (${starPlayer.cost - budget} po manquants)` 
    };
  }
  
  // Vérifier la disponibilité
  const regionalRules = TEAM_REGIONAL_RULES[teamRoster];
  const available = getAvailableStarPlayers(teamRoster, regionalRules);
  const isAvailable = available.some(sp => sp.slug === starPlayerSlug);
  
  if (!isAvailable) {
    return { 
      canHire: false, 
      reason: 'Star Player non disponible pour cette équipe' 
    };
  }
  
  return { canHire: true };
}
```

### 4. Afficher une carte de Star Player

```tsx
import React from 'react';
import { getStarPlayerBySlug } from '@bb/game-engine';

function StarPlayerCard({ slug }: { slug: string }) {
  const sp = getStarPlayerBySlug(slug);
  
  if (!sp) return null;
  
  return (
    <div className="star-player-card">
      <h3>{sp.displayName}</h3>
      <div className="cost">{(sp.cost / 1000).toLocaleString()} K po</div>
      
      <div className="stats">
        <span>MA: {sp.ma}</span>
        <span>ST: {sp.st}</span>
        <span>AG: {sp.ag}+</span>
        <span>PA: {sp.pa ? `${sp.pa}+` : '-'}</span>
        <span>AV: {sp.av}+</span>
      </div>
      
      <div className="skills">
        Compétences: {sp.skills}
      </div>
      
      {sp.specialRule && (
        <div className="special-rule">
          <strong>Règle spéciale:</strong>
          <p>{sp.specialRule}</p>
        </div>
      )}
    </div>
  );
}
```

## 📊 Données Utiles

### Star Players disponibles pour tous

Ces 3 Star Players peuvent être recrutés par n'importe quelle équipe :

```typescript
const universalStarPlayers = [
  'glart_smashrip',    // 195,000 po
  'grak',              // 250,000 po (+ Crumbleberry gratuit)
  'helmut_wulf',       // 140,000 po
  'morg_n_thorg'       // 340,000 po
];
```

### Les moins chers (< 200K)

```typescript
const cheapStarPlayers = [
  'helmut_wulf',           // 140,000 po
  'gloriel_summerbloom',   // 150,000 po
  'skrull_halfheight',     // 150,000 po
  'willow_rosebark',       // 150,000 po
  'rumbelow_sheepskin',    // 170,000 po
  'hakflem_skuttlespike',  // 180,000 po
  'glart_smashrip'         // 195,000 po
];
```

### Les plus chers (300K+)

```typescript
const legendaryStarPlayers = [
  'morg_n_thorg',     // 340,000 po
  'lucien_swift',     // 340,000 po
  'valen_swift'       // 340,000 po
];
```

### Paires à recruter ensemble

```typescript
const starPlayerPairs = {
  grak_crumbleberry: ['grak', 'crumbleberry'],  // 250,000 po total
  swift_twins: ['lucien_swift', 'valen_swift']  // 680,000 po total
};
```

## 🔍 Recherches Avancées

### Par Force (ST)

```typescript
import { STAR_PLAYERS } from '@bb/game-engine';

const strongestPlayers = Object.values(STAR_PLAYERS)
  .filter(sp => sp.st >= 5)
  .sort((a, b) => b.st - a.st);
```

### Par Vitesse (MA)

```typescript
const fastestPlayers = Object.values(STAR_PLAYERS)
  .filter(sp => sp.ma >= 8)
  .sort((a, b) => b.ma - a.ma);
```

### Par Règle Régionale

```typescript
import { STAR_PLAYERS } from '@bb/game-engine';

const elvenLeaguePlayers = Object.values(STAR_PLAYERS).filter(sp =>
  sp.hirableBy.includes('elven_kingdoms_league')
);
```

### Par Loner Level

```typescript
const mostReliable = Object.values(STAR_PLAYERS).filter(sp =>
  sp.skills.includes('loner-3')
);

const leastReliable = Object.values(STAR_PLAYERS).filter(sp =>
  sp.skills.includes('loner-4')
);
```

## 🧪 Tester l'API avec curl

```bash
# Tous les Star Players
curl http://localhost:8000/star-players | jq

# Un Star Player spécifique
curl http://localhost:8000/star-players/griff_oberwald | jq

# Disponibles pour une équipe
curl http://localhost:8000/star-players/available/skaven | jq

# Règles régionales
curl http://localhost:8000/star-players/regional-rules/dwarf | jq

# Recherche par nom
curl "http://localhost:8000/star-players/search?q=griff" | jq

# Recherche par compétence
curl "http://localhost:8000/star-players/search?skill=block" | jq

# Recherche par coût
curl "http://localhost:8000/star-players/search?minCost=200000&maxCost=300000" | jq
```

## 📱 Intégration Mobile (React Native)

```typescript
import { STAR_PLAYERS, getStarPlayerBySlug } from '@bb/game-engine';

// Identique à la version web, le package fonctionne aussi sur mobile
const starPlayer = getStarPlayerBySlug('griff_oberwald');
```

## 🐛 Debugging

### Vérifier qu'un Star Player existe

```typescript
const slug = 'griff_oberwald';
const sp = getStarPlayerBySlug(slug);

if (!sp) {
  console.error(`Star Player '${slug}' n'existe pas`);
  // Liste des slugs valides
  console.log('Slugs disponibles:', Object.keys(STAR_PLAYERS));
}
```

### Vérifier les règles régionales d'une équipe

```typescript
const team = 'skaven';
const rules = TEAM_REGIONAL_RULES[team];

if (!rules) {
  console.error(`Équipe '${team}' non trouvée`);
  console.log('Équipes disponibles:', Object.keys(TEAM_REGIONAL_RULES));
} else {
  console.log(`Règles régionales pour ${team}:`, rules);
}
```

## 📚 Ressources

- **Documentation complète :** `STAR-PLAYERS-IMPLEMENTATION.md`
- **Récapitulatif :** `STAR-PLAYERS-COMPLETE.md`
- **Tests :** `packages/game-engine/src/rosters/star-players.test.ts`
- **API :** `apps/server/src/routes/star-players.ts`
- **Composants :** `apps/web/app/components/StarPlayerCard.tsx`

## 💡 Conseils

1. **Toujours vérifier la disponibilité** : Utilisez `getAvailableStarPlayers()` plutôt que d'assumer qu'un Star Player est disponible

2. **Gérer les paires** : Grak/Crumbleberry et Swift Twins doivent être recrutés ensemble

3. **Budgets** : Les coûts sont en po (pièces d'or), divisez par 1000 pour afficher en K po

4. **Compétences** : Les slugs de compétences sont en kebab-case (ex: `mighty-blow-1`, `loner-4`)

5. **Règles spéciales** : Chaque Star Player a une règle unique utilisable une fois par match

## ✅ Checklist d'Intégration

- [ ] Tests unitaires passent
- [ ] API accessible
- [ ] Frontend affiche les Star Players
- [ ] Filtres fonctionnent
- [ ] Sélection fonctionne
- [ ] Coûts corrects
- [ ] Règles régionales correctes
- [ ] Paires gérées correctement
- [ ] Erreurs gérées proprement

---

**Prêt à coder !** 🚀

