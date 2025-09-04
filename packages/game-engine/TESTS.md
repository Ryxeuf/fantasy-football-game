# 🧪 Tests du Game Engine

Ce document décrit la suite de tests pour le moteur de jeu BlooBowl.

## 📋 Couverture des tests

### Mouvements de base
- ✅ **getLegalMoves** : Génération des mouvements légaux
  - Mouvements pour l'équipe courante uniquement
  - Exclusion des joueurs étourdis et sans PM
  - Mouvements orthogonaux et diagonaux
  - Mouvement END_TURN toujours disponible

- ✅ **applyMove - MOUVEMENTS** : Application des mouvements
  - Déplacement correct des joueurs
  - Validation de la légalité des mouvements
  - Prévention des déplacements vers cases occupées
  - Gestion du pickup de balle (50% de chance)

- ✅ **applyMove - FIN DE TOUR** : Gestion des tours
  - Changement d'équipe
  - Réinitialisation des PM
  - Gestion des turnovers

### Jets de désquive
- ✅ **requiresDodgeRoll** : Détection des jets nécessaires
  - Pas de jet si pas d'adversaires adjacents
  - Jet requis lors de sortie de case marquée

- ✅ **performDodgeRoll** : Exécution des jets
  - Résultats de dés valides (1-6)
  - Calcul correct du succès basé sur l'AG
  - Application des modificateurs

- ✅ **getAdjacentOpponents** : Détection des adversaires
  - Trouve les adversaires adjacents
  - Exclut les adversaires étourdis

### Intégration
- ✅ **Mouvements avec jets de désquive** : Scénarios complexes
  - Jets automatiques lors de mouvements marqués
  - Gestion des mouvements DODGE explicites
  - Turnover en cas d'échec

### Conditions limites
- ✅ **Gestion des erreurs** : Robustesse
  - Mouvements hors limites
  - Joueurs inexistants
  - Mouvements invalides

## 🚀 Commandes de test

```bash
# Lancer tous les tests
pnpm test

# Lancer les tests en mode watch
pnpm test:run

# Lancer avec couverture de code
pnpm test:coverage

# Depuis la racine du projet
pnpm test
```

## 📊 Couverture de code

- **Statements** : 90.19%
- **Branches** : 83.15%
- **Functions** : 85.71%
- **Lines** : 90.19%

## 🔧 Configuration

- **Framework** : Vitest 2.1.9
- **Coverage** : @vitest/coverage-v8
- **Environment** : Node.js
- **TypeScript** : Support complet

## 📝 Notes importantes

1. **RNG déterministe** : Les tests utilisent des graines fixes pour la reproductibilité
2. **Isolation** : Chaque test est indépendant avec son propre état de jeu
3. **Couverture** : Focus sur les cas de déplacement et les règles Blood Bowl
4. **Maintenance** : Tests faciles à étendre pour de nouvelles fonctionnalités

## 🎯 Prochaines étapes

- [ ] Tests pour les actions de tacle
- [ ] Tests pour les passes
- [ ] Tests pour les blessures
- [ ] Tests de performance pour les gros plateaux
- [ ] Tests d'intégration avec l'interface utilisateur
