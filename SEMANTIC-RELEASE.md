# 🚀 Semantic Release - Gestion des Versions

Ce projet utilise **semantic-release** pour gérer automatiquement les versions selon les conventions de commits (Conventional Commits).

## 📋 Comment ça fonctionne

Semantic-release analyse les messages de commit et détermine automatiquement la version à publier :
- **feat:** → Version mineure (0.1.0 → 0.2.0)
- **fix:** → Version correctrice (0.1.0 → 0.1.1)
- **BREAKING CHANGE** ou `!` → Version majeure (0.1.0 → 1.0.0)

## 📝 Format des commits

Utilisez le format suivant pour vos commits :

```bash
# Nouvelle fonctionnalité
git commit -m "feat: ajout de la gestion des Star Players"

# Correction de bug
git commit -m "fix: correction du calcul des budgets d'équipe"

# Breaking change (nécessite une version majeure)
git commit -m "feat!: refonte du système d'authentification"

# Ou avec BREAKING CHANGE dans le corps
git commit -m "feat: nouvelle API" -m "BREAKING CHANGE: l'ancienne API est supprimée"
```

## 🔧 Configuration

La configuration est dans `.releaserc.json`. Les types de commits suivants ne génèrent **pas** de release :
- `style`, `chore`, `test`, `build`, `ci`, `docs` (sauf README)

## 🚀 Utilisation

### Release automatique (CI/CD)

Les releases sont automatiques lors d'un push sur `main` via GitHub Actions.

### Release locale (test)

Pour tester la release localement :

```bash
# Installer les dépendances si nécessaire
pnpm install

# Lancer semantic-release en mode dry-run (sans créer de release)
pnpm release --dry-run

# Lancer semantic-release réellement (créera un tag git)
pnpm release
```

## 📦 Fichiers générés

Lors d'une release, semantic-release :
1. ✅ Analyse les commits depuis la dernière release
2. ✅ Détermine la nouvelle version
3. ✅ Génère/met à jour `CHANGELOG.md`
4. ✅ Met à jour `package.json` avec la nouvelle version
5. ✅ Crée un tag git (ex: `v0.2.0`)
6. ✅ Crée une release GitHub avec les notes

## 🔄 Mise à jour de la version affichée

La version affichée dans le footer est automatiquement mise à jour lors du build de l'application web :

```bash
# Le script generate-version.js est exécuté automatiquement avant le build
cd apps/web
pnpm build
```

Le fichier `apps/web/public/version.json` contient la version actuelle.

## 📚 Documentation

- [Semantic Release](https://semantic-release.gitbook.io/)
- [Conventional Commits](https://www.conventionalcommits.org/)

