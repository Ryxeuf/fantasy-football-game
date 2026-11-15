# Design — Un blog par compétition

## Context

Voir `proposal.md` (Why) et la spec `competition-blog` (exigences). État du
code qui façonne l'approche :

- **Rattachement polymorphe déjà éprouvé** : `CompetitionDocument` porte
  `leagueId` XOR `cupId` (deux FK nullables, cascade native, invariant tenu par
  le service) et ses routes sont montées UNE fois sur
  `/api/competitions/:kind/...` (`routes/competition-documents.ts`). Même
  famille : `LeagueMatchSheet` (`pairingId` XOR `cupPairingId`),
  `CompetitionPrediction`.
- **Visibilité** :
  - ligue : `services/league-access` (`isLeagueVisibleTo`, `canViewLeagueRow`,
    `findVisibleLeague`) — publique, sinon commissaire / admin / inscrit (toute
    saison, tout statut) / invité `pending` ; 404 pour les autres ;
  - coupe : AUCUNE résolution unique. `GET /cup/:id` sert une coupe privée à
    tout compte connecté ; `competition-documents` applique sa propre règle
    (publique, sinon commissaire / admin / équipe inscrite) et répond 403 ;
    les listings composent `cupVisibleClauses` (publique + « à moi »).
- **Membres** : `services/competition-membership` (`leagueMineWhere`,
  `cupMineWhere`, `buildViewerRoles` → `participant = active | withdrawn |
  former | null`) — la notion « inscrit à l'édition courante, non retiré »
  existe déjà en pur.
- **Contenu riche** : le blog admin (`BlogPost`, `routes/admin-blog.ts`) écrit
  du HTML assaini par `utils/sanitize-blog-html.ts` (`sanitize-html`), édité
  avec Tiptap (`app/admin/blog/BlogEditor.tsx`, lié à la médiathèque admin) et
  affiché via `isomorphic-dompurify`. Uploads d'images : `utils/blog-upload`
  (patron des trois gardes, `express.static` monté avant le rate limiter).
- **Commentaires** : `services/pro-gazette-comments` (Pro League, gelée) porte
  la blocklist regex, le soft delete et le masquage « visible de l'auteur et de
  l'admin ».
- **Notifications** : `services/in-app-notifications.createInAppNotification`
  (ne lève jamais), destinataires résolus AVANT l'écriture, notification APRÈS
  le commit (cf. `competition-lifecycle`).
- **Flags** : `KNOWN_FLAGS` + miroir web `featureFlagKeys.ts` ; la CI force
  ON les flags normaux ; un flag absent de la table est vu OFF par l'UI ⇒ clé
  à ajouter au seed de test (ON) ET à `seed.ts` (OFF).
- **Schéma** : `prisma/migrations/` gitignoré, prod en `db push` ⇒ aucune
  colonne ajoutée à une table existante ne peut être backfillée. Ici,
  uniquement des tables neuves.

## Goals / Non-Goals

**Goals:**

- Un blog par ligue et par coupe, UNE mécanique (modèle, service, routes,
  composants) pour les deux.
- Lecture = visibilité de la compétition, résolue en un seul endroit pour les
  deux familles, 404 pour qui ne la voit pas.
- Aligner TOUTES les lectures d'une coupe par id sur cette résolution (la
  coupe privée cesse d'être lisible de tout compte connecté).
- Écriture, réactions, commentaires réservés aux membres ACTUELS ; droits
  effectifs servis par le serveur.
- Contenu riche sûr (assainissement serveur strict, images confinées à la
  compétition), modération par le commissaire, notifications non bloquantes.

**Non-Goals:**

- Rattacher un article à une rencontre / générer un compte rendu depuis la
  feuille de match.
- Réactions sur les commentaires, fils imbriqués, mentions, signalement par
  les lecteurs, file de modération admin globale, flux RSS, indexation SEO.
- Récompenses (succès, Couronnes) liées au blog.

## Decisions

### D1 — Trois tables neuves, rattachement `leagueId` XOR `cupId`

```prisma
model CompetitionPost {
  id            String    @id @default(cuid())
  league        League?   @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  leagueId      String?
  cup           Cup?      @relation(fields: [cupId], references: [id], onDelete: Cascade)
  cupId         String?
  /// Repère d'affichage (ligue) : saison la plus récente à la 1re publication.
  season        LeagueSeason? @relation(fields: [seasonId], references: [id], onDelete: SetNull)
  seasonId      String?
  author        User?     @relation("CompetitionPostAuthor", fields: [authorId], references: [id], onDelete: SetNull)
  authorId      String?
  title         String
  /// HTML assaini côté serveur (profil `competition-post`).
  contentHtml   String    @db.Text
  /// Dérivé du corps à l'écriture (texte brut, ≤ 280 car.) : listings, aperçu.
  excerpt       String?
  coverImageUrl String?
  /// "draft" | "published"
  status        String    @default("draft")
  publishedAt   DateTime?
  /// Notification de publication déjà envoyée (write-once, cf. D7).
  notifiedAt    DateTime?
  /// Dernière modification APRÈS publication (affiche « modifié le »).
  editedAt      DateTime?
  pinnedAt      DateTime?
  hiddenAt      DateTime?
  hiddenById    String?
  hiddenReason  String?
  deletedAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  comments  CompetitionPostComment[]
  reactions CompetitionPostReaction[]

  @@index([leagueId, status, publishedAt])
  @@index([cupId, status, publishedAt])
  @@index([authorId, createdAt])
}

model CompetitionPostComment {
  id           String    @id @default(cuid())
  post         CompetitionPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId       String
  author       User?     @relation("CompetitionPostCommentAuthor", fields: [authorId], references: [id], onDelete: SetNull)
  authorId     String?
  body         String    @db.Text
  editedAt     DateTime?
  hiddenAt     DateTime?
  hiddenById   String?
  /// "blocklist:<motif>" (auto) ou raison saisie par le modérateur.
  hiddenReason String?
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())

  @@index([postId, createdAt])
  @@index([authorId, createdAt])
}

model CompetitionPostReaction {
  id        String   @id @default(cuid())
  post      CompetitionPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  /// Slug du catalogue fixe (`REACTION_KINDS`).
  kind      String
  createdAt DateTime @default(now())

  @@unique([postId, userId, kind])
  @@index([postId, kind])
}
```

- **Polymorphe plutôt que deux tables** : patron de `CompetitionDocument`. La
  famille se DÉDUIT de la FK présente, jamais d'une colonne `kind` qui pourrait
  mentir. L'invariant XOR est tenu par le service, seul chemin d'écriture.
- **`authorId` en `SetNull`** (contenu conservé, « coach supprimé »),
  **réaction en `Cascade`** (une réaction anonyme n'a pas de sens).
- **Masquage = colonnes, pas statut** : un article peut être publié ET masqué ;
  le démasquage le rend tel quel. Même posture que `flaggedAt` de la Gazette,
  avec l'auteur du masquage en plus (le commissaire n'est pas l'admin).
- **Soft delete** (`deletedAt`) : une suppression par le commissaire doit
  rester explicable en cas de litige entre coachs ; les lectures filtrent.
- **Réaction à clé unique `(postId, userId, kind)`** : la bascule est un
  `upsert` / `deleteMany`, idempotente ; une course lève P2002, traitée comme
  « déjà posée » (pas de `createMany({ skipDuplicates })`, absent de SQLite).
- **Pas de compteurs persistés** : comptes de réactions et de commentaires par
  `groupBy` à la lecture (un appel pour toute la page d'articles). Aucun
  compteur ne peut dériver.

### D2 — `services/competition-access` : UNE résolution pour les deux familles

```ts
type CompetitionKind = "league" | "cup";
interface CompetitionRef { kind; id; name; creatorId; isPublic; status }

findVisibleCompetition(kind, id, viewer): Promise<CompetitionRef | null>
```

- Ligue : délègue à `canViewLeagueRow` (règle inchangée).
- Coupe : `isPublic`, sinon admin, commissaire, propriétaire d'une équipe
  inscrite (`CupParticipant`), ou invitation `pending` nommée
  (`CupInvitation.inviteeUserId`) — calque exact de la ligue.
- `null` ⇒ la route répond **404 avec le message d'une compétition
  inexistante**, pour les DEUX familles.

Alternatives écartées :
- *Réutiliser `canViewCompetitionDocuments`* : sa branche coupe répond 403 et
  ignore les invités ; le blog est une surface neuve, autant la poser sur la
  bonne règle. Les documents pourront basculer sur ce module (suite).
- *Suivre `GET /cup/:id` (toute coupe lisible par tout compte connecté)* :
  lecture littérale de « même visibilité que la compétition », mais elle
  ferait d'un blog de coupe privée un contenu lisible de n'importe qui — la
  règle « gater un contenu, c'est gater toutes ses lectures » dit l'inverse.

### D2bis — Les lectures de coupe s'alignent (décision du 2026-11-15)

Plutôt que de laisser le blog plus fermé que la coupe, TOUTES les lectures
d'une coupe par id passent par `findVisibleCup` (garde de route
`ensureVisibleCup`, 404 « Coupe introuvable ») : fiche (`GET /cup/:id`),
rondes, poules, play-offs, classements individuels, pronostics et leur
classement, fiche de roster d'un inscrit, feuille de match (la garde
polymorphe `ensureVisiblePairingLeague` devient
`ensureVisibleCompetitionPairing` : ligue OU coupe) et documents officiels
(403 → 404). Les mutations gardent leurs contrôles de rôle existants ; les
listings appliquent déjà la même règle (`cupVisibleClauses`).

Conséquences acceptées :
- une équipe RETIRÉE d'une coupe privée (ligne `CupParticipant` supprimée)
  perd l'accès à la coupe — comme un coach qui n'y est pas ; ses résultats
  restent au classement ;
- la page publique d'invitation par code (`/cup/invitations/:code`) reste
  ouverte : elle ne sert que le nom et l'état de l'invitation, et c'est elle
  qui permet d'entrer.

### D3 — Membres et droits : module PUR `competition-blog-rules`

```ts
interface BlogViewerContext {
  isAdmin: boolean; isCommissioner: boolean;
  participant: ViewerParticipation;      // de buildViewerRoles
  competitionArchived: boolean;
}
blogPermissions(ctx) → { canWrite, canReact, canComment, canModerate }
canSeePost(post, viewerId, perms) / canSeeComment(...)
```

- `isMember = isCommissioner || participant === "active"` — réutilise
  `buildViewerRoles` tel quel (édition courante = saison de plus grand numéro,
  inscription non retirée), aucune règle d'appartenance nouvelle.
- `canWrite = canReact = canComment = (isMember || isAdmin) && !archived`.
- `canModerate = isCommissioner || isAdmin` (archivage compris).
- Un brouillon n'est visible que de son auteur ; un contenu masqué de son
  auteur et des modérateurs ; un contenu supprimé de personne.
- Les droits sont SERVIS dans chaque réponse (`viewer: { canWrite, … }`) :
  l'écran n'a pas à redéduire (cf. `competitionRules` des feuilles).

Alternative écartée : membres = « à moi » (`leagueMineWhere`, anciens
participants compris). Un coach parti depuis trois saisons continuerait de
poster dans une ligue qu'il ne joue plus ; on préfère le lire sans l'écrire.
L'ouverture plus large (anciens, ou tout lecteur) est une option de compétition
possible plus tard (`blogParticipation`), pas un défaut.

### D4 — Assainissement : profil dédié, images confinées à la compétition

`utils/sanitize-competition-post-html.ts` (pur), dérivé de
`sanitize-blog-html` mais plus strict, car l'auteur n'est plus un admin :

- balises : `p, br, strong, em, s, u, blockquote, ul, ol, li, h2, h3, a, img,
  hr, code, pre` ; ni `iframe`, ni `style`, ni `class`, ni attribut `on*` ;
- `a[href]` : `http`, `https`, `mailto` ; `rel="nofollow ugc noopener"` et
  `target="_blank"` imposés par transformation ;
- `img[src]` : uniquement sous le préfixe des uploads DE LA compétition
  (`/uploads/competition-blog/<kind>-<competitionId>/`) — empêche pixels
  espions, hotlinks et réemploi d'images d'un blog privé dans un autre ;
- limite : 50 000 caractères après assainissement, corps vide refusé ;
- `excerpt` = texte brut des 280 premiers caractères, dérivé à l'écriture.

La couverture (`coverImageUrl`) obéit à la même règle de préfixe.

### D5 — Upload d'images : patron des trois gardes, sans table

`utils/competition-blog-upload.ts` + `POST /api/competitions/:kind/:id/blog/images` :
corps brut (`express.raw`, limite 3 Mo portée par le parser ⇒ 413), type par
octets magiques (JPEG, PNG, WebP, GIF ⇒ 415 sinon), nom généré
(`<alea>.<ext>`), dossier `getCompetitionBlogUploadDir()` résolu à l'appel,
sous-dossier par compétition, servi par `express.static` monté avant le rate
limiter. Pas de table : comme la médiathèque du blog, le disque fait foi ; le
nettoyage des images orphelines (uploadées puis jamais publiées) est une suite.
Limite : 20 images par auteur et par 24 h. Sans table, un fichier n'est pas
attribuable à son auteur : la limite est un compteur mémoire par processus —
suffisant pour un garde-fou, cf. Risks.

### D6 — Routes : un seul routeur monté sur `/api/competitions/:kind/:id/blog`

| Méthode | Chemin | Auth | Droit |
|---|---|---|---|
| GET | `/posts?cursor&limit&drafts=mine` | `optionalAuthUser` | lecture |
| GET | `/posts/:postId` | `optionalAuthUser` | lecture (+ réactions, droits) |
| GET | `/posts/:postId/comments?cursor&limit` | `optionalAuthUser` | lecture |
| POST | `/posts` | `authUser` | `canWrite` |
| PATCH | `/posts/:postId` | `authUser` | auteur + `canWrite` |
| DELETE | `/posts/:postId` | `authUser` | auteur ou `canModerate` |
| POST | `/posts/:postId/publish` / `/unpublish` | `authUser` | auteur + `canWrite` |
| PUT / DELETE | `/posts/:postId/reactions/:kind` | `authUser` | `canReact` |
| POST | `/posts/:postId/comments` | `authUser` | `canComment` |
| PATCH / DELETE | `/comments/:commentId` | `authUser` | auteur (`canComment` pour PATCH) ou `canModerate` (DELETE) |
| POST | `/posts/:postId/hide` / `/unhide` / `/pin` / `/unpin` | `authUser` | `canModerate` |
| POST | `/comments/:commentId/hide` / `/unhide` | `authUser` | `canModerate` |
| POST | `/images` | `authUser` | `canWrite` |

- Toutes : `requireFeatureFlag("competition_blog")`, puis
  `findVisibleCompetition` (404) AVANT tout contrôle de droit (403) — un 403
  ne doit jamais révéler une compétition privée.
- Toute mutation passe par `validate(schema)` / `validateParams`, corps typé
  par `z.infer` (garde `no-raw-body-cast`).
- Un `postId` / `commentId` appartenant à une AUTRE compétition que celle de
  l'URL ⇒ 404 (sinon la garde de visibilité se contourne par l'URL).
- Erreurs typées `CompetitionBlogError` (`code` enum) mappées en statut par
  `instanceof`.
- Compétition archivée (`League.status = archived`, `Cup.status = archivee`) ⇒
  409 `competition_archived` sur toute écriture non modératrice.
- Limites de débit service : 10 articles publiés / 24 h / auteur /
  compétition ; 30 commentaires / 10 min / auteur (429). Comptées en base
  (`count` sur `createdAt`), donc justes en multi-processus.

### D7 — Notifications : une fois par article, coalescées par article

- Publication : `notifiedAt` write-once (`updateMany … where notifiedAt:
  null`) — seule la requête qui l'écrit notifie ; une republication ne
  renotifie pas. Destinataires = membres (commissaire + propriétaires
  d'équipes engagées) moins l'auteur, résolus avant, notifiés après le commit,
  `kind = "competition.blog.post_published"`, `url` = l'article.
- Commentaire : notifie l'auteur de l'article (sauf lui-même) en
  `competition.blog.comment`, SAUF s'il a déjà une notification non lue de ce
  kind pour ce `meta.postId` — pas de rafale.
- Tout dans un `try/catch` : la notification ne fait jamais échouer
  l'écriture.

### D8 — Web : composants paramétrés par `competition`, éditeur réduit

- `app/components/competition-blog/` : `CompetitionBlogPanel` (bloc de fiche,
  3 derniers), `CompetitionBlogList`, `CompetitionPostView` (DOMPurify à
  l'affichage), `PostReactions`, `PostComments`, `CompetitionPostForm`,
  `RichTextEditor` (Tiptap StarterKit + Link + Image + Placeholder, bouton
  d'upload vers la route de la compétition, pas de médiathèque).
  Chemins d'API et libellés dérivés de `competition = { kind, id }` (patron
  des pronostics de coupe : on paramètre, on ne clone pas).
- Pages minces sous `app/leagues/[id]/blog/{page,[postId]/page,new/page,[postId]/edit/page}.tsx`
  et l'équivalent `app/cups/[id]/blog/…`, `metadata.robots = noindex`.
- Gate d'écran par le flag (`useFeatureFlagOrOff`) ; boutons pilotés par les
  droits servis, jamais recalculés.
- `data-testid` : `competition-blog-panel`, `blog-post-card`,
  `post-reaction-fire`, `post-comment-form`, `post-moderation-menu`.

### D9 — Blocklist partagée

La blocklist de `pro-gazette-comments` part dans
`services/text-blocklist.ts` (`detectBlocklist`, pur) importé par la Gazette
(comportement inchangé, ses tests restent verts) et par le blog. Appliquée aux
commentaires ET au titre / texte brut des articles (article masqué
automatiquement, publiable une fois rétabli par un modérateur).

## Risks / Trade-offs

- **[Images d'un blog privé accessibles par URL]** → `express.static` sert
  sans contrôle d'accès ; noms aléatoires non devinables, préfixe non listable,
  `noindex`. Même posture que les documents officiels. Servir par une route
  gardée est possible plus tard si un besoin de confidentialité forte apparaît.
- **[Limite d'upload en mémoire]** → réinitialisée au redémarrage et par
  processus ; acceptable pour un garde-fou anti-abus, la limite de taille
  restant portée par le parser.
- **[Contenu généré par les utilisateurs]** → blocklist courte, pas de
  signalement par les lecteurs en v1 : le commissaire est le modérateur de
  première ligne (il connaît ses coachs), l'admin en recours. Flag OFF par
  défaut pour une ouverture progressive.
- **[Membre qui perd ses droits]** → un coach retiré garde ses contenus et
  peut encore les supprimer, plus les modifier : pas de réécriture a posteriori
  d'un échange par quelqu'un qui n'est plus dans la compétition.
- **[Coût des lectures]** → liste d'articles = 1 requête paginée + 2 `groupBy`
  (réactions, commentaires) + droits (au plus 2 requêtes) ; pas de N+1.
- **[Coupe privée qui se ferme]** → des coachs qui lisaient une coupe privée
  sans en être (lien partagé) ne la voient plus. C'est le sens même de
  « privée » ; le commissaire peut la repasser publique ou inviter.

## Migration Plan

1. `db push` des trois tables (aucune donnée existante touchée, rien à
   backfiller).
2. Flag `competition_blog` absent en prod ⇒ fonctionnalité invisible ; seed
   prod l'ajoute OFF, seed de test ON.
3. Recette par override de compte, puis ouverture.
4. Rollback : éteindre le flag ; les tables peuvent rester.

## Open Questions

Tranchées le 2026-11-15 :

- **Visibilité des coupes privées** : alignée dans ce change (D2bis).
- **Anciens participants** : lecture seule, ni article ni commentaire.
- **Réactions des lecteurs** : réservées aux membres.
