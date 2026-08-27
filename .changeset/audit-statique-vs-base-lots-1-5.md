---
"@bb/server": patch
"@bb/web": patch
"@bb/game-engine": patch
---

Audit « statique vs base de données » — lots 1 à 5. Le moteur applicatif
s'appuie désormais sur les tables Prisma éditées en admin plutôt que sur le
catalogue compilé dans `@bb/game-engine`, qui ne sert plus que de repli.

- **Ligues régionales, règlements et paires (lot 1).**
  `resolveTeamRegionalRules` était appelé sans ses règles déclarées : une Ligue
  éditée en admin ne changeait ni l'embauche de Star Players ni la feuille de
  match, et un roster créé uniquement en base était refusé « non reconnu ». Les
  réglages commissaire et le barème d'avancements passent par le repository de
  règlements (base d'abord). Un Star Player absent du ruleset par défaut était
  compté 0 po à la création d'équipe — donc gratuit.
- **Progression « équipe libre » (lot 2).** `PUT /team/:id/players/:playerId/skills`
  n'imposait aucune restriction d'accès sur ~95 % des postes (la table du moteur
  n'en couvre que 12) et refusait toute compétence créée en admin. Elle suit
  maintenant `Position.primarySkills`/`secondarySkills` et la table `Skill`,
  comme le chemin ligue. Le tirage aléatoire est seedé et filtré en base.
- **Coûts, journaliers et règles de feuille (lot 3).** Les contrôles de budget
  mélangeaient tarif catalogue et tarif base. Les journaliers de feuille de
  ligue prennent leur prix, leurs stats et leur slug dans `Position` : un prix
  corrigé en admin change enfin la VEA du match et le débit post-match, et un
  slug renommé ne rend plus le journalier « payé mais jamais matérialisé ». Les
  10 000 po d'une compétence Élite manquaient à son recrutement.
- **Coups de pouce (lot 4).** Le match en ligne et le match local partaient d'un
  contexte vide : remises officielles perdues, plafonds majorés ignorés, coups
  de pouce conditionnels refusés à toutes les équipes. Corrigé au passage : la
  cagnotte du match local, calculée sur un champ inexistant, était toujours
  nulle.
- **Front web (lot 5).** Coûts, budgets, éligibilités et libellés viennent de
  l'API — souvent déjà chargée dans le composant — au lieu du catalogue du
  bundle : colonne « Coût », PDF et cartes PNG alignés sur la VE serveur,
  budget du builder aligné sur ce que le serveur construit, catégories de
  compétences proposées effectivement acceptées, pages Ligues servies par
  `Roster.regionalRules`.
