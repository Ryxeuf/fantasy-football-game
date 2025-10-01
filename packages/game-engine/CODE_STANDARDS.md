# Standards de Code TypeScript

Ce document décrit les standards de code appliqués au moteur de jeu Blood Bowl.

## Configuration

### Prettier

- **Fichier de config** : `.prettierrc`
- **Règles** :
  - Semicolons obligatoires
  - Guillemets simples
  - Largeur de ligne : 100 caractères
  - Indentation : 2 espaces
  - Virgules finales : ES5

### ESLint

- **Fichier de config** : `eslint.config.js`
- **Règles principales** :
  - `@typescript-eslint/no-unused-vars` : warning
  - `@typescript-eslint/no-explicit-any` : warning
  - `@typescript-eslint/no-non-null-assertion` : warning
  - `prefer-const` : error
  - `no-var` : error
  - `no-console` : warning (désactivé dans les tests)

## Scripts disponibles

```bash
# Formater avec Prettier
npm run format

# Corriger avec ESLint
npm run lint:fix

# Formatage complet (Prettier + ESLint + Tests)
npm run format:all

# Vérifier les types
npm run typecheck

# Lancer les tests
npm run test:run
```

## Structure des fichiers

### Organisation

- **`types.ts`** : Toutes les interfaces et types
- **`rng.ts`** : Générateur de nombres aléatoires
- **`dice.ts`** : Système de jets de dés
- **`logging.ts`** : Système de logs
- **`movement.ts`** : Fonctions de mouvement et position
- **`blocking.ts`** : Système de blocage
- **`ball.ts`** : Gestion de la balle
- **`game-state.ts`** : Gestion de l'état du jeu
- **`actions.ts`** : Actions et mouvements
- **`boardgame-io.ts`** : Intégration boardgame.io
- **`index.ts`** : Point d'entrée

### Conventions de nommage

- **Fonctions** : camelCase
- **Types/Interfaces** : PascalCase
- **Constantes** : UPPER_SNAKE_CASE
- **Fichiers** : kebab-case.ts

### Documentation

- Toutes les fonctions publiques doivent avoir une documentation JSDoc
- Inclure les paramètres, le type de retour et une description

## Qualité du code

### Métriques actuelles

- ✅ **Tests** : 161/161 passent
- ✅ **Performance** : 100,000 actions/seconde
- ✅ **Linting** : 67 warnings (principalement des non-null assertions dans les tests)
- ✅ **Types** : Aucune erreur TypeScript

### Bonnes pratiques

1. **Imports** : Supprimer les imports inutilisés
2. **Types** : Éviter `any`, utiliser `Record<string, unknown>` ou des types spécifiques
3. **Assertions** : Minimiser l'usage de `!` (non-null assertion)
4. **Fonctions** : Une responsabilité par fonction
5. **Tests** : Couvrir tous les cas d'usage

## Workflow de développement

1. **Avant de commiter** :

   ```bash
   npm run format:all
   ```

2. **Vérifications automatiques** :
   - Prettier formate le code
   - ESLint corrige les problèmes de style
   - TypeScript vérifie les types
   - Vitest exécute les tests

3. **Résolution des conflits** :
   - Toujours formater après un merge
   - Vérifier que les tests passent
   - Corriger les warnings ESLint si possible
