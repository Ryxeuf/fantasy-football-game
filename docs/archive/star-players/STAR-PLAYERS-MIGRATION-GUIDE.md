# Guide de Migration - Star Players

## 🚀 Mise en place rapide

### 1. Exécuter la migration Prisma

```bash
# Depuis la racine du projet
cd /Users/remy/Sites/bloodbowl/fantasy-football-game

# Créer et appliquer la migration
npx prisma migrate dev --name add_team_star_players

# Si vous utilisez plusieurs bases de données
cd apps/server
npx prisma generate
```

**Cette commande va** :
- ✅ Créer la table `TeamStarPlayer`
- ✅ Ajouter la relation avec `Team`
- ✅ Créer les contraintes d'unicité
- ✅ Créer les index nécessaires
- ✅ Régénérer le client Prisma

### 2. Vérifier que tout est OK

```bash
# Vérifier le schéma
npx prisma validate

# Voir l'état des migrations
npx prisma migrate status

# (Optionnel) Ouvrir Prisma Studio pour voir la nouvelle table
npx prisma studio
```

## 🧪 Tester l'API

### Démarrer le serveur

```bash
cd apps/server
npm run dev
```

Le serveur devrait démarrer sur `http://localhost:8000`

### Tester les endpoints

#### 1. Obtenir un token d'authentification

```bash
# Se connecter (remplacer avec vos identifiants)
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password"
  }'

# Récupérer le token de la réponse
# TOKEN=le_token_recu
```

#### 2. Créer une équipe de test

```bash
curl -X POST http://localhost:8000/team/build \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Skavens",
    "roster": "skaven",
    "teamValue": 1000,
    "choices": [
      {"key": "skaven_blitzer", "count": 2},
      {"key": "skaven_thrower", "count": 1},
      {"key": "skaven_gutter_runner", "count": 2},
      {"key": "skaven_lineman", "count": 6}
    ]
  }'

# Noter le teamId de la réponse
# TEAM_ID=le_team_id
```

#### 3. Obtenir les Star Players disponibles

```bash
curl http://localhost:8000/team/$TEAM_ID/available-star-players \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Résultat attendu** : Liste des Star Players disponibles pour les Skavens avec :
- Hakflem Skuttlespike (Underworld Challenge)
- Helmut Wulf (disponible pour tous)
- Morg 'n' Thorg (disponible pour tous)
- The Black Gobbo (Underworld Challenge)
- Etc.

#### 4. Recruter un Star Player

```bash
# Recruter Hakflem Skuttlespike (180K po)
curl -X POST http://localhost:8000/team/$TEAM_ID/star-players \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"starPlayerSlug": "hakflem_skuttlespike"}' | jq
```

**Résultat attendu** : 
```json
{
  "team": { ... },
  "newStarPlayers": [
    {
      "id": "...",
      "slug": "hakflem_skuttlespike",
      "displayName": "Hakflem Skuttlespike",
      "cost": 180000,
      "ma": 9,
      "st": 3,
      "ag": 2,
      "pa": 3,
      "av": 8,
      "skills": "dodge,extra-arms,loner-4,prehensile-tail,two-heads"
    }
  ],
  "message": "Hakflem Skuttlespike recruté avec succès"
}
```

#### 5. Tester les paires obligatoires

```bash
# Recruter Grak (recrutera automatiquement Crumbleberry aussi)
curl -X POST http://localhost:8000/team/$TEAM_ID/star-players \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"starPlayerSlug": "grak"}' | jq
```

**Résultat attendu** :
```json
{
  "newStarPlayers": [
    {
      "slug": "grak",
      "displayName": "Grak",
      "cost": 250000
    },
    {
      "slug": "crumbleberry",
      "displayName": "Crumbleberry",
      "cost": 0
    }
  ],
  "message": "Grak et Crumbleberry recrutés avec succès"
}
```

#### 6. Voir les Star Players recrutés

```bash
curl http://localhost:8000/team/$TEAM_ID/star-players \
  -H "Authorization: Bearer $TOKEN" | jq
```

#### 7. Retirer un Star Player

```bash
# Récupérer l'ID du Star Player depuis l'étape précédente
# STAR_PLAYER_ID=...

curl -X DELETE http://localhost:8000/team/$TEAM_ID/star-players/$STAR_PLAYER_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

## ❌ Résolution des problèmes

### Erreur : "P2002: Unique constraint failed"

**Cause** : Tentative de recruter un Star Player déjà recruté

**Solution** : Vérifier la liste des Star Players déjà recrutés avant

### Erreur : "Budget insuffisant"

**Cause** : Le coût du Star Player dépasse le budget disponible

**Solution** : 
1. Vérifier le budget disponible avec `/available-star-players`
2. Retirer des joueurs ou choisir un Star Player moins cher

### Erreur : "Limite de 16 joueurs atteinte"

**Cause** : L'équipe a déjà 16 joueurs (joueurs normaux + Star Players)

**Solution** : Retirer un joueur ou un Star Player avant d'en ajouter un nouveau

### Erreur : "X et Y doivent être recrutés ensemble"

**Cause** : Tentative de recruter un Star Player d'une paire sans l'autre

**Solution** : Les paires sont gérées automatiquement, ce message ne devrait pas apparaître

### Erreur : "Impossible de modifier cette équipe car elle est engagée dans un match"

**Cause** : L'équipe est dans un match pending ou active

**Solution** : Attendre la fin du match pour modifier l'équipe

## 📊 Vérifications post-migration

### 1. Vérifier la structure de la base de données

```bash
npx prisma studio
```

Vérifier que :
- ✅ La table `TeamStarPlayer` existe
- ✅ Les relations sont correctes
- ✅ Les contraintes sont en place

### 2. Vérifier les types TypeScript

```bash
cd apps/server
npm run build
```

Pas d'erreur TypeScript = ✅

### 3. Lancer les tests (si disponibles)

```bash
# Tests du game engine
cd packages/game-engine
npm test -- star-players.test.ts --run

# Tests d'intégration (à créer)
cd tests/integration
npm test
```

## 🔄 Rollback (si nécessaire)

Si quelque chose ne va pas, vous pouvez annuler la migration :

```bash
# Voir l'historique des migrations
npx prisma migrate status

# Revenir à la migration précédente
npx prisma migrate resolve --rolled-back add_team_star_players

# Ou réinitialiser complètement (ATTENTION : perte de données)
npx prisma migrate reset
```

## 📝 Checklist de mise en production

Avant de déployer en production :

- [ ] Migration testée en local
- [ ] Tous les endpoints testés
- [ ] Tests des paires obligatoires OK
- [ ] Tests des limites et contraintes OK
- [ ] Documentation API à jour
- [ ] Tests automatisés écrits et passants
- [ ] Frontend implémenté
- [ ] Revue de code effectuée
- [ ] Backup de la base de données production
- [ ] Migration testée sur un environnement de staging
- [ ] Plan de rollback préparé

## 🎯 Prochaines étapes

Après la migration :

1. **Implémenter le frontend** :
   - Composants de sélection de Star Players
   - Interface de gestion des Star Players recrutés
   - Affichage du budget et des contraintes

2. **Créer les tests automatisés** :
   - Tests d'intégration pour tous les endpoints
   - Tests des règles de validation
   - Tests des cas limites

3. **Documentation utilisateur** :
   - Guide de recrutement
   - Explication des règles Blood Bowl
   - FAQ

## 📞 Support

En cas de problème :

1. Vérifier les logs du serveur
2. Consulter la documentation :
   - `STAR-PLAYERS-IMPLEMENTATION.md`
   - `STAR-PLAYERS-TEAM-INTEGRATION.md`
   - `STAR-PLAYERS-QUICKSTART.md`
3. Vérifier que la migration a bien été appliquée : `npx prisma migrate status`

---

**Bonne chance ! 🍀**

