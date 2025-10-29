# Centralisation de la gestion des compétences des Star Players

## 📋 Problème identifié

Les compétences des star players étaient affichées de manière incohérente entre les différentes pages :
- **Page de création d'équipe** : Affichage correct avec noms français
- **Page de liste des star players** : Compétences mal formatées (side-step, microbe., etc.)
- **Page de détail d'un star player** : Mêmes problèmes + doublons

### Causes racines

1. **Données brutes non nettoyées** dans `star-players.ts` :
   - Slugs incorrects (`side-step` au lieu de `sidestep`)
   - Suffixes inutiles (`microbe.` avec le point)
   - Balises HTML (`<strong>`, `&nbsp;`)
   - Doublons (`Microbe*` et `microbe.`)

2. **Logique décentralisée** :
   - Chaque composant implémentait sa propre logique de parsing
   - Pas de source unique de vérité pour l'affichage des compétences

## ✅ Solution implémentée

### 1. Nettoyage des données (59 star players mis à jour)

Script exécuté pour nettoyer automatiquement toutes les compétences dans `packages/game-engine/src/rosters/star-players.ts` :

**Avant :**
```typescript
skills: "claws,dauntless,dodge,frenzy,jump-up,loner-4,no-hands,side-step,stunty,microbe."
```

**Après :**
```typescript
skills: "claws,dauntless,dodge,frenzy,jump-up,loner-4,no-hands,sidestep,stunty"
```

### 2. Création d'utilitaires centralisés

Nouveau fichier : `packages/game-engine/src/rosters/star-players-utils.ts`

Fonctions exportées :
- `parseStarPlayerSkills(starPlayer)` - Parse les compétences en tableau de slugs
- `getStarPlayerSkillDefinitions(starPlayer)` - Retourne les définitions complètes
- `getStarPlayerSkillDisplayNames(starPlayer)` - Retourne les noms d'affichage français
- `formatStarPlayerSkills(starPlayer)` - Retourne un objet complet avec slugs, noms et définitions

### 3. Mise à jour des composants

#### StarPlayerCard.tsx (cartes de liste)
**Avant :**
```typescript
const formatSkills = (skills: string) => {
  return skills.split(',').map(skill => {
    const skillName = skill.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return skillName;
  });
};
```

**Après :**
```typescript
import { getStarPlayerSkillDisplayNames } from '@bb/game-engine';

const skillDisplayNames = getStarPlayerSkillDisplayNames(starPlayer);
```

#### Page de détail ([slug]/page.tsx)
**Avant :**
```typescript
const skills = starPlayer.skills.split(',').map(s => s.trim());
```

**Après :**
```typescript
import { parseStarPlayerSkills } from '@bb/game-engine';

const skills = parseStarPlayerSkills(starPlayer);
```

### 4. Ajout de compétences manquantes

7 nouvelles compétences ajoutées dans `packages/game-engine/src/skills/index.ts` :
- ✅ `animosity` - Animosité*
- ✅ `bloodlust` - Soif de Sang*
- ✅ `plague-ridden` - Porteur de Peste*
- ✅ `stakes` - Pieux*
- ✅ `timmm-ber` - Timmm-ber!*
- ✅ `pogo-stick` - Échasses à Ressort*
- ✅ `drunkard` - Poivrot*

### 5. Mise à jour du mapping

40+ correspondances ajoutées dans `apps/web/app/me/teams/skills-data.ts` pour gérer toutes les variantes françaises et erreurs communes.

## 📊 Résultat

### Avant
- ❌ Compétences avec des caractères parasites (`microbe.`)
- ❌ Slugs incorrects (`side-step`)
- ❌ Doublons de compétences
- ❌ Noms anglais non traduits
- ❌ Logique dupliquée dans chaque composant

### Après
- ✅ Compétences propres et cohérentes
- ✅ Slugs corrects (`sidestep`)
- ✅ Pas de doublons
- ✅ Noms français affichés correctement
- ✅ Logique centralisée et réutilisable

## 🔄 Architecture finale

```
packages/game-engine/
├── src/rosters/
│   ├── star-players.ts              # Données nettoyées (slugs propres uniquement)
│   ├── star-players-utils.ts        # ⭐ Utilitaires centralisés (nouveau)
│   └── index.ts                     # Exports
└── src/skills/
    └── index.ts                     # +7 nouvelles compétences

apps/web/app/
├── components/
│   ├── StarPlayerCard.tsx           # ✅ Utilise getStarPlayerSkillDisplayNames
│   └── SkillTooltip.tsx             # ✅ Utilise getSkillDescription
└── star-players/
    └── [slug]/page.tsx              # ✅ Utilise parseStarPlayerSkills
```

## 🎯 Principe appliqué

**Single Source of Truth** : 
- Les compétences sont stockées comme des slugs propres dans `star-players.ts`
- Les fonctions utilitaires dans `star-players-utils.ts` gèrent la conversion
- Les composants utilisent ces fonctions au lieu de parser manuellement
- Le système de skills dans `skills/index.ts` est la référence pour les noms et descriptions

## 📝 Fichiers modifiés

1. `packages/game-engine/src/rosters/star-players.ts` - Nettoyage des 59 star players
2. `packages/game-engine/src/rosters/star-players-utils.ts` - Nouveau fichier
3. `packages/game-engine/src/rosters/index.ts` - Exports des utilitaires
4. `packages/game-engine/src/skills/index.ts` - +7 compétences
5. `apps/web/app/me/teams/skills-data.ts` - +40 mappings
6. `apps/web/app/components/StarPlayerCard.tsx` - Utilise logique centralisée
7. `apps/web/app/star-players/[slug]/page.tsx` - Utilise logique centralisée

## 🚀 Bénéfices

1. **Maintenabilité** : Une seule source de vérité pour l'affichage des compétences
2. **Cohérence** : Tous les composants affichent les compétences de la même manière
3. **Qualité** : Données nettoyées et validées
4. **Extensibilité** : Facile d'ajouter de nouvelles compétences ou star players
5. **Performance** : Parsing optimisé et réutilisable

