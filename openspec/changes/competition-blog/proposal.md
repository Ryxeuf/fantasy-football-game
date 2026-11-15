# Un blog par compétition, écrit par ses coachs

## Why

Une ligue ou une coupe vit aujourd'hui en dehors du site : comptes rendus de
match, piques d'avant-journée, annonces du commissaire, photos de la table
passent par Discord ou WhatsApp. Le site n'en garde rien, alors qu'il porte
déjà tout le reste de la compétition (calendrier, feuilles, classement,
pronostics, documents officiels). Les seuls espaces d'écriture existants ne
conviennent pas :

- le **blog du site** (`BlogPost`, `/blog`) est éditorial, réservé à l'admin,
  sans rattachement à une compétition ni commentaires ;
- les **commentaires de la Gazette** (`ProGazetteComment`) vivent dans la Pro
  League, gelée, et commentent des articles générés ;
- les **documents officiels** (`CompetitionDocument`) sont des fichiers du
  commissaire, pas une conversation.

Le besoin : chaque compétition a SON blog, alimenté par ses coachs, sur lequel
ils réagissent et commentent — et qui n'est lisible que de ceux qui peuvent
lire la compétition.

## What Changes

- **Un blog par compétition** (ligue ET coupe, une seule mécanique) :
  articles en texte riche (titre, corps, image de couverture facultative,
  images dans le corps), brouillon puis publication, épinglage par le
  commissaire. Pour une ligue, le blog couvre toutes ses saisons (c'est la
  ligue qui a une histoire) ; chaque article garde la saison courante au
  moment de sa publication comme repère d'affichage.
- **Qui écrit** : les MEMBRES de la compétition — le commissaire et les coachs
  dont une équipe est engagée dans l'édition courante (saison la plus récente
  d'une ligue, inscription à la coupe), hors équipe retirée. Un ancien
  participant, un coach retiré, un invité ou un simple lecteur d'une
  compétition publique lisent sans écrire. L'admin peut écrire et modérer
  partout.
- **Réactions** : un catalogue FIXE de réactions (👍 ❤️ 😂 😮 🔥 💀), une
  réaction de chaque type par membre et par article, bascule en un clic,
  compteurs servis avec « la mienne ».
- **Commentaires** : texte brut, à plat (pas de fil imbriqué en v1),
  modifiables et supprimables par leur auteur, filtrés par la blocklist
  existante (auto-masquage), réservés aux membres.
- **Visibilité = celle de la compétition** : une résolution UNIQUE
  `services/competition-access` (ligue : `league-access` tel quel ; coupe :
  publique, ou commissaire / admin / équipe inscrite / invitation en attente).
  Un lecteur qui ne voit pas la compétition reçoit un **404** sur toutes les
  lectures du blog, avec le même message qu'un id inexistant. Lectures
  ouvertes via `optionalAuthUser` : le blog d'une compétition publique se lit
  sans compte.
- **Coupes privées alignées sur la même règle** : la visibilité d'une coupe
  privée n'avait jamais été tranchée — `GET /cup/:id` et toutes ses lectures
  (rondes, poules, play-offs, classements, pronostics, rosters, feuille de
  match) la servaient à tout compte connecté, et les documents officiels
  répondaient 403. Toutes ces lectures passent désormais par
  `competition-access` : une coupe privée n'existe que pour son commissaire,
  les admins, les propriétaires d'une équipe inscrite et les coachs invités ;
  les autres reçoivent un 404, comme pour une ligue privée.
- **Modération** : le commissaire modère le blog de SA compétition (masquer /
  rétablir un article ou un commentaire avec une raison, épingler,
  supprimer), l'admin partout. Un contenu masqué reste visible de son auteur
  et des modérateurs, avec la raison.
- **Cycle de vie** : compétition archivée ⇒ blog en lecture seule (la
  modération reste possible) ; compétition supprimée ⇒ blog supprimé en
  cascade ; compte supprimé ⇒ ses articles restent, signés « coach
  supprimé ».
- **Notifications internes** (jamais bloquantes) : nouvel article publié ⇒
  membres de la compétition (sauf l'auteur) ; nouveau commentaire ⇒ auteur de
  l'article, une notification non lue par article au plus.
- **Écran** : bloc « 📰 Blog » (trois derniers articles) sur la fiche ligue et
  la fiche coupe, pages liste / article / rédaction sous
  `/leagues/[id]/blog` et `/cups/[id]/blog`, composants PARTAGÉS paramétrés
  par `competition`. Éditeur riche Tiptap réduit (pas de médiathèque admin).
- **Sécurité du contenu** : HTML assaini côté serveur par un profil plus
  strict que celui du blog admin (pas d'`iframe`, pas de `style`, liens
  `rel="nofollow ugc noopener"`, images limitées aux uploads DE LA
  compétition), images uploadées selon le patron des trois gardes (corps
  brut, magic bytes, nom généré), limites de débit par auteur, pages
  `noindex`.
- **Derrière un flag** `competition_blog` (gate normal, pas kill-switch), OFF
  en prod, ON dans les seeds de test.

## Capabilities

### New Capabilities

- `competition-blog` : blog rattaché à une ligue ou une coupe — articles,
  réactions, commentaires, droits d'écriture des membres, visibilité héritée de
  la compétition, modération du commissaire, notifications et cycle de vie.

- `cup-visibility` : une coupe privée est INVISIBLE (404) hors de ses membres,
  sur toutes ses lectures par id — calque de `league-visibility`.

### Modified Capabilities

<!-- `league-visibility` est RÉUTILISÉE telle quelle. `competition-documents`
voit sa branche coupe passer de 403 à 404, ce que couvre `cup-visibility`. -->

## Impact

- **Prisma** : trois modèles neufs `CompetitionPost` (`leagueId` XOR `cupId`,
  patron de `CompetitionDocument`), `CompetitionPostComment`,
  `CompetitionPostReaction` ; relations inverses sur `League`, `Cup`,
  `LeagueSeason`, `User`. Tables neuves uniquement : aucun backfill
  (`db push`), aucune colonne ajoutée à une table existante.
- **Serveur** : `services/competition-access.ts` (nouveau, résolution
  ligue|coupe), `services/competition-blog-rules.ts` (pur : membres, droits,
  états), `services/competition-blog.ts`, `services/competition-blog-comments.ts`,
  `utils/sanitize-competition-post-html.ts`, `utils/competition-blog-upload.ts`,
  routes montées sur `/api/competitions/:kind/:id/blog/...`, extraction de la
  blocklist de `pro-gazette-comments` dans un module partagé, flag
  `competition_blog` (`KNOWN_FLAGS`, seeds).
- **Web** : `app/components/competition-blog/*`, pages sous
  `app/leagues/[id]/blog/` et `app/cups/[id]/blog/`, bloc sur les deux fiches,
  éditeur Tiptap réduit, miroir `featureFlagKeys.ts`, entrée d'aide.
- **Notifications** : deux `kind` neufs (`competition.blog.post_published`,
  `competition.blog.comment`).
- **Tests** : règles pures en table, assainissement, chaîne Express réelle sur
  la visibilité (ligue privée, coupe privée, anonyme), spec e2e-api.
- **Coupes** : `routes/cup.ts` (`GET /:id`), `cup-rounds`, `cup-pools`,
  `cup-playoffs`, `cup-team-roster`, `cup-leaderboards`, `cup-predictions`,
  feuille de match (garde polymorphe ligue | coupe), documents officiels.
- **Hors périmètre (suites)** : article rattaché à une rencontre (compte rendu depuis la
  feuille), réactions sur les commentaires, fils imbriqués, mentions
  `@coach`, file de modération admin globale, signalement par les lecteurs,
  ouverture des commentaires aux non-membres, nettoyage des images orphelines,
  succès / Couronnes liés au blog.
