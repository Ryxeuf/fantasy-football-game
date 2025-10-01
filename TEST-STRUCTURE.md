# 🧪 Structure des Tests - BlooBowl

## Vue d'ensemble

La structure des tests a été réorganisée pour une meilleure séparation entre les tests unitaires et les tests d'intégration.

## 📁 Organisation des Tests

### **Tests Unitaires** (dans leurs packages respectifs)

#### `packages/game-engine/src/`

- **`actions/`** : Tests des actions et mouvements
  - `action-types.test.ts` (7 tests)
- **`mechanics/`** : Tests des mécaniques de jeu
  - `blitz-limit.test.ts` (7 tests)
  - `blitz.test.ts` (15 tests)
  - `blocking-dice-test.test.ts` (10 tests)
  - `blocking.test.ts` (15 tests)
  - `follow-up.test.ts` (3 tests)
  - `movement.test.ts` (84 tests)
  - `push-direction.test.ts` (6 tests)
  - `push-rules.test.ts` (6 tests)

#### `packages/ui/src/tests/`

- **`BlockDiceIcon.test.tsx`** : Tests des composants UI

**Total des tests unitaires : 153 tests** ✅

### **Tests d'Intégration** (centralisés)

#### `tests/integration/`

- **`complete-game-scenario.test.ts`** : Scénarios de jeu complets
- **`full-game-simulation.test.ts`** : Simulations de parties entières
- **`stress-test.test.ts`** : Tests de performance et stress

## 🚀 Commandes de Test

### Tests Unitaires

```bash
# Tous les tests unitaires
pnpm test

# Tests du game-engine uniquement
cd packages/game-engine && pnpm test

# Tests du UI uniquement
cd packages/ui && pnpm test
```

### Tests d'Intégration

```bash
# Tests d'intégration (depuis la racine)
cd tests/integration && pnpm test

# Ou depuis la racine
pnpm test:integration
```

## 🎯 Avantages de cette Structure

### ✅ **Séparation Claire**

- **Tests unitaires** : Testent des fonctionnalités isolées
- **Tests d'intégration** : Testent des scénarios complets

### ✅ **Maintenabilité**

- Tests unitaires proches du code qu'ils testent
- Tests d'intégration centralisés pour les scénarios complexes

### ✅ **Performance**

- Tests unitaires rapides et ciblés
- Tests d'intégration pour valider le comportement global

### ✅ **Organisation Logique**

- Chaque package gère ses propres tests unitaires
- Tests d'intégration dans un dossier dédié

## 📊 Résultats des Tests

- **153 tests unitaires** passent avec succès
- **Tests d'intégration** prêts pour les scénarios complexes
- **Couverture complète** de toutes les fonctionnalités

## 🔧 Configuration

### Vitest (tests unitaires)

Chaque package a sa propre configuration Vitest dans `vitest.config.ts`

### Tests d'intégration

Configuration centralisée dans `tests/integration/vitest.config.ts`

Cette structure offre une organisation claire et maintenable pour tous les types de tests du projet BlooBowl.
