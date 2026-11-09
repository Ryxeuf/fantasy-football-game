# Tasks

> Brouillon : à réviser après `/opsx:explore` (questions ouvertes du design).

## 0. Exploration

- [ ] 0.1 Trancher avec les testeurs les questions ouvertes du design (formule, seuil, même adversaire, propres équipes, fin de saison, engagement) et compléter les scénarios du spec

## 1. Modèle et format

- [ ] 1.1 `League.format String?` + paramètres du classement libre (`Json?`), miroirs SQLite, parseur pur (`null` → `standard`)
- [ ] 1.2 Schémas Zod de création / édition de ligue, verrou du format après la première rencontre jouée

## 2. Rencontres déclarées

- [ ] 2.1 Module pur d'allocation de la journée mensuelle (nom, numéro `max + 1`, réouverture)
- [ ] 2.2 Route de déclaration (coach propriétaire ou commissaire), gardes, notification de l'adversaire
- [ ] 2.3 `startSeason` sans génération de calendrier en format `open`
- [ ] 2.4 Garde d'ouverture de feuille chronologique en format `open`

## 3. Classement

- [ ] 3.1 Module pur `league-open-standings` (score, seuil, classées / non classées) + tests en table
- [ ] 3.2 Branchement dans `computeSeasonStandings`, récapitulatif de saison et exports PDF (classées seulement)

## 4. Web

- [ ] 4.1 Choix du format dans le formulaire de ligue
- [ ] 4.2 « Déclarer un match » sur la fiche de ligue
- [ ] 4.3 Classement libre (classées / non classées, n/seuil)
- [ ] 4.4 Calendrier trié par date en format `open`

## 5. Bout en bout

- [ ] 5.1 Spec e2e-api : déclaration, feuille, validation, classement avec seuil
