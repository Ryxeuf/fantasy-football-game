# 🎲 Système de Notifications de Dés - BlooBowl

## Vue d'ensemble

Le système de notifications de dés affiche des toasts visuels pour tous les jets de dés effectués dans le jeu Blood Bowl, offrant un feedback immédiat et informatif aux joueurs.

## 🎯 Fonctionnalités

### Types de Notifications Supportés

1. **D6** - Dé à 6 faces simple
2. **2D6** - Deux dés à 6 faces
3. **Esquive** - Jet d'agilité avec cible
4. **Ramassage** - Jet de ramassage de balle
5. **Armure** - Jet d'armure
6. **Blocage** - Dés de blocage spéciaux (5 faces)

### Types de Toast

- **Success** (vert) : Jets réussis
- **Error** (rouge) : Jets échoués
- **Info** (bleu) : Informations générales
- **Warning** (jaune) : Avertissements

## 🏗️ Architecture

### Composants Principaux

#### `ToastProvider`
- Fournit le contexte de notification
- Gère l'état des toasts
- Affiche le conteneur de toasts

#### `DiceNotification`
- Composant pour les notifications de dés standard
- Supporte tous les types de jets (esquive, ramassage, armure, etc.)

#### `BlockDiceNotification`
- Composant spécialisé pour les dés de blocage
- Affiche les icônes spécifiques aux résultats de blocage

#### `useDiceNotifications`
- Hook personnalisé pour déclencher les notifications
- Méthodes : `showDiceResult`, `showBlockDiceResult`, `showCustomDiceResult`

### Intégration Game Engine

#### `dice-notifications.ts`
- Fonctions wrapper avec notifications intégrées
- Callbacks configurables pour l'intégration
- Compatible avec le système de dés existant

## 🚀 Utilisation

### Installation des Composants

```tsx
import { ToastProvider, useDiceNotifications } from '@bb/ui';

function App() {
  return (
    <ToastProvider>
      {/* Votre application */}
    </ToastProvider>
  );
}
```

### Configuration des Callbacks

```tsx
import { 
  setDiceNotificationCallback, 
  setBlockDiceNotificationCallback 
} from '@bb/game-engine';

// Configuration des callbacks
setDiceNotificationCallback((playerName, diceResult) => {
  showDiceResult(playerName, diceResult);
});

setBlockDiceNotificationCallback((playerName, blockResult) => {
  showBlockDiceResult(playerName, blockResult);
});
```

### Utilisation des Hooks

```tsx
import { useDiceNotifications } from '@bb/ui';

function GameComponent() {
  const { showDiceResult, showBlockDiceResult } = useDiceNotifications();

  const handleDiceRoll = () => {
    const diceResult = {
      type: 'dodge',
      diceRoll: 4,
      targetNumber: 3,
      success: true,
      modifiers: 0
    };
    
    showDiceResult('Joueur A', diceResult);
  };

  return (
    <button onClick={handleDiceRoll}>
      Lancer le dé
    </button>
  );
}
```

### Utilisation des Fonctions Wrapper

```tsx
import { 
  rollD6WithNotification,
  performDodgeRollWithNotification,
  rollBlockDiceWithNotification 
} from '@bb/game-engine';

// Utilisation directe avec notifications
const result = rollD6WithNotification(rng, 'Joueur A');
const dodgeResult = performDodgeRollWithNotification(player, rng, 0);
const blockResult = rollBlockDiceWithNotification(rng, 'Joueur A');
```

## 🎨 Personnalisation

### Styles des Toasts

Les toasts utilisent Tailwind CSS et peuvent être personnalisés via les classes :

```tsx
// Couleurs de bordure
border-green-400  // Success
border-red-400    // Error
border-yellow-400 // Warning
border-blue-400   // Info

// Icônes personnalisées
const customIcon = <div>🎲</div>;
```

### Durée d'Affichage

```tsx
const toast = {
  type: 'success',
  title: 'Jet réussi',
  message: 'Résultat: 5',
  duration: 3000 // 3 secondes
};
```

## 📱 Responsive Design

- Toasts positionnés en haut à droite
- Adaptation automatique sur mobile
- Animations fluides
- Bouton de fermeture accessible

## 🧪 Tests

### Tests Unitaires

```bash
# Tests des composants UI
cd packages/ui && pnpm test

# Tests du game-engine
cd packages/game-engine && pnpm test
```

### Page de Démonstration

Visitez `/dice-notifications` pour tester le système en action.

## 🔧 Configuration Avancée

### Callbacks Personnalisés

```tsx
// Callback pour logs personnalisés
setDiceNotificationCallback((playerName, diceResult) => {
  console.log(`${playerName} a lancé un ${diceResult.type}: ${diceResult.diceRoll}`);
  showDiceResult(playerName, diceResult);
});
```

### Intégration avec d'Autres Systèmes

```tsx
// Intégration avec un système de logs
setDiceNotificationCallback((playerName, diceResult) => {
  // Log dans la base de données
  logDiceRoll(playerName, diceResult);
  
  // Afficher la notification
  showDiceResult(playerName, diceResult);
});
```

## 📊 Résultats

- **153 tests** passent avec succès ✅
- **6 types de dés** supportés ✅
- **4 types de notifications** visuelles ✅
- **Design responsive** ✅
- **Intégration complète** avec le game-engine ✅

Le système de notifications de dés améliore considérablement l'expérience utilisateur en fournissant un feedback visuel immédiat et informatif pour tous les jets de dés du jeu Blood Bowl.
