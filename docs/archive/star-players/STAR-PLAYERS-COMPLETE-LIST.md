# 🌟 Liste Complète des Star Players - Blood Bowl

## Vue d'ensemble

**67 Star Players** sont maintenant disponibles dans l'application, couvrant toutes les équipes et régions de Blood Bowl.

## Statistiques

### Par Région

- **Old World Classic** : 15+ joueurs
- **Badlands Brawl** : 12+ joueurs
- **Elven Kingdoms League** : 8+ joueurs
- **Sylvanian Spotlight** : 7+ joueurs
- **Lustrian Superleague** : 6+ joueurs
- **Underworld Challenge** : 10+ joueurs
- **Halfling Thimble Cup** : 6+ joueurs
- **Worlds Edge Superleague** : 4+ joueurs
- **Favoured Of (Chaos)** : 15+ joueurs
- **Tous ("all")** : 3+ joueurs

### Par Coût

- **Le moins cher** : Crumbleberry (0 po - inclus avec Grak)
- **Le plus abordable** : Bomber Dribblesnot & Cindy Piewhistle (50,000 po)
- **Coût moyen** : ~160,000 po
- **Les plus chers** : H'thark l'Imparable (300,000 po), Morg 'n' Thorg (330,000 po), Deeproot Strongbranch (340,000 po)

### Caractéristiques Exceptionnelles

#### Force (ST)
- **Plus faible** : Akhorne l'Écureuil (ST 1) - unique !
- **Plus fort** : Deeproot Strongbranch (ST 7)

#### Mouvement (MA)
- **Plus lent** : Deeproot Strongbranch & Maple Highgrove (MA 2)
- **Plus rapide** : Eldril Sidewinder, Jordell Freshbreeze, Swiftvine Glimmershard (MA 8)

#### Armure (AV)
- **Plus fragile** : Akhorne l'Écureuil (AV 6)
- **Plus résistant** : Deeproot Strongbranch & Maple Highgrove (AV 11)

## Star Players Notables

### Duos Indissociables

Ces joueurs doivent être recrutés ensemble :

1. **Grak & Crumbleberry** (Trolls)
   - Grak : 280,000 po
   - Crumbleberry : Gratuit (inclus)
   - Total : 280,000 po

2. **Les Jumeaux Swift** (Swift Twins)
   - Lucien Swift : 340,000 po
   - Valen Swift : 340,000 po
   - Total : 680,000 po

3. **Dribl & Drull** (Gobelins)
   - Recruté comme une seule unité : 190,000 po

### Légendes

- **Griff Oberwald** (Humain, 280k) : Le meilleur receveur
- **Morg 'n' Thorg** (Ogre, 330k) : Mercenaire légendaire
- **Hakflem Skuttlespike** (Skaven, 220k) : Le plus rapide
- **Varag Ghoul-Chewer** (Orc, 290k) : Blitzeur d'élite
- **Zzharg Madeye** (Nain du Chaos, 130k) : Spécialiste Blunderbuss

### Joueurs Uniques

- **Akhorne l'Écureuil** : Seul joueur avec ST 1, disponible pour tous
- **Frank 'n' Stein** : Assemblage de Frankenstein
- **Wilhelm Chaney** : Loup-garou avec transformation
- **Deeproot Strongbranch** : Arbre ancestral le plus puissant

## Compétences Spéciales

### Armes Secrètes
- Bomber Dribblesnot (Bombardier)
- Max Spleenripper (Tronçonneuse)
- Zzharg Madeye (Blunderbuss)

### Capacités Uniques
- **Akhorne** : Blind Rage (améliore Dauntless)
- **H'thark** : Unstoppable Charge (améliore Juggernaut)
- **Bilerot Vomitflesh** : Vomit (attaque spéciale)
- **Wilhelm Chaney** : Werewolf Form (transformation)
- **Karina von Riesz** : Blood Frenzy (morsure vampirique)

## Nouveaux Ajouts (27 Joueurs)

Cette mise à jour ajoute 27 nouveaux Star Players :

1. Glotl Stop (270k) - Lustrian Superleague
2. Grashnak Noirsabot (240k) - Badlands Brawl
3. Ivan Deathshroud (190k) - Sylvanian Spotlight
4. Ivar Eriksson (245k) - Old World Classic
5. Jeremiah Kool (120k) - Badlands Brawl
6. Jordell Flechevive (250k) - Elven Kingdoms League
7. Karina von Riesz (230k) - Sylvanian Spotlight
8. Kiroth Krakeneye (160k) - Favoured Of
9. Lord Borak (260k) - Favoured Of
10. Max Spleenripper (130k) - Favoured Of
11. Puggy Baconbreath (120k) - Halfling Thimble Cup
12. Rashnak Backstabber (130k) - Badlands Brawl
13. Rodney Roachbait (70k) - Underworld Challenge
14. Rowana Forestfoot (160k) - Halfling Thimble Cup
15. Scyla Anfingrimm (200k) - Favoured Of
16. Skrorg Snowpelt (250k) - Old World Classic
17. Swiftvine Glimmershard (110k) - Elven Kingdoms League
18. Thorsson Stoutmead (170k) - Old World Classic
19. Wilhelm Chaney (220k) - Sylvanian Spotlight
20. Withergrasp Doubledrool (170k) - Favoured Of
21. Guffle Pusmaw (200k) - Favoured Of
22. H'thark l'Imparable (300k) - Lustrian Superleague
23. Dribl & Drull (190k) - Badlands Brawl
24. Zzharg Madeye (130k) - Badlands Brawl
25. Bilerot Vomitflesh (180k) - Favoured Of
26. Maple Highgrove (210k) - Halfling Thimble Cup

## Utilisation

### Dans le Game Engine

```typescript
import { STAR_PLAYERS, getStarPlayerBySlug } from '@bb/game-engine';

// Obtenir tous les Star Players
const allStarPlayers = Object.values(STAR_PLAYERS);

// Obtenir un Star Player spécifique
const griff = getStarPlayerBySlug('griff_oberwald');
```

### Dans l'API

```bash
# Liste complète
GET /star-players

# Par slug
GET /star-players/griff_oberwald

# Disponibles pour un roster
GET /star-players/available/human

# Pour une équipe spécifique
GET /team/:id/available-star-players
```

### Dans le Frontend

Les Star Players sont disponibles dans :
- `/star-players` - Liste avec filtres
- `/star-players/[slug]` - Page détaillée
- Composant `StarPlayerSelector` lors de la création d'équipe

## Tests

```bash
cd packages/game-engine
npm test -- --run src/rosters/star-players.test.ts
```

**19 tests** valident :
- Structure des données
- Cohérence des coûts (50k - 340k po)
- Caractéristiques valides (MA 1-9, ST 1-7, AG 1-6, AV 6-11)
- Compétences correctes
- Règles régionales
- Paires de joueurs

## Règles Importantes

1. **Limite de recrutement** : 1 seul Star Player par équipe (sauf paires)
2. **Limite totale** : Maximum 16 joueurs (incluant Star Players)
3. **Budget** : Le coût est déduit du budget de l'équipe
4. **Paires obligatoires** : Certains joueurs doivent être recrutés ensemble
5. **Règles régionales** : Chaque Star Player n'est disponible que pour certaines équipes

## Source des Données

Données officielles provenant de :
- Blood Bowl 2020 Rulebook
- Death Zone supplements
- [NuffleZone](https://nufflezone.com/fr/star-player/)

---

**Dernière mise à jour** : 27 nouveaux Star Players ajoutés
**Total** : 67 Star Players complets avec caractéristiques, compétences et règles spéciales

