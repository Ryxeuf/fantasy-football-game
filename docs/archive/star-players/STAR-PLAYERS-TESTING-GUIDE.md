# Guide de Test : Intégration des Star Players

## 🎯 Objectif

Tester l'intégration complète des Star Players dans la création d'équipe, de l'interface frontend jusqu'à la persistance en base de données.

## 🚀 Préparation

### Démarrer les services

```bash
# Terminal 1 : Démarrer le serveur backend
cd apps/server
npm run dev

# Terminal 2 : Démarrer l'application web
cd apps/web
npm run dev
```

### Vérifier que les services sont démarrés

- **Backend** : http://localhost:3001
- **Frontend** : http://localhost:3000

## ✅ Tests à Effectuer

### Test 1 : Accès au formulaire de création

**Objectif** : Vérifier que le formulaire s'affiche correctement.

**Étapes** :
1. Ouvrir le navigateur à http://localhost:3000
2. Se connecter (ou créer un compte si nécessaire)
3. Aller sur "Mes équipes" (`/me/teams`)
4. Remplir le formulaire :
   - Nom : "Test Skavens"
   - Roster : "Skavens"
   - Budget : 1500K po
5. Cliquer sur "Ouvrir le builder"

**Résultat attendu** :
- ✅ Redirection vers `/me/teams/new?name=Test+Skavens&roster=skaven&teamValue=1500`
- ✅ Le formulaire affiche le nom, roster et budget pré-remplis
- ✅ Le tableau des positions s'affiche
- ✅ La section "⭐ Star Players Disponibles" s'affiche en dessous

---

### Test 2 : Affichage des Star Players disponibles

**Objectif** : Vérifier que les Star Players s'affichent selon le roster.

**Étapes** :
1. Dans le builder, faire défiler jusqu'à la section Star Players
2. Observer la liste affichée

**Résultat attendu** :
- ✅ Des Star Players spécifiques aux Skavens s'affichent (ex: Hakflem Skuttlespike, Headsplitter)
- ✅ Chaque carte affiche :
  - Nom du Star Player
  - Coût en K po
  - Caractéristiques (MA, ST, AG, PA, AV)
  - Bouton "Voir les détails"
- ✅ Le message "X sélectionné(s)" affiche "0 sélectionné(s)"

**Test supplémentaire** :
1. Changer le roster pour "Halflings"
2. Observer que la liste change
3. Vérifier que des Star Players différents s'affichent (ex: Deeproot Strongbranch)

---

### Test 3 : Sélection simple d'un Star Player

**Objectif** : Vérifier qu'on peut sélectionner un Star Player.

**Étapes** :
1. Roster : Skavens
2. Ajouter 11 Skaven Linemen (50K po chacun = 550K po)
3. Dans la section Star Players, cocher "Hakflem Skuttlespike" (180K po)

**Résultat attendu** :
- ✅ La carte de Hakflem passe en vert (`bg-emerald-50`)
- ✅ La checkbox est cochée
- ✅ Le message "1 sélectionné(s)" s'affiche
- ✅ Le résumé se met à jour :
  - Coût total des Star Players : 180K po
  - Nombre de joueurs total : 12 / 16
- ✅ Le résumé général affiche :
  - Total joueurs : 550K po
  - Joueurs total : 12 / 16 (en vert)
- ✅ Le bouton "Créer l'équipe" est activé

---

### Test 4 : Détails expandables

**Objectif** : Vérifier qu'on peut voir les détails d'un Star Player.

**Étapes** :
1. Cliquer sur "Voir les détails" sous Hakflem Skuttlespike

**Résultat attendu** :
- ✅ Une section se déploie affichant :
  - **Compétences** : "Block, Dodge, Side Step, Stab, Stunty, Weeping Dagger"
  - **Règle spéciale** : (texte de la règle)
- ✅ Le bouton devient "Masquer les détails"

**Test supplémentaire** :
1. Cliquer sur "Masquer les détails"
2. Vérifier que la section se referme

---

### Test 5 : Paire obligatoire (Grak & Crumbleberry)

**Objectif** : Vérifier la gestion automatique des paires.

**Étapes** :
1. Créer une nouvelle équipe avec roster "Gobelins"
2. Ajouter 11 Goblin Linemen (40K po × 11 = 440K po)
3. Cocher "Grak" (280K po)

**Résultat attendu** :
- ✅ Grak est coché (fond vert)
- ✅ **Automatiquement**, Crumbleberry est aussi coché
- ✅ Le badge "Paire avec Crumbleberry" s'affiche sur Grak
- ✅ Le badge "Paire avec Grak" s'affiche sur Crumbleberry
- ✅ Le message "2 sélectionné(s)" s'affiche
- ✅ Le résumé affiche :
  - Coût total : 280K po (Grak) + 0K po (Crumbleberry) = 280K po
  - Joueurs total : 13 / 16

**Test de désélection** :
1. Décocher Grak

**Résultat attendu** :
- ✅ Grak est décoché
- ✅ **Automatiquement**, Crumbleberry est aussi décoché
- ✅ Le message "0 sélectionné(s)" s'affiche

---

### Test 6 : Limite de 16 joueurs

**Objectif** : Vérifier que le système empêche de dépasser 16 joueurs.

**Étapes** :
1. Roster : Skavens
2. Ajouter 15 Skaven Linemen
3. Essayer de cocher 2 Star Players

**Résultat attendu** :
- ✅ Après avoir coché le 1er Star Player, le total passe à 16 / 16 (vert)
- ✅ Tous les autres Star Players deviennent gris et désactivés
- ✅ Un message d'erreur s'affiche : "⚠️ Limite de 16 joueurs dépassée"
- ✅ Le bouton "Créer l'équipe" reste activé (16 joueurs = OK)

**Test avec paire** :
1. Retirer 2 linemen (13 linemen total)
2. Essayer de cocher Grak (qui inclut Crumbleberry)

**Résultat attendu** :
- ✅ Grak et Crumbleberry sont tous deux cochés (15 total)
- ✅ Tous les autres Star Players deviennent désactivés (car +1 = 16, mais pas +2)

---

### Test 7 : Budget insuffisant

**Objectif** : Vérifier que le système empêche de dépasser le budget.

**Étapes** :
1. Créer une équipe Skavens avec budget 1000K po
2. Ajouter 11 Gutter Runners à 80K po chacun = 880K po
3. Essayer de cocher Hakflem (180K po)

**Résultat attendu** :
- ✅ Hakflem reste gris et désactivé
- ✅ Un message d'erreur s'affiche : "⚠️ Budget dépassé de 60K po"
- ✅ Le résumé général affiche :
  - Budget restant : 120K po (1000K - 880K)
- ✅ Aucun Star Player coûtant plus de 120K ne peut être sélectionné

**Solution** :
1. Retirer 2 Gutter Runners (9 joueurs, 720K po)
2. Vérifier que Hakflem devient sélectionnable

---

### Test 8 : Création d'équipe avec Star Player

**Objectif** : Vérifier que l'équipe se crée correctement avec les Star Players.

**Étapes** :
1. Roster : Skavens, Budget : 1500K po
2. Ajouter 11 Skaven Linemen (550K po)
3. Cocher Hakflem Skuttlespike (180K po)
4. Vérifier le résumé :
   - Coût joueurs : 550K po
   - Budget total : 1500K po
   - Budget restant : 770K po
   - Joueurs : 12 / 16
5. Cliquer sur "Créer l'équipe"

**Résultat attendu** :
- ✅ Redirection vers `/me/teams/[id]`
- ✅ La page de l'équipe s'affiche
- ✅ Les 11 joueurs normaux sont listés
- ✅ **Hakflem Skuttlespike est listé avec les autres joueurs ou dans une section Star Players**
- ✅ Le coût total de l'équipe inclut Hakflem

**Vérification en base de données** :
```bash
# Dans le terminal du serveur, ouvrir Prisma Studio
npx prisma studio
```
1. Ouvrir le modèle `Team`
2. Trouver l'équipe créée
3. Vérifier les relations `starPlayers`
4. Ouvrir `TeamStarPlayer`
5. Vérifier qu'une entrée existe avec :
   - `teamId` = ID de l'équipe
   - `starPlayerSlug` = "hakflem_skuttlespike"
   - `cost` = 180000

---

### Test 9 : Création avec paire Grak & Crumbleberry

**Objectif** : Vérifier la création d'équipe avec une paire.

**Étapes** :
1. Roster : Gobelins, Budget : 1500K po
2. Ajouter 11 Goblin Linemen (440K po)
3. Cocher Grak (auto-sélectionne Crumbleberry)
4. Cliquer sur "Créer l'équipe"

**Résultat attendu** :
- ✅ Redirection vers la page de l'équipe
- ✅ **Grak ET Crumbleberry sont tous deux dans l'équipe**
- ✅ Le coût total inclut 280K pour Grak + 0K pour Crumbleberry

**Vérification en base de données** :
1. Ouvrir Prisma Studio
2. Vérifier que `TeamStarPlayer` contient 2 entrées :
   - Une pour "grak" (cost: 280000)
   - Une pour "crumbleberry" (cost: 0)

---

### Test 10 : Validation serveur en cas d'erreur

**Objectif** : Vérifier que le serveur valide aussi les règles.

**Méthode** : Utiliser l'outil de développement du navigateur pour forcer une requête invalide.

**Étapes** :
1. Ouvrir les DevTools (F12)
2. Aller dans l'onglet Console
3. Exécuter ce code pour tenter de créer une équipe invalide :

```javascript
const token = localStorage.getItem("auth_token");

fetch("http://localhost:3001/team/build", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    name: "Test Invalide",
    roster: "skaven",
    teamValue: 1000,
    choices: [
      { key: "skaven_lineman", count: 16 } // 16 joueurs
    ],
    starPlayers: ["hakflem_skuttlespike", "headsplitter"] // +2 = 18 total
  })
})
.then(r => r.json())
.then(console.log);
```

**Résultat attendu** :
- ✅ Statut 400 (Bad Request)
- ✅ Message d'erreur : "Trop de joueurs ! 16 joueurs + 2 Star Players = 18 (maximum: 16)"

---

### Test 11 : Changement de roster

**Objectif** : Vérifier que la sélection se réinitialise.

**Étapes** :
1. Roster : Skavens
2. Cocher Hakflem
3. Changer le roster pour "Halflings"

**Résultat attendu** :
- ✅ La liste de Star Players change immédiatement
- ✅ Hakflem n'apparaît plus (il n'est pas disponible pour Halflings)
- ✅ La sélection précédente est conservée (si on revient à Skavens, Hakflem est toujours coché)

> **Note** : Actuellement, la sélection n'est pas réinitialisée automatiquement. C'est un comportement acceptable mais pourrait être amélioré.

---

### Test 12 : Messages de validation

**Objectif** : Vérifier tous les messages d'erreur.

**Scénarios** :

#### A. Moins de 11 joueurs
1. Ajouter seulement 10 joueurs
2. **Résultat** : "⚠️ Il vous faut au moins 11 joueurs (actuellement 10)"
3. Bouton désactivé

#### B. Plus de 16 joueurs
1. Ajouter 14 joueurs + 3 Star Players
2. **Résultat** : "⚠️ Maximum 16 joueurs autorisés (actuellement 17)"
3. Bouton désactivé

#### C. Équipe valide
1. 11 joueurs + 1 Star Player
2. **Résultat** : "✅ Équipe valide (11 joueurs + 1 Star Players)"
3. Bouton activé

---

## 🐛 Bugs Potentiels à Surveiller

### Bug 1 : Star Players non créés en base
**Symptôme** : L'équipe se crée mais les Star Players ne sont pas enregistrés.
**Vérification** : Ouvrir Prisma Studio et vérifier `TeamStarPlayer`.
**Solution** : Vérifier que le backend reçoit bien le tableau `starPlayers`.

### Bug 2 : Paire incomplète acceptée
**Symptôme** : On peut créer une équipe avec Grak seul (sans Crumbleberry).
**Vérification** : Tenter de forcer la requête via DevTools.
**Solution** : Vérifier la validation backend dans `validateStarPlayerPairs()`.

### Bug 3 : Budget mal calculé
**Symptôme** : Le budget affiché ne correspond pas au coût réel.
**Vérification** : Comparer le budget affiché avec le calcul manuel.
**Solution** : Vérifier le calcul dans `StarPlayerSelector` et le builder.

### Bug 4 : Crash lors du changement de roster
**Symptôme** : Erreur console lors du changement de roster.
**Vérification** : Ouvrir la console et changer plusieurs fois de roster.
**Solution** : Vérifier la gestion du useEffect dans `StarPlayerSelector`.

### Bug 5 : Désélection de paire ne fonctionne pas
**Symptôme** : Décocher Grak ne décoche pas Crumbleberry.
**Vérification** : Cocher puis décocher Grak.
**Solution** : Vérifier la logique dans `handleToggle()`.

---

## 📊 Checklist Complète

### Frontend
- [ ] Le composant StarPlayerSelector s'affiche
- [ ] Les Star Players se chargent selon le roster
- [ ] La sélection/désélection fonctionne
- [ ] Les paires se sélectionnent automatiquement
- [ ] Les détails sont expandables
- [ ] Le budget est calculé correctement
- [ ] La limite de 16 joueurs est respectée
- [ ] Les messages d'erreur s'affichent
- [ ] Le bouton est désactivé quand nécessaire
- [ ] La requête POST envoie les Star Players

### Backend
- [ ] L'endpoint `/star-players/available/:roster` fonctionne
- [ ] L'endpoint `POST /team/build` accepte `starPlayers[]`
- [ ] La validation des paires fonctionne
- [ ] La validation du budget fonctionne
- [ ] La validation de la limite de joueurs fonctionne
- [ ] Les Star Players sont créés en base (TeamStarPlayer)
- [ ] Les Star Players sont liés à l'équipe
- [ ] La réponse inclut les Star Players enrichis

### Base de données
- [ ] Le modèle `TeamStarPlayer` existe
- [ ] La relation `Team.starPlayers` fonctionne
- [ ] Les données sont correctement persistées
- [ ] La contrainte unique (teamId, starPlayerSlug) fonctionne
- [ ] La cascade de suppression fonctionne

---

## 🎉 Résultat Attendu Final

Une fois tous les tests passés, l'utilisateur peut :
1. ✅ Ouvrir le formulaire de création d'équipe
2. ✅ Sélectionner un roster
3. ✅ Choisir des joueurs normaux
4. ✅ **Sélectionner des Star Players directement**
5. ✅ Voir en temps réel le budget et le nombre de joueurs
6. ✅ Être guidé par des messages d'erreur clairs
7. ✅ Créer l'équipe avec les Star Players en un clic
8. ✅ Voir son équipe avec tous les joueurs (normaux + Star Players)

---

**Date** : 24 octobre 2025  
**Version** : 1.0  
**Durée estimée** : 45 minutes

