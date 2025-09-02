# 📋 TODO - BlooBowl Fantasy Football Game

Ce fichier contient toutes les issues GitHub du projet [fantasy-football-game](https://github.com/Ryxeuf/fantasy-football-game) organisées par priorité et épic.

## 🚨 Priorité P1 (Critique)

### Règles Blood Bowl
- **[#31](https://github.com/Ryxeuf/fantasy-football-game/issues/31)** - Jets & turnovers (MVP)
  - *Jet d'esquive (modif constant). Échec => turnover. Popup résultat.*
  - Labels: `area:engine`, `type:rules`, `epic:Règles Blood Bowl`

### Rendu 2D avancé
- **[#26](https://github.com/Ryxeuf/fantasy-football-game/issues/26)** - Web: Thème visuel terrain (tileset)
  - *Tileset terrain (herbe + en-buts) en calques Pixi. Lignes/marquages séparés.*
  - Labels: `area:web`, `type:graphics`, `epic:Rendu 2D avancé`

### Persistance events
- **[#19](https://github.com/Ryxeuf/fantasy-football-game/issues/19)** - Server: Sauvegarde des turns + endpoint list
  - *À chaque move validé, insérer Turn(payload, number, player). Endpoint pour lister turns d'un match.*
  - Labels: `area:server`, `type:api`, `epic:Persistance events`

- **[#18](https://github.com/Ryxeuf/fantasy-football-game/issues/18)** - DB/Prisma: Modèles User, Match, Turn
  - *Définir schéma Prisma. Générer migrations. Brancher Postgres.*
  - Labels: `area:server`, `type:db`, `epic:Persistance events`

### Matchmaking & Auth
- **[#16](https://github.com/Ryxeuf/fantasy-football-game/issues/16)** - Web: Lobby de partie /match/:id/lobby
  - *Deux slots joueurs (A/B), statut prêt. Bouton 'Prêt' → plateau. Afficher/copier lien d'invitation.*
  - Labels: `area:web`, `type:ui`, `epic:Matchmaking & Auth`

- **[#15](https://github.com/Ryxeuf/fantasy-football-game/issues/15)** - Web: Lien magique d'invitation (join)
  - *Endpoint pour valider token d'invitation et rejoindre un match. Écran de confirmation équipe. Erreurs: token invalide/expiré.*
  - Labels: `area:server`, `type:api`, `epic:Matchmaking & Auth`

## ⚠️ Priorité P2 (Importante)

### Étapes suivantes
- **[#42](https://github.com/Ryxeuf/fantasy-football-game/issues/42)** - Mobile: Zoom/Pan (pinch + drag)
  - *Caméra: zoom molette centré curseur + pan drag. Limites + Reset.*
  - Labels: `area:mobile`, `type:ui`, `epic:Étapes suivantes`

- **[#41](https://github.com/Ryxeuf/fantasy-football-game/issues/41)** - Web: Zoom/Pan (wheel + drag)
  - *Caméra: zoom molette centré curseur + pan drag. Limites + Reset.*
  - Labels: `area:web`, `type:ui`, `epic:Étapes suivantes`

- **[#38](https://github.com/Ryxeuf/fantasy-football-game/issues/38)** - Web: Système d'assets (loader/cache)
  - *Loader + cache sprites JSON/PNG. Pions par équipe.*
  - Labels: `area:web`, `type:graphics`, `epic:Étapes suivantes`

- **[#36](https://github.com/Ryxeuf/fantasy-football-game/issues/36)** - Web: Animations tween déplacement
  - *Interpolation A→B (150–250ms), easing, file d'animations. Skip (S).*
  - Labels: `area:web`, `type:graphics`, `epic:Étapes suivantes`

- **[#35](https://github.com/Ryxeuf/fantasy-football-game/issues/35)** - Mobile: Surbrillance des coups possibles
  - *Tap joueur => cases jouables. Double-tap annule.*
  - Labels: `area:mobile`, `type:graphics`, `epic:Étapes suivantes`

- **[#34](https://github.com/Ryxeuf/fantasy-football-game/issues/34)** - Web: Surbrillance des coups possibles
  - *Calque Pixi pour cases jouables (getLegalMoves). Mode inspection (Alt).*
  - Labels: `area:web`, `type:graphics`, `epic:Étapes suivantes`

### Règles Blood Bowl
- **[#33](https://github.com/Ryxeuf/fantasy-football-game/issues/33)** - Zones de tacle (influence)
  - *Calculer influence/assist. Réfléter dans heatmap + légalité moves.*
  - Labels: `area:engine`, `type:rules`, `epic:Règles Blood Bowl`

- **[#32](https://github.com/Ryxeuf/fantasy-football-game/issues/32)** - Compétences de base (2–3)
  - *Implémenter Esquive/Blocage (+1 placeholder) + affichage icônes/tooltip.*
  - Labels: `area:engine`, `type:rules`, `epic:Règles Blood Bowl`

### Rendu 2D avancé
- **[#29](https://github.com/Ryxeuf/fantasy-football-game/issues/29)** - Mobile: Renderer Canvas RN (MVP)
  - *Plateau RN (rect/cercles). Gestes: tap/long press.*
  - Labels: `area:mobile`, `type:graphics`, `epic:Rendu 2D avancé`

- **[#28](https://github.com/Ryxeuf/fantasy-football-game/issues/28)** - Web: HUD overlay (PM, relances)
  - *Overlay affichant joueur sélectionné, PM restants, relances.*
  - Labels: `area:web`, `type:ui`, `epic:Rendu 2D avancé`

- **[#27](https://github.com/Ryxeuf/fantasy-football-game/issues/27)** - Web: Heatmap zones de tacle (statique)
  - *Calcul + rendu heatmap semi-transparente. Légende discrète.*
  - Labels: `area:web`, `type:graphics`, `epic:Rendu 2D avancé`

### Persistance events
- **[#21](https://github.com/Ryxeuf/fantasy-football-game/issues/21)** - Web: Replayer avec curseur de tour
  - *Recalcul seed + events jusqu'au tour sélectionné. UI stepper + slider.*
  - Labels: `area:web`, `type:ui`, `epic:Persistance events`

- **[#20](https://github.com/Ryxeuf/fantasy-football-game/issues/20)** - Web: Historique du match (onglet)
  - *Liste des turns (numéro, joueur, action). Bouton 'Rejouer depuis ici'.*
  - Labels: `area:web`, `type:ui`, `epic:Persistance events`

### Notifications
- **[#23](https://github.com/Ryxeuf/fantasy-football-game/issues/23)** - Web: UI permission & préférences notifications
  - *Modal d'activation + page /settings (toggles). Stocker préférences serveur.*
  - Labels: `area:web`, `type:ui`, `epic:Notifications`

- **[#25](https://github.com/Ryxeuf/fantasy-football-game/issues/25)** - Mobile: UI permissions & préférences
  - *Écran réglages Expo Notifications. Toggle global + par match.*
  - Labels: `area:mobile`, `type:ui`, `epic:Notifications`

### Matchmaking & Auth
- **[#17](https://github.com/Ryxeuf/fantasy-football-game/issues/17)** - Mobile: Flow Login → New/Join → Lobby
  - *Écrans Expo: Login, New/Join, Lobby, navigation Stack. Android+iOS.*
  - Labels: `area:mobile`, `type:ui`, `epic:Matchmaking & Auth`

## 📝 Priorité P3 (Nice to have)

### Étapes suivantes
- **[#40](https://github.com/Ryxeuf/fantasy-football-game/issues/40)** - Mobile: Pack d'assets léger
  - *Sprite sheet 1x/2x, fallback vectoriel.*
  - Labels: `area:mobile`, `type:graphics`, `epic:Étapes suivantes`

- **[#39](https://github.com/Ryxeuf/fantasy-football-game/issues/39)** - Web: Variantes de terrain (skins)
  - *Sélecteur de skin (herbe/ruine/neige) + preview Lobby.*
  - Labels: `area:web`, `type:graphics`, `epic:Étapes suivantes`

- **[#37](https://github.com/Ryxeuf/fantasy-football-game/issues/37)** - Mobile: Animations tween déplacement
  - *Tween équivalent RN avec API partagée.*
  - Labels: `area:mobile`, `type:graphics`, `epic:Étapes suivantes`

### Notifications
- **[#24](https://github.com/Ryxeuf/fantasy-football-game/issues/24)** - Web: Badge cloche + toast activation
  - *Icône cloche header (actif/inactif). Toast de confirmation.*
  - Labels: `area:web`, `type:ui`, `epic:Notifications`

### Persistance events
- **[#22](https://github.com/Ryxeuf/fantasy-football-game/issues/22)** - Mobile: Historique minimal
  - *Liste des turns + bouton Voir l'état (texte/JSON).*
  - Labels: `area:mobile`, `type:ui`, `epic:Persistance events`

---

## 📊 Statistiques

- **Total des issues** : 28
- **Issues ouvertes** : 28
- **Issues fermées** : 0

### Répartition par priorité
- **P1 (Critique)** : 6 issues
- **P2 (Importante)** : 16 issues  
- **P3 (Nice to have)** : 6 issues

### Répartition par épic
- **Étapes suivantes** : 8 issues
- **Règles Blood Bowl** : 4 issues
- **Rendu 2D avancé** : 4 issues
- **Persistance events** : 4 issues
- **Notifications** : 3 issues
- **Matchmaking & Auth** : 3 issues

### Répartition par zone
- **Web** : 12 issues
- **Mobile** : 8 issues
- **Engine** : 4 issues
- **Server** : 4 issues

---

*Dernière mise à jour : $(date)*
*Source : [GitHub Issues](https://github.com/Ryxeuf/fantasy-football-game/issues)*
