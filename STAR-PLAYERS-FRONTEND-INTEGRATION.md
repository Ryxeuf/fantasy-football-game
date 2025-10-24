# Intégration Frontend des Star Players

## 🎯 Vue d'ensemble

Intégration complète de la sélection des Star Players dans le formulaire de création d'équipe du frontend web. Cette intégration permet aux utilisateurs de sélectionner des Star Players lors de la création de leur équipe avec toutes les validations en temps réel.

## ✅ Travail Réalisé

### 1. Composant `StarPlayerSelector`

**Fichier :** `apps/web/app/components/StarPlayerSelector.tsx`

#### Fonctionnalités

✅ **Récupération automatique des Star Players disponibles**
- Appel API à `/star-players/available/:roster`
- Filtrage automatique selon le roster sélectionné
- Chargement asynchrone avec états de chargement et d'erreur

✅ **Gestion des paires obligatoires**
- Détection automatique des paires (Grak/Crumbleberry, Swift Twins)
- Sélection/désélection automatique du partenaire
- Affichage visuel des paires avec badge

✅ **Validation en temps réel**
- Calcul du coût total des Star Players
- Vérification de la limite de 16 joueurs (normaux + Star Players)
- Vérification du budget disponible
- Messages d'erreur explicites

✅ **Interface utilisateur intuitive**
- Cartes interactives pour chaque Star Player
- Détails expandables (compétences, règles spéciales)
- Affichage des caractéristiques (MA, ST, AG, PA, AV)
- Indicateurs visuels (sélectionné, désactivé, paire)
- Résumé de la sélection avec coûts

#### Props du Composant

```typescript
interface StarPlayerSelectorProps {
  roster: string;                         // Roster de l'équipe
  selectedStarPlayers: string[];          // Slugs des Star Players sélectionnés
  onSelectionChange: (selected: string[]) => void; // Callback de changement
  currentPlayerCount: number;             // Nombre de joueurs normaux
  availableBudget: number;                // Budget disponible en po
  disabled?: boolean;                     // Désactiver le sélecteur
}
```

### 2. Intégration dans le Builder d'Équipe

**Fichier :** `apps/web/app/me/teams/new/page.tsx`

#### Modifications

✅ **Ajout de l'état pour les Star Players**
```typescript
const [selectedStarPlayers, setSelectedStarPlayers] = useState<string[]>([]);
```

✅ **Calcul du nombre total de joueurs**
```typescript
const totalPlayersWithStars = useMemo(
  () => totalPlayers + selectedStarPlayers.length,
  [totalPlayers, selectedStarPlayers],
);
```

✅ **Intégration du composant dans le formulaire**
```tsx
<StarPlayerSelector
  roster={rosterId}
  selectedStarPlayers={selectedStarPlayers}
  onSelectionChange={setSelectedStarPlayers}
  currentPlayerCount={totalPlayers}
  availableBudget={(teamValue - total) * 1000}
/>
```

✅ **Modification de la fonction submit**
```typescript
body: JSON.stringify({
  name,
  roster: rosterId,
  teamValue,
  choices: Object.entries(counts).map(([slug, count]) => ({
    key: slug,
    count,
  })),
  starPlayers: selectedStarPlayers, // ✨ Ajout
}),
```

✅ **Amélioration de l'affichage du résumé**
- Dashboard avec 4 indicateurs : Coût joueurs, Budget total, Budget restant, Joueurs total
- Validation visuelle avec couleurs (vert = OK, rouge = erreur)
- Messages d'erreur contextuels
- Validation du bouton "Créer l'équipe"

### 3. Validations Côté Client

#### Validations Implémentées

| Validation | Implémentation | Message |
|------------|----------------|---------|
| Limite de joueurs | `totalPlayersWithStars > 16` | "⚠️ Maximum 16 joueurs autorisés (actuellement X)" |
| Minimum de joueurs | `totalPlayersWithStars < 11` | "⚠️ Il vous faut au moins 11 joueurs (actuellement X)" |
| Budget dépassé | Géré par `StarPlayerSelector` | "⚠️ Budget dépassé de XK po" |
| Paires obligatoires | Sélection automatique | Badge "Paire avec [nom]" |

#### Bouton de Création

Le bouton est désactivé si :
- `totalPlayersWithStars < 11`
- `totalPlayersWithStars > 16`

Le composant `StarPlayerSelector` empêche la sélection de Star Players qui dépasseraient ces limites.

## 🎨 Interface Utilisateur

### Layout du Formulaire

```
┌─────────────────────────────────────────────────────┐
│ Créer une équipe                                    │
├─────────────────────────────────────────────────────┤
│ [Nom de l'équipe]                                   │
│ [Roster ▼] [Budget: 1000K po]                       │
├─────────────────────────────────────────────────────┤
│ Tableau des positions de joueurs                    │
│ (avec boutons +/- pour ajuster les quantités)       │
├─────────────────────────────────────────────────────┤
│ ⭐ Star Players Disponibles          2 sélectionné(s)│
│ ┌─────────────────────────────────────────────────┐ │
│ │ ☐ Hakflem Skuttlespike         180K po          │ │
│ │   MA 9 • ST 3 • AG 2+ • AV 8+                   │ │
│ │   [Voir les détails]                            │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ ☑ Grak    Paire avec Crumbleberry    280K po    │ │
│ │   MA 5 • ST 6 • AG 4+ • AV 10+                  │ │
│ │   [Masquer les détails]                         │ │
│ │   Compétences: Block, Mighty Blow...            │ │
│ │   Règle spéciale: ...                           │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Coût total: 280K po                                 │
│ Joueurs: 13 / 16                                    │
├─────────────────────────────────────────────────────┤
│ Résumé                                              │
│ Coût joueurs: 1200K po  │  Budget total: 1500K po  │
│ Budget restant: 20K po  │  Joueurs: 13 / 16 ✓      │
│                                                     │
│ ✅ Équipe valide (11 joueurs + 2 Star Players)      │
│                                   [Créer l'équipe] │
└─────────────────────────────────────────────────────┘
```

### États Visuels

#### Star Player non sélectionné
- Fond blanc
- Hover: fond gris clair
- Border gris

#### Star Player sélectionné
- Fond vert clair (`bg-emerald-50`)
- Border vert (`border-emerald-300`)
- Checkbox cochée

#### Star Player désactivé
- Fond gris (`bg-gray-100`)
- Border gris (`border-gray-300`)
- Checkbox désactivée
- Raisons possibles :
  - Limite de 16 joueurs atteinte
  - Budget insuffisant
  - Partenaire obligatoire manquant

#### Paire obligatoire
- Badge violet "Paire avec [nom]"
- Sélection automatique du partenaire
- Désélection automatique du partenaire

## 🔄 Flux Utilisateur

### Scénario 1 : Création d'équipe Skaven avec Hakflem

1. Utilisateur arrive sur `/me/teams`
2. Saisit "Les Ratiers Fulgurants"
3. Sélectionne "Skavens"
4. Définit budget à 1500K po
5. Clique sur "Ouvrir le builder"
6. → Redirigé vers `/me/teams/new?name=...&roster=skaven&teamValue=1500`
7. Ajuste les joueurs dans le tableau (ex: 11 linemen)
8. Fait défiler jusqu'aux Star Players
9. Voit la liste des Star Players disponibles pour Skavens
10. Coche "Hakflem Skuttlespike" (180K po)
11. Le résumé se met à jour :
    - Coût total : 780K (600K joueurs + 180K Hakflem)
    - Budget restant : 720K
    - Joueurs : 12 / 16
12. Clique "Voir les détails" pour voir les compétences
13. Clique sur "Créer l'équipe"
14. → Redirigé vers `/me/teams/[id]`

### Scénario 2 : Création avec paire Grak & Crumbleberry

1. Utilisateur crée une équipe Goblin
2. Ajoute 11 Goblin Linemen
3. Dans la section Star Players, voit Grak (280K po)
4. Coche "Grak"
5. **Automatiquement**, "Crumbleberry" (0K po) est aussi coché
6. Le badge "Paire avec Crumbleberry" s'affiche
7. Le résumé affiche :
    - Joueurs : 13 / 16 (11 + 2)
    - Coût : 550K + 280K = 830K
8. Clique sur "Créer l'équipe"
9. L'équipe est créée avec Grak ET Crumbleberry

### Scénario 3 : Validation budget dépassé

1. Utilisateur crée une équipe avec budget 1000K po
2. Ajoute des joueurs pour 900K po (11 joueurs)
3. Essaie de sélectionner Hakflem (180K po)
4. **Le checkbox reste gris et désactivé**
5. Message affiché : "⚠️ Budget dépassé de 80K po"
6. L'utilisateur doit :
   - Retirer des joueurs, ou
   - Augmenter le budget, ou
   - Choisir un Star Player moins cher

## 🧪 Tests Manuels à Effectuer

### Test 1 : Sélection simple
- [ ] Créer une équipe Skaven
- [ ] Sélectionner Hakflem
- [ ] Vérifier que le coût s'affiche correctement
- [ ] Créer l'équipe
- [ ] Vérifier que Hakflem est bien dans l'équipe créée

### Test 2 : Paire Grak & Crumbleberry
- [ ] Créer une équipe Goblin
- [ ] Sélectionner Grak
- [ ] Vérifier que Crumbleberry est auto-sélectionné
- [ ] Désélectionner Grak
- [ ] Vérifier que Crumbleberry est auto-désélectionné
- [ ] Créer l'équipe avec les deux
- [ ] Vérifier la présence des deux dans l'équipe

### Test 3 : Limite de 16 joueurs
- [ ] Ajouter 15 joueurs normaux
- [ ] Essayer de sélectionner 2 Star Players
- [ ] Vérifier que c'est bloqué
- [ ] Retirer un joueur
- [ ] Vérifier qu'on peut maintenant sélectionner 1 Star Player

### Test 4 : Budget insuffisant
- [ ] Créer une équipe avec petit budget (ex: 1000K)
- [ ] Remplir avec des joueurs chers
- [ ] Essayer de sélectionner un Star Player cher
- [ ] Vérifier que c'est bloqué avec message d'erreur

### Test 5 : Changement de roster
- [ ] Commencer avec Skavens et sélectionner Hakflem
- [ ] Changer le roster pour Halfling
- [ ] Vérifier que la liste de Star Players change
- [ ] Vérifier que Hakflem n'est plus dans la sélection

### Test 6 : Détails expandables
- [ ] Cliquer sur "Voir les détails" d'un Star Player
- [ ] Vérifier que les compétences et règles spéciales s'affichent
- [ ] Cliquer sur "Masquer les détails"
- [ ] Vérifier que les détails se cachent

### Test 7 : Validation du bouton
- [ ] Créer une équipe avec seulement 10 joueurs
- [ ] Vérifier que le bouton est désactivé
- [ ] Ajouter 1 joueur
- [ ] Vérifier que le bouton est activé
- [ ] Ajouter 7 Star Players pour dépasser 16
- [ ] Vérifier que le bouton est désactivé

## 📊 Flux de Données

```
User Action
    ↓
┌───────────────────────────────────────────────┐
│ NewTeamBuilder Component                      │
│                                               │
│ State:                                        │
│ - roster: string                              │
│ - selectedStarPlayers: string[]               │
│ - positions: Position[]                       │
│ - counts: Record<string, number>              │
│ - totalPlayers: number                        │
│ - totalPlayersWithStars: number               │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │ StarPlayerSelector                        │ │
│ │                                           │ │
│ │ Props:                                    │ │
│ │ - roster                                  │ │
│ │ - selectedStarPlayers                     │ │
│ │ - currentPlayerCount                      │ │
│ │ - availableBudget                         │ │
│ │                                           │ │
│ │ API Call:                                 │ │
│ │ GET /star-players/available/${roster}     │ │
│ │                                           │ │
│ │ User selects Star Player                  │ │
│ │         ↓                                 │ │
│ │ onSelectionChange(newSelection)           │ │
│ │         ↓                                 │ │
│ │ Validate pairs                            │ │
│ │ Validate budget                           │ │
│ │ Validate player limit                     │ │
│ └───────────────────────────────────────────┘ │
│                     ↓                         │
│ setSelectedStarPlayers(newSelection)          │
│                     ↓                         │
│ Re-render with updated selection              │
│                     ↓                         │
│ User clicks "Créer l'équipe"                  │
│                     ↓                         │
│ POST /team/build                              │
│ Body: {                                       │
│   name, roster, teamValue,                    │
│   choices: [...],                             │
│   starPlayers: selectedStarPlayers            │
│ }                                             │
│                     ↓                         │
│ Backend validation                            │
│                     ↓                         │
│ Team created                                  │
│                     ↓                         │
│ Redirect to /me/teams/[id]                    │
└───────────────────────────────────────────────┘
```

## 🚀 Prochaines Améliorations Possibles

### Court terme
- [ ] Ajouter une recherche/filtre de Star Players par nom
- [ ] Afficher l'image/avatar des Star Players
- [ ] Animation lors de la sélection automatique des paires
- [ ] Tooltip sur les icônes de caractéristiques

### Moyen terme
- [ ] Mode comparaison de Star Players
- [ ] Suggestions de Star Players selon la composition de l'équipe
- [ ] Historique des Star Players recrutés
- [ ] Statistiques des Star Players les plus populaires

### Long terme
- [ ] Prévisualisation 3D des Star Players
- [ ] Système de favoris
- [ ] Partage de compositions d'équipe
- [ ] Simulation de matchs avec/sans Star Players

## 📝 Fichiers Modifiés/Créés

### Nouveaux Fichiers
- `apps/web/app/components/StarPlayerSelector.tsx` (✨ nouveau, 300 lignes)

### Fichiers Modifiés
- `apps/web/app/me/teams/new/page.tsx` (ajout de ~40 lignes)

## 🎉 Résumé

### Fonctionnalités Implémentées

✅ Composant réutilisable `StarPlayerSelector`  
✅ Intégration dans le builder d'équipe  
✅ Gestion automatique des paires obligatoires  
✅ Validations en temps réel (budget, joueurs, disponibilité)  
✅ Interface utilisateur intuitive et responsive  
✅ Messages d'erreur contextuels  
✅ Détails expandables pour chaque Star Player  
✅ Envoi des Star Players à l'API lors de la création  

### Impact

**Avant** : Impossible de recruter des Star Players lors de la création d'équipe. Il fallait créer l'équipe puis ajouter les Star Players séparément (fonctionnalité inexistante en UI).

**Maintenant** : L'utilisateur peut sélectionner des Star Players directement lors de la création, avec toutes les validations en temps réel et une interface claire !

---

**Date :** 24 octobre 2025  
**Version :** 1.0  
**Statut :** ✅ Terminé et prêt pour les tests

