# Tasks

## 1. Modèle et flag

- [ ] 1.1 Ajouter `CompetitionPost`, `CompetitionPostComment`, `CompetitionPostReaction` au schéma Prisma (PG + miroir SQLite de test) avec les relations inverses sur `League`, `Cup`, `LeagueSeason`, `User` ; vérifier par `prisma validate` et un `db push` sur la base de test
- [ ] 1.2 Déclarer le flag `competition_blog` (constante, `KNOWN_FLAGS`, miroir web `featureFlagKeys.ts`), OFF dans `seed.ts`, ON dans `/__test/seed-rosters` ; vérifier par les tests de `featureFlags` (flag normal, absent de `KILL_SWITCH_FLAGS`)

## 2. Visibilité commune ligue | coupe

- [ ] 2.1 Créer `services/competition-access.ts` : `isCupVisibleTo` (pur, calque de `isLeagueVisibleTo` : publique, admin, commissaire, inscrit, invité `pending`), `findVisibleCompetition(kind, id, viewer)` (ligue ⇒ `canViewLeagueRow`, coupe ⇒ règle ci-dessus, requêtes d'appartenance seulement si nécessaires) ; vérifier par `competition-access.test.ts` en table (publique / privée × anonyme / étranger / commissaire / admin / inscrit / invité / inscription retirée ou supprimée)
- [ ] 2.2 Ajouter les gardes de route `ensureVisibleCup` / `ensureVisibleCompetition` (404, même message qu'un id inconnu) ; vérifier par des tests unitaires
- [ ] 2.3 Aligner les lectures de coupe par id sur `ensureVisibleCup` : `GET /cup/:id`, rondes, poules, play-offs, fiche de roster, classements individuels, pronostics (+ classement), feuille de match (garde polymorphe ligue | coupe) et documents officiels (403 → 404) ; vérifier par un test de chaîne Express réelle en table (coupe publique / privée × étranger / inscrit / invité / commissaire / admin) et les tests existants des routes de coupe

## 3. Règles pures du blog

- [ ] 3.1 Créer `services/competition-blog-rules.ts` : `REACTION_KINDS`, `blogPermissions(ctx)` (membre = commissaire ou `participant === "active"` de `buildViewerRoles`, admin, archivage), `canSeePost`, `canSeeComment`, `canEditPost`, `canDeletePost`, `canEditComment`, `canDeleteComment` ; vérifier par `competition-blog-rules.test.ts` en table (commissaire sans équipe, actif, retiré, ancienne saison, invité, lecteur, anonyme, admin, compétition archivée ; brouillon, masqué, supprimé, auteur supprimé)
- [ ] 3.2 Extraire la blocklist de `pro-gazette-comments` dans `services/text-blocklist.ts` (`detectBlocklist`, pur) ; vérifier que `pro-gazette-comments.test.ts` reste vert et ajouter `text-blocklist.test.ts`
- [ ] 3.3 Créer `utils/sanitize-competition-post-html.ts` (profil strict, `rel="nofollow ugc noopener"`, `img`/couverture confinées au préfixe de la compétition, limite de taille, `excerpt` dérivé) ; vérifier par des tests (script, `on*`, `style`, `iframe`, `javascript:`, image externe, image d'une autre compétition, corps vide, corps trop long, extrait)

## 4. Service et routes des articles

- [ ] 4.1 Créer `services/competition-blog.ts` : créer / modifier / supprimer (soft) / publier (`publishedAt` et `seasonId` fixés une fois) / dépublier, épingler, masquer / rétablir, lister (épinglés puis `publishedAt` desc, curseur, brouillons de l'auteur sur demande, comptes de réactions et commentaires par `groupBy`), lire un article (réactions + « les miennes » + droits), invariant XOR, appartenance de l'article à la compétition de l'URL, limite 10 publications / 24 h, refus 409 si archivée ; vérifier par `competition-blog.test.ts` à Prisma mocké (dont absence de N+1 sur la liste)
- [ ] 4.2 Créer `schemas/competition-blog.schemas.ts` et `routes/competition-blog.ts` (table de routes du design, `requireFeatureFlag`, `optionalAuthUser` en lecture, `validate` / `validateParams`, erreurs typées ⇒ statuts), monté sous `/api/competitions` dans `index.ts` ; vérifier par des tests de route (400 sur schéma, 403 non-membre, 404 article d'une autre compétition, 409 archivée, 403 flag éteint)
- [ ] 4.3 Écrire `routes/competition-blog-access.test.ts` sur la chaîne Express réelle (JWT réels, Prisma mocké) : ligue publique / privée et coupe publique / privée × anonyme / étranger / membre / ancien participant, en table sur toutes les lectures — 404 identique pour l'invisible, jamais 403 avant la garde de visibilité

## 5. Réactions et commentaires

- [ ] 5.1 Implémenter la bascule de réaction (`upsert` / `deleteMany`, P2002 = déjà posée, type hors catalogue ⇒ 400, article masqué / brouillon ⇒ 404) ; vérifier par des tests (bascule, plusieurs types, double envoi, non-membre 403)
- [ ] 5.2 Créer `services/competition-blog-comments.ts` : créer (1..2000, blocklist ⇒ masqué `blocklist:<motif>`, limite 30 / 10 min ⇒ 429), modifier (auteur, `editedAt`), supprimer (auteur ou modérateur), masquer / rétablir, lister à plat paginé selon la perspective ; vérifier par `competition-blog-comments.test.ts`

## 6. Images

- [ ] 6.1 Créer `utils/competition-blog-upload.ts` (dossier résolu à l'appel, sous-dossier par compétition, octets magiques JPEG/PNG/WebP/GIF, nom généré, limite 20 / 24 h / auteur) et la route `POST …/blog/images` (`express.raw` 3 Mo), `express.static` monté avant le rate limiter ; vérifier par des tests (413, 415 archive renommée, 403 non-membre, nom client jamais réutilisé, URL servie sous le bon préfixe)

## 7. Notifications

- [ ] 7.1 Brancher `competition.blog.post_published` (write-once `notifiedAt`, membres hors auteur, après commit) et `competition.blog.comment` (auteur de l'article, coalescence sur notification non lue du même `postId`), tous deux en `try/catch` ; vérifier par des tests (première publication, republication silencieuse, rafale de commentaires = une notification, auto-commentaire silencieux, échec de notification sans effet sur l'écriture)

## 8. Web

- [ ] 8.1 Créer `app/components/competition-blog/api.ts` (chemins dérivés de `competition = { kind, id }`) et les types de réponse (champs de droits optionnels pour la rétro-compatibilité) ; vérifier par des tests unitaires des chemins
- [ ] 8.2 Créer `RichTextEditor` (Tiptap réduit, upload vers la route de la compétition) et `CompetitionPostForm` (titre, couverture, corps, brouillon / publier) ; vérifier par des tests RTL (validation du titre, upload en erreur affiché, publication)
- [ ] 8.3 Créer `CompetitionBlogList`, `CompetitionPostView` (DOMPurify, « modifié le », auteur supprimé, badge masqué + raison pour auteur / modérateur), `PostReactions`, `PostComments`, menu de modération ; vérifier par des tests RTL pilotés par les droits servis (lecteur sans boutons, membre, modérateur)
- [ ] 8.4 Créer `CompetitionBlogPanel` et l'insérer dans `/leagues/[id]` et `/cups/[id]` derrière le flag ; vérifier par des tests de page (flag éteint ⇒ aucun bloc ; 3 derniers articles ; bouton d'écriture selon `canWrite`) — mocks d'`apiRequest` PAR CHEMIN
- [ ] 8.5 Créer les pages `blog`, `blog/[postId]`, `blog/new`, `blog/[postId]/edit` sous `app/leagues/[id]/` et `app/cups/[id]/` (minces, `robots: noindex`, 404 rendu proprement) ; vérifier par des tests de page

## 9. Bout en bout et documentation

- [ ] 9.1 Écrire `tests/e2e-api/specs/competition-blog.spec.ts` sur une vraie base : ligue privée avec deux coachs + un étranger, publication, notification, réaction, commentaire, masquage par le commissaire, 404 de l'étranger, archivage ⇒ 409 ; même parcours abrégé sur une coupe privée ; vérifier que la spec passe localement
- [ ] 9.2 Ajouter une entrée d'aide « Le blog de la compétition » et documenter `docs/competition-blog.md` (modèle, droits, visibilité, modération) ; consigner dans `CLAUDE.md` le patron « une résolution de visibilité par compétition (`competition-access`) » ; vérifier que la doc cite les routes et les deux kinds de notification
- [ ] 9.3 Reporter les suites (article rattaché à une rencontre, réactions sur commentaires, signalement, file de modération admin, nettoyage des images orphelines, option `blogParticipation`) dans `docs/roadmap/backlog/openspec-suites.md` ; vérifier que chaque élément « hors périmètre » du proposal y figure
