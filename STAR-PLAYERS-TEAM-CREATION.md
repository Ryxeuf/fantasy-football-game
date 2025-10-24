# Création d'Équipes avec Star Players

## Vue d'ensemble

Les Star Players peuvent maintenant être recrutés directement lors de la création d'une équipe via les endpoints `/team/create-from-roster` et `/team/build`. Cette intégration permet de créer des équipes complètes avec leurs Star Players en une seule requête API.

## Endpoints Modifiés

### POST `/team/create-from-roster`

Crée une équipe à partir d'un template de roster avec des Star Players optionnels.

**Paramètres de requête :**

```typescript
{
  name: string;           // Nom de l'équipe
  roster: AllowedRoster;  // Type de roster (ex: "skaven", "lizardmen", etc.)
  teamValue?: number;     // Budget en K po (défaut: 1000, min: 100, max: 2000)
  starPlayers?: string[]; // Tableau de slugs de Star Players (optionnel)
}
```

**Exemple de requête :**

```json
{
  "name": "Les Ratiers Fulgurants",
  "roster": "skaven",
  "teamValue": 1500,
  "starPlayers": ["hakflem_skuttlespike", "headsplitter"]
}
```

**Réponse :**

```json
{
  "team": {
    "id": "...",
    "name": "Les Ratiers Fulgurants",
    "roster": "skaven",
    "teamValue": 1500,
    "players": [...],
    "starPlayers": [
      {
        "id": "...",
        "slug": "hakflem_skuttlespike",
        "displayName": "Hakflem Skuttlespike",
        "cost": 180000,
        "hiredAt": "2025-10-24T...",
        "ma": 9,
        "st": 3,
        "ag": 2,
        "pa": null,
        "av": 8,
        "skills": "Block, Dodge, Side Step, Stab, Stunty, Weeping Dagger",
        "hirableBy": ["skaven"],
        "specialRule": "Assassin extraordinaire..."
      },
      {
        "id": "...",
        "slug": "headsplitter",
        "displayName": "Headsplitter",
        "cost": 340000,
        ...
      }
    ]
  }
}
```

### POST `/team/build`

Crée une équipe avec des joueurs personnalisés et des Star Players optionnels.

**Paramètres de requête :**

```typescript
{
  name: string;
  roster: AllowedRoster;
  teamValue?: number;
  choices: Array<{ key: string; count: number }>; // Choix de joueurs
  starPlayers?: string[]; // Tableau de slugs de Star Players (optionnel)
}
```

**Exemple de requête :**

```json
{
  "name": "Les Sauriens de Lustria",
  "roster": "lizardmen",
  "teamValue": 1800,
  "choices": [
    { "key": "saurus_blocker", "count": 6 },
    { "key": "skink_runner", "count": 4 },
    { "key": "chameleon_skink", "count": 1 }
  ],
  "starPlayers": ["hemlock"]
}
```

**Réponse :**

```json
{
  "team": {
    "id": "...",
    "name": "Les Sauriens de Lustria",
    "roster": "lizardmen",
    "players": [...],
    "starPlayers": [
      {
        "id": "...",
        "slug": "hemlock",
        "displayName": "Hemlock",
        "cost": 170000,
        ...
      }
    ]
  },
  "cost": 1450,
  "budget": 1800,
  "breakdown": {
    "players": 1280,
    "starPlayers": 170
  }
}
```

## Validations et Contraintes

### 1. Limite de 16 joueurs

Le nombre total de joueurs (joueurs normaux + Star Players) ne peut pas dépasser 16.

**Erreur :**
```json
{
  "error": "Trop de joueurs ! 14 joueurs + 3 Star Players = 17 (maximum: 16)"
}
```

### 2. Budget

Le coût total des joueurs et des Star Players ne peut pas dépasser le budget de l'équipe.

**Erreur :**
```json
{
  "error": "Budget dépassé: 1650k (1200k joueurs + 450k Star Players) / 1500k"
}
```

### 3. Paires obligatoires

Certains Star Players doivent être recrutés ensemble :
- **Grak & Crumbleberry** : toujours ensemble
- **Lucien Swift & Valen Swift** : toujours ensemble

**Erreur :**
```json
{
  "error": "Grak et Crumbleberry doivent être recrutés ensemble"
}
```

**Requête valide avec paire :**
```json
{
  "name": "Les Gobelins Farceurs",
  "roster": "goblin",
  "teamValue": 1500,
  "starPlayers": ["grak", "crumbleberry"]
}
```

### 4. Disponibilité régionale

Les Star Players ne peuvent être recrutés que par les équipes autorisées selon les règles régionales.

**Erreur :**
```json
{
  "error": "Hakflem Skuttlespike n'est pas disponible pour cette équipe"
}
```

### 5. Doublons

Un même Star Player ne peut être recruté qu'une seule fois par équipe.

**Erreur :**
```json
{
  "error": "Un Star Player ne peut être recruté qu'une seule fois"
}
```

## Exemples d'Utilisation

### Exemple 1 : Équipe Skaven avec 2 Star Players

```bash
curl -X POST http://localhost:3001/team/create-from-roster \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Les Ratiers Fulgurants",
    "roster": "skaven",
    "teamValue": 1500,
    "starPlayers": ["hakflem_skuttlespike", "headsplitter"]
  }'
```

### Exemple 2 : Équipe Goblin avec la paire Grak & Crumbleberry

```bash
curl -X POST http://localhost:3001/team/build \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Les Gobelins Farceurs",
    "roster": "goblin",
    "teamValue": 1200,
    "choices": [
      { "key": "goblin_lineman", "count": 11 }
    ],
    "starPlayers": ["grak", "crumbleberry"]
  }'
```

### Exemple 3 : Équipe Halfling avec un Treeman Star Player

```bash
curl -X POST http://localhost:3001/team/create-from-roster \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Les Demi-Hommes Gourmands",
    "roster": "halfling",
    "teamValue": 1000,
    "starPlayers": ["deeproot_strongbranch"]
  }'
```

## Modifications dans l'API

### Budget et Calculs

Le système calcule automatiquement :
1. Le coût des joueurs normaux (choix du roster)
2. Le coût des Star Players (incluant les paires)
3. Le total ne doit pas dépasser le budget (`teamValue * 1000` po)

### Enrichissement des Star Players

Les Star Players retournés dans la réponse sont enrichis avec leurs données complètes :
- Caractéristiques (MA, ST, AG, PA, AV)
- Compétences
- Règles spéciales
- Date de recrutement

### Transactions atomiques

Toutes les opérations (création d'équipe, création de joueurs, recrutement de Star Players) sont effectuées dans une transaction unique pour garantir la cohérence des données.

## Intégration Frontend

### Formulaire de création d'équipe

Le frontend peut maintenant proposer :
1. Sélection du roster
2. Définition du budget
3. Choix des joueurs (pour `/build`)
4. **Nouvelle section** : Sélection des Star Players disponibles
   - Affichage des Star Players disponibles pour ce roster
   - Indication du coût
   - Indication des paires obligatoires
   - Calcul en temps réel du budget restant

### Composant React exemple

```tsx
import { useState, useEffect } from 'react';

function TeamCreationForm() {
  const [roster, setRoster] = useState('skaven');
  const [budget, setBudget] = useState(1000);
  const [selectedStarPlayers, setSelectedStarPlayers] = useState<string[]>([]);
  const [availableStarPlayers, setAvailableStarPlayers] = useState([]);

  useEffect(() => {
    // Récupérer les Star Players disponibles pour ce roster
    fetch(`/star-players/available/${roster}`)
      .then(res => res.json())
      .then(data => setAvailableStarPlayers(data.starPlayers));
  }, [roster]);

  const handleStarPlayerToggle = (slug: string) => {
    if (selectedStarPlayers.includes(slug)) {
      setSelectedStarPlayers(prev => prev.filter(s => s !== slug));
    } else {
      setSelectedStarPlayers(prev => [...prev, slug]);
    }
  };

  const totalStarPlayersCost = selectedStarPlayers.reduce((acc, slug) => {
    const sp = availableStarPlayers.find(sp => sp.slug === slug);
    return acc + (sp?.cost || 0);
  }, 0);

  return (
    <form>
      {/* Roster, Budget, Players selection... */}
      
      <section>
        <h3>Star Players Disponibles</h3>
        {availableStarPlayers.map(sp => (
          <div key={sp.slug}>
            <input
              type="checkbox"
              checked={selectedStarPlayers.includes(sp.slug)}
              onChange={() => handleStarPlayerToggle(sp.slug)}
            />
            <span>{sp.displayName} - {sp.cost / 1000}K po</span>
          </div>
        ))}
      </section>

      <div>
        Budget restant: {budget - totalStarPlayersCost / 1000}K po
      </div>

      <button type="submit">Créer l'équipe</button>
    </form>
  );
}
```

## Règles de Blood Bowl Respectées

✅ Maximum 16 joueurs (normaux + Star Players)  
✅ Respect du budget initial  
✅ Paires obligatoires (Grak & Crumbleberry, Swift Twins)  
✅ Règles régionales de disponibilité  
✅ Un Star Player ne peut être recruté qu'une fois par équipe  
✅ Coûts officiels des Star Players (incluant Crumbleberry à 0 po)  

## Prochaines Étapes

1. **Frontend** : Ajouter l'interface de sélection des Star Players dans le formulaire de création d'équipe
2. **Tests** : Ajouter des tests d'intégration pour les créations d'équipes avec Star Players
3. **Documentation** : Compléter la documentation utilisateur avec des captures d'écran

## Résumé Technique

- **Fichiers modifiés** : `apps/server/src/routes/team.ts`
- **Nouvelles fonctions utilisées** : 
  - `validateStarPlayerPairs()`
  - `calculateStarPlayersCost()`
  - `validateStarPlayersForTeam()`
- **Modèle Prisma** : `TeamStarPlayer` (relation avec `Team`)
- **Endpoints** : `POST /team/create-from-roster` et `POST /team/build` avec support des Star Players

