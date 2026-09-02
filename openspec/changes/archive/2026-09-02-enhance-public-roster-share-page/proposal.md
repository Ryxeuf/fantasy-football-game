# Le lien public d'un roster montre l'équipe, pas seulement ses lignes

## Why

`/r/:token` est la seule page du site qu'un coach fait ouvrir à des
inconnus. Elle servait pourtant une version appauvrie de son équipe :

1. **Les compétences y sont des slugs bruts.** La page rend
   `parseSkillList(p.skills).join(", ")`, donc « block, dodge » — les
   identifiants anglais du moteur — là où la fiche du coach affiche
   « Blocage » / « Esquive », distingue la compétence de BASE de la
   compétence ACQUISE et donne sa description au survol. Un visiteur qui
   ne connaît pas les slugs ne lit rien.
2. **Aucun coût par joueur.** L'effectif n'a pas de colonne « Coût », donc
   rien ne dit ce que vaut un joueur — alors que la VE de l'équipe, elle,
   est affichée en en-tête. Un Bloqueur Ogre deux fois amélioré et un
   journalier y sont visuellement équivalents.
3. **Le staff est réduit à des effectifs.** « Relances 2 », « Apothicaire
   Oui » : combien ça a coûté, et ce que vaut l'équipe aujourd'hui
   (VEA), n'apparaissent nulle part.
4. **Le logo n'est pas affiché.** Il est pourtant servi par l'API, et
   l'image OG du même lien le montre déjà. L'équipe n'a donc pas de visage
   sur sa propre page. Le fluff du coach, lui, se noie dans un paragraphe
   gris.

## What Changes

- **Serveur.** `GET /api/public/teams/:token` répond désormais une VUE
  explicite (`services/public-team-view`) plutôt que la ligne `Team`
  brute. Elle porte, calculés par le serveur : `playerValues` (valeur de
  chaque joueur = embauche + surcoûts d'avancement, même résolution que
  la VE), `staffConfig` (coûts unitaires du staff, base d'abord) et
  `budgetSummary` (postes de dépense + VE/VEA fraîches). Les trois sont
  des enrichissements d'AFFICHAGE, chacun isolé : un échec dégrade la
  page, il ne la fait jamais tomber. La lecture reste strictement en
  lecture seule (pas de persistance de la VE fraîche, contrairement à la
  fiche du coach : le visiteur est anonyme).
- **Effectif.** `/r/[token]` rend l'effectif via un composant client
  (`PublicRosterTable`) qui réutilise `SkillTooltip`, `SkillAccessBadges`
  et `KeywordChips` de la fiche du coach : compétences NOMMÉES, base vs
  acquise, accès primaire/secondaire, mots-clés du poste, libellé de poste
  de la base. La page serveur lui fournit le catalogue de compétences
  (`SkillsCatalogProvider`) et le détail du roster, donc les libellés sont
  corrects dès le HTML initial. Nouvelle colonne « Coût » alimentée par
  `playerValues`, plus une présentation en cartes sous `md` (un lien
  partagé s'ouvre surtout au téléphone).
- **Staff & finances.** Nouveau module pur `staff-lines.ts` : les cinq
  postes de staff avec leur COÛT (relances, cheerleaders, assistants,
  apothicaire, fans dévoués — le premier fan est offert), puis une bande
  VE / VEA / trésorerie / coût de l'effectif / Star Players.
- **Identité.** Le logo de l'équipe (celui du coach, sinon l'emblème
  programmatique du roster) ouvre l'en-tête, et le fluff est mis en
  exergue en citation.

## Impact

- **Aucune migration.** Aucune colonne ajoutée : tout est dérivé de
  données déjà persistées.
- **Rétro-compatibilité.** `staffConfig`, `budgetSummary` et
  `playerValues` sont OPTIONNELS côté web : un serveur pré-correctif (ou
  un enrichissement en échec) laisse la page se rabattre sur les défauts
  d'édition et sur le tarif d'embauche du poste, exactement comme la fiche
  du coach.
- **Vie privée.** La vue est explicite, donc `ownerId`, `shareToken` et
  `isPublic` — qui transitaient jusqu'ici dans la réponse anonyme — n'en
  font plus partie, et une colonne ajoutée plus tard au modèle ne peut
  plus devenir publique par accident. Le partage reste opt-in : la porte
  (`isPublic` + jeton) est inchangée.
- **Coût de rendu.** La page fait deux lectures SSR de plus (détail du
  roster, catalogue de compétences), toutes deux en cache ISR et déjà
  utilisées par `/teams/[slug]`. Aucune n'est bloquante : leur échec
  dégrade l'affichage sans casser la page.
