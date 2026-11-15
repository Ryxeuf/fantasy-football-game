# Blog des compétitions

Change OpenSpec : `competition-blog` (2026-11-15). Flag : `competition_blog`
(gate NORMAL, OFF en prod, ON dans les seeds de test).

Chaque ligue et chaque coupe a son blog. Les coachs engagés y publient des
articles, réagissent et commentent ; le commissaire modère. Le blog se lit
exactement comme la compétition.

## Modèle

| Table | Rôle |
|---|---|
| `CompetitionPost` | article, rattaché à une ligue **XOR** une coupe (`leagueId` / `cupId`, invariant tenu par `services/competition-blog`, seul chemin d'écriture) |
| `CompetitionPostComment` | commentaire en texte brut, à plat |
| `CompetitionPostReaction` | réaction d'un coach, clé unique `(postId, userId, kind)` |

- Masquage et suppression sont des **colonnes** (`hiddenAt` / `hiddenById` /
  `hiddenReason`, `deletedAt`), jamais un DELETE.
- `publishedAt`, `seasonId` (saison courante d'une ligue) et `notifiedAt` sont
  **write-once** : une republication ne change ni la date ni la saison, et ne
  renotifie personne.
- Aucun compteur persisté : réactions et commentaires se comptent par `groupBy`
  à la lecture.
- Compte supprimé : ses articles et commentaires restent (`SetNull`, « coach
  supprimé »), ses réactions partent (`Cascade`).

## Qui fait quoi

Règles pures : `services/competition-blog-rules`.

| Lecteur | Lire | Publier / réagir / commenter | Modérer |
|---|---|---|---|
| Commissaire | ✅ | ✅ | ✅ |
| Coach dont une équipe est engagée dans l'édition courante | ✅ | ✅ | — |
| Coach retiré, ancien participant, invité | ✅ (si visible) | — | — |
| Lecteur d'une compétition publique, anonyme compris | ✅ | — | — |
| Admin | ✅ | ✅ | ✅ |

Édition courante = saison de plus grand numéro (ligue), la coupe elle-même
(coupe) — `buildViewerRoles` tel quel. Compétition archivée ⇒ lecture seule
(409), la modération reste possible. L'auteur supprime toujours son contenu ;
il ne le modifie que tant qu'il peut écrire.

## Visibilité

`services/competition-access` résout la visibilité des DEUX familles :

- ligue : `league-access` inchangé ;
- coupe : publique, sinon commissaire, admin, propriétaire d'une équipe
  inscrite, coach invité (invitation `pending` à lui ou à une de ses équipes).

Toute lecture d'une compétition invisible répond **404** avec le message d'un
id inexistant. Cette résolution sert aussi, depuis ce change, TOUTES les
lectures d'une coupe par id (fiche, rondes, poules, play-offs, classements,
pronostics, rosters, feuille de match, documents) — une coupe privée n'est plus
lisible de n'importe quel compte connecté.

## API

Monté sur `/api/competitions/:kind/:competitionId/blog` (`kind` =
`leagues` | `cups`) derrière `requireFeatureFlag(competition_blog)`.

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/posts?page&limit&drafts=mine` | lecture (`optionalAuthUser`) |
| GET | `/posts/:postId` | lecture |
| POST | `/posts` | membre |
| PATCH / DELETE | `/posts/:postId` | auteur (DELETE : ou modérateur) |
| POST | `/posts/:postId/publish` · `/unpublish` | auteur |
| POST | `/posts/:postId/pin` · `/unpin` · `/hide` · `/unhide` | modérateur |
| PUT / DELETE | `/posts/:postId/reactions/:reaction` | membre |
| GET / POST | `/posts/:postId/comments` | lecture / membre |
| PATCH / DELETE | `/comments/:commentId` | auteur (DELETE : ou modérateur) |
| POST | `/comments/:commentId/hide` · `/unhide` | modérateur |
| POST | `/images` | membre (corps binaire brut, 3 Mo) |

Ordre des contrôles : visibilité (404) **avant** droit (403). Chaque réponse
sert les droits du lecteur (`viewer`) — l'écran ne les redéduit pas.

## Contenu

- HTML assaini à l'écriture (`utils/sanitize-competition-post-html`) : pas
  d'`iframe` / `style` / `class` / `on*`, liens `nofollow ugc`, `h1` → `h2`,
  images **uniquement** sous `/images/competition-blog/<kind>-<id>/` avec un
  nom généré. Le navigateur réassainit (`SafeHtml`, DOMPurify chargé à la
  demande).
- Images : patron des trois gardes (`utils/competition-blog-upload`), dossier
  par compétition, volume `competition_blog_images` en prod.
- Blocklist partagée (`services/text-blocklist`) : un titre, un article ou un
  commentaire qui y tombe est enregistré **masqué** (`blocklist:<motif>`).
- Limites : 10 publications / 24 h / auteur / compétition, 30 commentaires /
  10 min / auteur (comptés en base), 20 images / 24 h / auteur (mémoire).

## Notifications

`competition.blog.post_published` (membres hors auteur, une fois par article)
et `competition.blog.comment` (auteur de l'article, au plus une non lue par
article). Jamais bloquantes.

## Écran

`app/components/competition-blog/` (paramétrés par `{ kind, id }`), pages
`/leagues/[id]/blog…` et `/cups/[id]/blog…` (`noindex`), bloc « 📰 Blog » sur
les deux fiches, entrée d'aide `blog-de-competition`.
