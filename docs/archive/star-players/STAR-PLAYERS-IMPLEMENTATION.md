# Implémentation des Star Players

## Vue d'ensemble

Les Star Players sont des mercenaires légendaires de Blood Bowl qui peuvent être recrutés par plusieurs équipes. Ce document décrit l'implémentation du système de Star Players dans le jeu.

## Structure des données

### Définition d'un Star Player

Chaque Star Player est défini avec les propriétés suivantes :

```typescript
interface StarPlayerDefinition {
  slug: string;           // Identifiant unique (ex: "glart_smashrip")
  displayName: string;    // Nom d'affichage (ex: "Glart Smashrip")
  cost: number;           // Coût en po (pièces d'or)
  ma: number;             // Movement Allowance
  st: number;             // Strength
  ag: number;             // Agility (valeur cible, ex: 3 pour 3+)
  pa: number | null;      // Passing (valeur cible, ex: 2 pour 2+, null pour -)
  av: number;             // Armour Value (valeur cible, ex: 9 pour 9+)
  skills: string;         // Compétences (séparées par virgules)
  hirableBy: string[];    // Équipes ou règles spéciales qui peuvent recruter
  specialRule?: string;   // Règle spéciale du joueur
}
```

## Star Players implémentés

Total : **25 Star Players** (dont 2 paires qui doivent être recrutées ensemble)

### Par coût (ordre croissant)

1. **Helmut Wulf** - 140,000 po
   - Disponible pour : Toutes les équipes
   - Spécialité : Tronçonneuse (Arme Secrète)

2. **Gloriel Summerbloom** - 150,000 po
   - Disponible pour : Ligue des Royaumes Elfiques
   - Spécialité : Passe exceptionnelle

3. **Skrull Halfheight** - 150,000 po
   - Disponible pour : Spot de Sylvanie, Super-ligue du Bord du Monde
   - Spécialité : Passe avec bonus de Force

4. **Willow Rosebark** - 150,000 po
   - Disponible pour : Ligue des Royaumes Elfiques
   - Spécialité : Indomptable

5. **Rumbelow Sheepskin** - 170,000 po
   - Disponible pour : Classique du Vieux Monde, Coupe Dé à Coudre Halfling
   - Spécialité : Bélier

6. **Hakflem Skuttlespike** - 180,000 po
   - Disponible pour : Défi des Bas-fonds
   - Spécialité : Traître

7. **Glart Smashrip** - 195,000 po
   - Disponible pour : Toutes les équipes
   - Spécialité : Frénésie activable

8. **Grim Ironjaw** - 200,000 po
   - Disponible pour : Classique du Vieux Monde, Coupe Dé à Coudre Halfling
   - Spécialité : Tueur de gros joueurs

9. **Karla Von Kill** - 210,000 po
   - Disponible pour : Classique du Vieux Monde, Super-ligue de Lustrie
   - Spécialité : Indomptable

10. **Grombrindal, the White Dwarf** - 210,000 po
    - Disponible pour : Classique du Vieux Monde, Super-ligue du Bord du Monde
    - Spécialité : Sagesse du Nain Blanc

11. **Mighty Zug** - 220,000 po
    - Disponible pour : Classique du Vieux Monde, Coupe Dé à Coudre Halfling
    - Spécialité : Coup Destructeur

12. **The Black Gobbo** - 225,000 po
    - Disponible pour : Bagarre des Terres Arides, Défi des Bas-fonds
    - Spécialité : Le Plus Sournois de Tous

13. **Eldril Sidewinder** - 230,000 po
    - Disponible pour : Ligue des Royaumes Elfiques
    - Spécialité : Danse Hypnotisante

14. **Zolcath le Zoat** - 230,000 po
    - Disponible pour : Super-ligue de Lustrie, Ligue des Royaumes Elfiques
    - Spécialité : Regard Hypnotique activable

15. **Grak** - 250,000 po (avec Crumbleberry gratuit)
    - Disponible pour : Toutes les équipes
    - Spécialité : Duo avec Crumbleberry

16. **Lord Borak the Despoiler** - 260,000 po
    - Disponible pour : Favoris de...
    - Spécialité : Seigneur du Chaos (relance supplémentaire)

17. **Gretchen Wächter** - 260,000 po
    - Disponible pour : Spot de Sylvanie
    - Spécialité : Éthérée

18. **Roxanna Darknail** - 270,000 po
    - Disponible pour : Ligue des Royaumes Elfiques
    - Spécialité : Pointe de Vitesse (3 Foncer)

19. **Griff Oberwald** - 280,000 po
    - Disponible pour : Classique du Vieux Monde, Coupe Dé à Coudre Halfling
    - Spécialité : Grand Professionnel

20. **Deeproot Strongbranch** - 280,000 po
    - Disponible pour : Classique du Vieux Monde, Coupe Dé à Coudre Halfling
    - Spécialité : Fiable (pas de Turnover sur Lancer de Coéquipier raté)

21. **Varag Ghoul-Chewer** - 280,000 po
    - Disponible pour : Bagarre des Terres Arides, Défi des Bas-fonds
    - Spécialité : Coup Destructeur

22. **Morg 'n' Thorg** - 340,000 po
    - Disponible pour : Toutes les équipes
    - Spécialité : La Baliste

23. **Lucien Swift** - 340,000 po (avec Valen Swift à 340,000 po)
    - Disponible pour : Ligue des Royaumes Elfiques
    - Spécialité : Duo avec Valen Swift

24. **Valen Swift** - 340,000 po (avec Lucien Swift à 340,000 po)
    - Disponible pour : Ligue des Royaumes Elfiques
    - Spécialité : Duo avec Lucien Swift

### Paires de Star Players

Certains Star Players doivent être recrutés ensemble :

1. **Grak & Crumbleberry** (250,000 po total)
   - Grak : Big Guy puissant
   - Crumbleberry : Halfling agile avec Stunty
   - Règle spéciale : Si l'un est KO ou Éliminé, l'autre gagne Loner (2+)

2. **Lucien & Valen Swift** (680,000 po total)
   - Lucien : Blitzer avec Tackle
   - Valen : Thrower avec Accurate
   - Règle spéciale : Si l'un est KO ou Éliminé, l'autre gagne Loner (2+)

## Règles régionales

Les Star Players sont disponibles selon les règles régionales des équipes :

```typescript
type RegionalRule = 
  | "badlands_brawl"              // Bagarre des Terres Arides
  | "elven_kingdoms_league"       // Ligue des Royaumes Elfiques
  | "halfling_thimble_cup"        // Coupe Dé à Coudre Halfling
  | "lustrian_superleague"        // Super-ligue de Lustrie
  | "old_world_classic"           // Classique du Vieux Monde
  | "sylvanian_spotlight"         // Spot de Sylvanie
  | "underworld_challenge"        // Défi des Bas-fonds
  | "worlds_edge_superleague"     // Super-ligue du Bord du Monde
  | "favoured_of";                // Favoris de... (Chaos)
```

### Mapping Équipes → Règles régionales

| Équipe | Règles régionales |
|--------|-------------------|
| Skaven | Underworld Challenge |
| Lizardmen | Lustrian Superleague |
| Wood Elf | Elven Kingdoms League |
| Dark Elf | Elven Kingdoms League |
| Dwarf | Old World Classic, Worlds Edge Superleague |
| Goblin | Badlands Brawl, Underworld Challenge |
| Orc | Badlands Brawl |
| Human | Old World Classic |
| ... | (voir TEAM_REGIONAL_RULES pour la liste complète) |

## Utilisation

### Obtenir un Star Player par slug

```typescript
import { getStarPlayerBySlug } from '@bb/game-engine';

const griff = getStarPlayerBySlug('griff_oberwald');
console.log(griff.displayName); // "Griff Oberwald"
console.log(griff.cost);        // 280000
```

### Obtenir les Star Players disponibles pour une équipe

```typescript
import { getAvailableStarPlayers, TEAM_REGIONAL_RULES } from '@bb/game-engine';

const teamRoster = 'skaven';
const regionalRules = TEAM_REGIONAL_RULES[teamRoster];
const availablePlayers = getAvailableStarPlayers(teamRoster, regionalRules);

console.log(`${availablePlayers.length} star players disponibles pour les Skavens`);
```

### Liste complète des Star Players

```typescript
import { STAR_PLAYERS } from '@bb/game-engine';

Object.values(STAR_PLAYERS).forEach(sp => {
  console.log(`${sp.displayName} - ${sp.cost} po`);
});
```

## Compétences spéciales

Tous les Star Players ont la compétence **Loner** (2+, 3+, ou 4+) qui rend difficile l'utilisation des relances d'équipe sur eux.

### Distribution des niveaux de Loner

- **Loner (2+)** : Star Players qui peuvent être recrutés ensemble (quand l'autre est KO/Éliminé)
- **Loner (3+)** : Star Players très fiables (Gloriel Summerbloom, Griff Oberwald, The Black Gobbo)
- **Loner (4+)** : Majorité des Star Players (standard)

## Règles spéciales notables

Chaque Star Player a une règle spéciale unique utilisable une fois par match :

- **Griff Oberwald** : Peut relancer n'importe quel dé (sauf Armure/Blessure/Élimination)
- **Deeproot Strongbranch** : Pas de Turnover si Lancer de Coéquipier raté
- **Lord Borak** : Donne une relance d'équipe supplémentaire pour la première mi-temps
- **Roxanna Darknail** : Peut Foncer 3 fois au lieu de 2
- **The Black Gobbo** : Permet de relancer un jet d'Agression par tour
- **Grombrindal** : Donne une compétence bonus à un coéquipier adjacent activé

## Tests

Les Star Players sont testés avec un ensemble complet de tests unitaires :

```bash
cd packages/game-engine
npm test -- star-players.test.ts --run
```

Tests couverts :
- Validation des définitions et propriétés
- Vérification des coûts
- Vérification des caractéristiques
- Tests des fonctions utilitaires
- Tests des règles régionales
- Validation des compétences

## Intégration future

### Backend (API)

Pour intégrer les Star Players dans l'API :

1. Ajouter un modèle `StarPlayer` dans Prisma
2. Créer des endpoints pour :
   - Lister les Star Players disponibles pour une équipe
   - Recruter un Star Player pour un match
   - Obtenir les détails d'un Star Player

### Frontend

Pour intégrer dans l'interface :

1. Créer un composant `StarPlayerCard` pour afficher les détails
2. Ajouter une section "Star Players disponibles" lors de la création d'équipe
3. Afficher les règles spéciales et les compétences
4. Gérer les paires de Star Players (Grak/Crumbleberry, Swift Twins)

## Règles Blood Bowl

Les Star Players suivent les règles officielles de Blood Bowl 2020 :

- Ils ne peuvent pas gagner de SPP (Star Player Points)
- Ils ne peuvent pas progresser ou améliorer leurs compétences
- Ils comptent contre la limite de 16 joueurs maximum
- Leur coût est toujours fixe (pas de variations)
- Ils ont tous la compétence Loner (réduction des relances)
- Chacun a une règle spéciale unique utilisable une fois par match

## Fichiers modifiés/créés

- `packages/game-engine/src/rosters/star-players.ts` - Définitions TypeScript
- `packages/game-engine/src/rosters/star-players.js` - Définitions JavaScript
- `packages/game-engine/src/rosters/star-players.test.ts` - Tests unitaires
- `packages/game-engine/src/rosters/index.ts` - Exports mis à jour
- `STAR-PLAYERS-IMPLEMENTATION.md` - Cette documentation

## Références

- Images des Star Players fournies par l'utilisateur (règles officielles)
- Blood Bowl 2020 Rulebook
- Death Zone 2021 (Star Players supplémentaires)

