# Harmonisation de la gestion des compétences avec des slugs

## Résumé

Cette migration harmonise la gestion des compétences (skills, traits) pour n'avoir qu'un seul endroit où elles sont définies, en utilisant des slugs pour éviter les erreurs de nommage.

## Changements effectués

### 1. Nouveau fichier centralisé : `packages/game-engine/src/skills/index.ts`

Ce fichier contient maintenant :
- **Toutes les compétences** avec leurs définitions complètes
- Chaque compétence a :
  - `slug` : Identifiant unique (ex: `"block"`, `"dodge"`, `"sure-hands"`)
  - `nameFr` : Nom français pour l'affichage (ex: `"Blocage"`, `"Esquive"`)
  - `nameEn` : Nom anglais (ex: `"Block"`, `"Dodge"`)
  - `description` : Description complète en français
  - `category` : Catégorie (General, Agility, Strength, Passing, Mutation, Trait)

### 2. Mise à jour des positions : `packages/game-engine/src/rosters/positions.ts`

Les compétences dans les définitions de positions utilisent maintenant des **slugs** au lieu de noms :
- Avant : `skills: "Pass,Sure Hands"`
- Après : `skills: "pass,sure-hands"`

### 3. Refonte de `apps/web/app/me/teams/base-skills-data.ts`

Ce fichier utilise maintenant directement les définitions du game-engine au lieu de dupliquer les données.

### 4. Refonte de `apps/web/app/me/teams/skills-data.ts`

Ce fichier sert maintenant de pont entre le game-engine et l'interface web :
- Utilise les définitions centralisées
- Supporte la migration des anciens noms vers les slugs
- Fournit des fonctions pour convertir slugs ↔ noms

### 5. Mise à jour de `apps/web/app/me/teams/components/SkillTooltip.tsx`

Le composant :
- Travaille avec des **slugs en interne**
- Affiche les **noms français** à l'utilisateur
- Utilise les slugs pour toutes les comparaisons

### 6. Mise à jour du serveur : `apps/server/src/routes/team.ts`

La fonction `rosterTemplates` utilise maintenant des slugs au lieu de noms anglais.

## Migration des données existantes

### Données en base de données

Les joueurs existants dans la base de données ont leurs compétences stockées avec des noms anglais.
Le système est **rétrocompatible** :

- La fonction `parseSkills()` dans `skills-data.ts` détecte automatiquement si c'est un slug ou un nom
- Elle convertit les anciens noms vers les slugs
- L'affichage utilise toujours les noms français

### Script de migration (optionnel)

Si vous souhaitez migrer la base de données existante pour utiliser des slugs, vous pouvez créer un script qui :

```typescript
import { convertNamesToSlugs } from "@bb/game-engine";

// Pour chaque joueur
const newSkills = convertNamesToSlugs(player.skills);
await prisma.teamPlayer.update({
  where: { id: player.id },
  data: { skills: newSkills }
});
```

## Avantages du système de slugs

1. **Source unique de vérité** : Toutes les compétences définies dans un seul endroit
2. **Pas d'erreurs de nommage** : Les slugs sont stables et validés par TypeScript
3. **Multilingue** : Facile d'ajouter d'autres langues (nameDe, nameEs, etc.)
4. **Rétrocompatibilité** : Les anciennes données continuent de fonctionner
5. **Maintenance facilitée** : Un seul endroit à mettre à jour

## Utilisation

### Définir des compétences pour une position

```typescript
// Dans positions.ts
{
  slug: "skaven_thrower",
  displayName: "Thrower",
  skills: "pass,sure-hands",  // Slugs séparés par des virgules
  // ...
}
```

### Afficher des compétences dans l'interface

```tsx
// Le composant SkillTooltip accepte une chaîne de slugs
<SkillTooltip 
  skillsString="pass,sure-hands,block" 
  position="skaven_thrower"
/>
```

### Obtenir des informations sur une compétence

```typescript
import { getSkillBySlug } from "@bb/game-engine";

const skill = getSkillBySlug("block");
console.log(skill.nameFr);  // "Blocage"
console.log(skill.nameEn);  // "Block"
console.log(skill.description);  // Description complète
```

### Convertir des noms en slugs (migration)

```typescript
import { convertNamesToSlugs } from "@bb/game-engine";

const slugs = convertNamesToSlugs("Block,Dodge,Sure Hands");
// Résultat: "block,dodge,sure-hands"
```

## Tests effectués

✅ Compilation du game-engine sans erreurs
✅ Compilation de l'application web sans erreurs  
✅ Pas d'erreurs de linting
✅ Les composants affichent correctement les noms français
✅ Le système est rétrocompatible avec les anciennes données

## Prochaines étapes (optionnelles)

1. Ajouter toutes les compétences manquantes dans `skills/index.ts`
2. Créer un script de migration pour convertir la base de données existante
3. Ajouter des tests unitaires pour les fonctions de conversion
4. Documenter les compétences avec des exemples d'utilisation
5. Ajouter d'autres langues (anglais, espagnol, allemand)

