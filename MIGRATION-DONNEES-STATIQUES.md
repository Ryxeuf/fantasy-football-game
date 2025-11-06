# Migration des Données Statiques vers la Base de Données

Ce document décrit la migration complète des données statiques (rosters, positions, star players, compétences) vers la base de données avec des relations.

## Vue d'ensemble

Toutes les données statiques précédemment définies dans les fichiers TypeScript/JavaScript ont été migrées vers la base de données PostgreSQL avec Prisma. Les données sont maintenant gérées via des interfaces d'administration.

## Modèles de Base de Données

### Skill (Compétence)
- `id`: Identifiant unique
- `slug`: Slug unique (ex: "block", "dodge")
- `nameFr`: Nom français
- `nameEn`: Nom anglais
- `description`: Description de la compétence
- `category`: Catégorie (General, Agility, Strength, Passing, Mutation, Trait)

### Roster (Équipe)
- `id`: Identifiant unique
- `slug`: Slug unique (ex: "skaven", "lizardmen")
- `name`: Nom d'affichage
- `budget`: Budget de départ en kpo
- `tier`: Tier (I, II, III)
- `naf`: Disponible dans NAF

### Position
- `id`: Identifiant unique
- `rosterId`: Référence au roster
- `slug`: Slug unique (ex: "skaven_lineman")
- `displayName`: Nom d'affichage
- `cost`: Coût en kpo
- `min`/`max`: Limites min/max
- `ma`, `st`, `ag`, `pa`, `av`: Statistiques
- Relations many-to-many avec `Skill` via `PositionSkill`

### StarPlayer
- `id`: Identifiant unique
- `slug`: Slug unique (ex: "griff_oberwald")
- `displayName`: Nom d'affichage
- `cost`: Coût en po
- `ma`, `st`, `ag`, `pa`, `av`: Statistiques
- `specialRule`: Règle spéciale (optionnel)
- `imageUrl`: URL de l'image (optionnel)
- Relations many-to-many avec `Skill` via `StarPlayerSkill`
- Relations avec `Roster` et règles régionales via `StarPlayerHirableBy`

## Étapes de Migration

### 1. Mettre à jour le schéma Prisma

Le schéma Prisma a été mis à jour avec les nouveaux modèles. Exécutez :

```bash
cd apps/server
npx prisma migrate dev --name add_static_data_models
```

### 2. Importer les données statiques

Exécutez le script de migration :

```bash
cd apps/server
npx tsx migrate-static-data-to-db.ts
```

Ce script importe :
- Toutes les compétences depuis `packages/game-engine/src/skills/index.ts`
- Tous les rosters depuis `packages/game-engine/src/rosters/positions.ts`
- Toutes les positions avec leurs relations de compétences
- Tous les Star Players avec leurs compétences et règles de recrutement

### 3. Vérifier les données

Accédez à l'interface d'administration :
- `/admin/data/skills` - Compétences
- `/admin/data/rosters` - Rosters
- `/admin/data/positions` - Positions
- `/admin/data/star-players` - Star Players

## Interfaces d'Administration

### Routes API

Toutes les routes sont préfixées par `/admin/data` et nécessitent les droits administrateur :

#### Compétences
- `GET /admin/data/skills` - Liste des compétences (avec filtres category, search)
- `GET /admin/data/skills/:id` - Détails d'une compétence
- `POST /admin/data/skills` - Créer une compétence
- `PUT /admin/data/skills/:id` - Mettre à jour une compétence
- `DELETE /admin/data/skills/:id` - Supprimer une compétence

#### Rosters
- `GET /admin/data/rosters` - Liste des rosters
- `GET /admin/data/rosters/:id` - Détails d'un roster avec ses positions
- `POST /admin/data/rosters` - Créer un roster
- `PUT /admin/data/rosters/:id` - Mettre à jour un roster
- `DELETE /admin/data/rosters/:id` - Supprimer un roster

#### Positions
- `GET /admin/data/positions` - Liste des positions (avec filtre rosterId)
- `GET /admin/data/positions/:id` - Détails d'une position
- `POST /admin/data/positions` - Créer une position
- `PUT /admin/data/positions/:id` - Mettre à jour une position
- `DELETE /admin/data/positions/:id` - Supprimer une position

#### Star Players
- `GET /admin/data/star-players` - Liste des Star Players (avec filtre search)
- `GET /admin/data/star-players/:id` - Détails d'un Star Player
- `POST /admin/data/star-players` - Créer un Star Player
- `PUT /admin/data/star-players/:id` - Mettre à jour un Star Player
- `DELETE /admin/data/star-players/:id` - Supprimer un Star Player

### Interfaces Web

Les interfaces d'administration sont accessibles via :
- `/admin/data/skills` - Gestion des compétences
- `/admin/data/rosters` - Gestion des rosters
- `/admin/data/positions` - Gestion des positions
- `/admin/data/star-players` - Gestion des Star Players

Chaque interface permet :
- Voir la liste des éléments
- Filtrer/rechercher
- Créer de nouveaux éléments
- Modifier des éléments existants
- Supprimer des éléments

## Migration du Code Existant

Le code existant utilise encore les données statiques. Pour migrer vers la base de données :

### 1. Créer des fonctions de récupération depuis la base de données

Exemple pour récupérer un roster :

```typescript
import { prisma } from '../prisma';

export async function getRosterFromDb(slug: string) {
  const roster = await prisma.roster.findUnique({
    where: { slug },
    include: {
      positions: {
        include: {
          skills: {
            include: { skill: true }
          }
        }
      }
    }
  });
  
  if (!roster) return null;
  
  // Convertir au format attendu
  return {
    name: roster.name,
    budget: roster.budget,
    tier: roster.tier as "I" | "II" | "III",
    naf: roster.naf,
    positions: roster.positions.map(p => ({
      slug: p.slug,
      displayName: p.displayName,
      cost: p.cost,
      min: p.min,
      max: p.max,
      ma: p.ma,
      st: p.st,
      ag: p.ag,
      pa: p.pa,
      av: p.av,
      skills: p.skills.map(ps => ps.skill.slug).join(","),
    }))
  };
}
```

### 2. Mettre à jour les routes API

Remplacer les imports de données statiques par des appels à la base de données dans :
- `apps/server/src/routes/team.ts`
- `apps/server/src/routes/star-players.ts`
- Tout autre fichier utilisant `TEAM_ROSTERS`, `STAR_PLAYERS`, ou `SKILLS_DEFINITIONS`

### 3. Mettre à jour le game-engine (optionnel)

Si vous souhaitez garder la compatibilité avec le code existant, vous pouvez créer des fonctions qui récupèrent depuis la base de données et transforment au format attendu.

## Notes Importantes

1. **Compatibilité** : Le code existant continue de fonctionner avec les données statiques. La migration du code applicatif peut être faite progressivement.

2. **Performance** : Pour améliorer les performances, considérez d'ajouter un cache Redis ou de mettre en cache les données fréquemment accédées.

3. **Validation** : Les validations existantes (min/max, budget, etc.) doivent être maintenues lors de l'utilisation des données depuis la base de données.

4. **Tests** : Mettez à jour les tests pour utiliser les données de la base de données ou des fixtures de test.

## Prochaines Étapes

1. ✅ Migration du schéma Prisma
2. ✅ Script de migration des données
3. ✅ Routes API d'administration
4. ✅ Interfaces web d'administration
5. ⏳ Migration du code applicatif pour utiliser la base de données
6. ⏳ Mise à jour des tests
7. ⏳ Documentation des changements pour les développeurs



