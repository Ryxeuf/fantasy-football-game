# Correction du roster Hommes-Lézards - Ajout des Chameleon Skinks

## Date : 15 Octobre 2025

## Problème identifié

Le roster des Hommes-Lézards était **incomplet**. Il manquait une position cruciale : les **Chameleon Skinks**.

### Avant la correction

Le roster ne contenait que 3 positions :
- ❌ Skink (générique) - 0-8 joueurs
- ✅ Saurus - 0-6 joueurs  
- ✅ Kroxigor - 0-1 joueur

### Selon les règles officielles Blood Bowl 2020

Le roster devrait contenir **4 positions distinctes** :
- ✅ **Skink Runner Linemen** - 0-12 joueurs, 60k
- ✅ **Chameleon Skinks** - 0-2 joueurs, 70k (MANQUANT !)
- ✅ Saurus Blockers - 0-6 joueurs, 85k
- ✅ Kroxigor - 0-1 joueur, 140k

## Corrections appliquées

### 1. Fichier : `packages/game-engine/src/rosters/positions.ts`

**Avant :**
```typescript
{
  slug: "lizardmen_skink",
  displayName: "Skink",
  cost: 60,
  min: 0,
  max: 8,
  ma: 8,
  st: 2,
  ag: 3,
  pa: 5,
  av: 8,
  skills: "Dodge,Stunty",
}
```

**Après :**
```typescript
// Position 1 : Skink Runner Linemen
{
  slug: "lizardmen_skink_runner",
  displayName: "Skink Runner",
  cost: 60,
  min: 0,
  max: 12,
  ma: 8,
  st: 2,
  ag: 3,
  pa: 4,
  av: 8,
  skills: "Dodge,Stunty",
}

// Position 2 : Chameleon Skinks (NOUVEAU)
{
  slug: "lizardmen_chameleon_skink",
  displayName: "Chameleon Skink",
  cost: 70,
  min: 0,
  max: 2,
  ma: 7,
  st: 2,
  ag: 3,
  pa: 3,
  av: 8,
  skills: "Dodge,On the Ball,Shadowing,Stunty",
}
```

### 2. Fichier : `packages/game-engine/src/rosters/positions.js`

Synchronisé avec les modifications TypeScript.

### 3. Fichier : `apps/server/src/routes/team.ts`

**Template par défaut mis à jour :**
- 6 Saurus Blockers
- 4 Skink Runners
- 1 Chameleon Skink (NOUVEAU)
- (Kroxigor optionnel non inclus par défaut)

### 4. Mapping Legacy

Mise à jour du mapping pour la rétrocompatibilité :
```typescript
"skink": "lizardmen_skink_runner",
"lizardmen_skink": "lizardmen_skink_runner", // Migration ancien slug
"chameleon_skink": "lizardmen_chameleon_skink",
```

## Différences entre les deux types de Skinks

| Caractéristique | Skink Runner | Chameleon Skink |
|----------------|--------------|-----------------|
| **Quantité** | 0-12 | 0-2 |
| **Coût** | 60,000 | 70,000 |
| **MA** | 8 | 7 |
| **PA (Passing)** | 4+ | **3+** (meilleur) |
| **Compétences** | Dodge, Stunty | Dodge, **On the Ball**, **Shadowing**, Stunty |

### Avantages des Chameleon Skinks

- **Meilleur passeur** (PA 3+ vs 4+)
- **On the Ball** : Peut se déplacer vers le ballon qui rebondit
- **Shadowing** : Peut suivre les adversaires qui s'éloignent
- Joueur spécialisé plus cher mais limité à 2 maximum

## Tests et validation

- ✅ Compilation TypeScript réussie
- ✅ Pas d'erreurs de linting
- ✅ Mapping legacy ajouté pour la migration
- ✅ Template serveur mis à jour

## Impact sur les équipes existantes

⚠️ **Migration nécessaire** : Les équipes Lizardmen existantes qui utilisaient l'ancien slug `"lizardmen_skink"` seront automatiquement migrées vers `"lizardmen_skink_runner"` grâce au mapping legacy.

## Source des données

Fichier de référence : `data/rules.txt`, lignes 2460-2470
- Blood Bowl 2020 - Règles officielles
- Section : HOMMES–LÉZARDS

## Prochaines étapes

1. Tester la création d'une nouvelle équipe Lizardmen
2. Vérifier la migration des équipes existantes
3. Valider les compétences "On the Ball" et "Shadowing" dans le moteur de jeu

