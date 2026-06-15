# Changesets

Ce dossier pilote [Changesets](https://github.com/changesets/changesets) pour
versionner les packages publiables du monorepo.

## Convention

- `repo` pointe sur `Ryxeuf/fantasy-football-game` (liens auto vers PR/commits
  dans les notes de version générées).
- `baseBranch` : `main`.
- Ajoute un changeset quand une PR change le comportement d'un package publié :

  ```bash
  pnpm changeset
  ```

  Choisis le bump (`patch` / `minor` / `major`) et décris l'impact en une phrase
  orientée utilisateur. Le fichier `.md` généré ici est **versionné** avec la PR.

## Rapport avec semantic-release

L'app (release globale + `CHANGELOG.md` racine) est gérée par
**semantic-release** à partir des commits conventionnels (`.releaserc.json`).
Changesets reste réservé au **versioning fin des `packages/*`** publiables.
Ne pas dupliquer une même note dans les deux canaux.
