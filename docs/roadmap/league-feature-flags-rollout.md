# Guide d'activation — Feature flags Ligue (rollout au compte-goutte)

> Strategie d'ouverture progressive de la brique "gestion des ligues"
> (audit 2026-06-06, cf.
> [`sessions/2026-06-06-league-management.md`](./sessions/2026-06-06-league-management.md)).
> Toute la surface est OFF par defaut ; on l'ouvre cohorte par cohorte.

## 1. Comment un flag est evalue

Source : `apps/server/src/services/featureFlags.ts`. Un flag est **actif
pour un utilisateur** si **l'une** de ces conditions est vraie :

1. `FEATURE_FLAGS_FORCE_ENABLED=true` (CI/tests uniquement — jamais en prod) ;
2. l'utilisateur a le role `admin` (bypass admin) ;
3. le flag est **globalement** active (`enabled = true`) ;
4. il existe un **override par-utilisateur** pour `(flag, userId)`.

> Le **compte-goutte** = condition (4) : on ajoute des overrides
> par-user sans jamais passer le flag en global. Quand la feature est
> eprouvee, on bascule en global (3).
>
> Les **kill-switches** (`maintenance_mode`,
> `registration_requires_validation`) sont l'exception : ils ne sont PAS
> force-ON par la CI ni le bypass admin. Aucun flag ligue n'est un
> kill-switch — ce sont tous des flags d'activation classiques.

## 2. Les 8 flags ligue

| Flag | Gate | Depend de |
|------|------|-----------|
| `league` | Hub `/leagues` + tous les ecrans de gestion (creation, edition, saisons, calendrier, classements, level-up, admin). **Porte d'entree.** | — |
| `league_invitations` | UI invitations coachs (recherche, lien partage, accept/decline). | `league` |
| `league_pools` | UI multi-poules (editeur de poules, standings/calendrier par poule). | `league` |
| `league_manual_pairings` | UI saisie manuelle de matchs (rounds custom, ajout/suppression/deplacement). | `league` |
| `league_bonus_points` | Editeur de points bonus dans la creation/edition de ligue. | `league` |
| `league_match_sheet` | Feuille de match v2 (saisie joueurs, evenements, validation, panneaux pre/post-match, invalidation). | `league` |
| `league_leaderboards` | Page classements top-N joueurs par saison. | `league` |
| `league_commissioner_edit` | Edition ex-post des equipes par le commissaire (SPP/comp/carac/treso, auditee). | `league` |

> **Important** : les sous-flags gatent l'**UI**. Les routes API sont
> protegees par l'authentification + les roles (commissaire = createur de
> la ligue, admin global). Activer un sous-flag pour un user lui rend la
> section visible ; il ne peut agir que sur ses propres ligues.

## 3. Outils d'activation (admin)

### Panneau admin
`/admin/feature-flags` (liste + toggle global + edition) et
`/admin/feature-flags/[id]` (overrides par-utilisateur).

### API (reservee admin — `authUser` + `adminOnly`)

| Methode | Route | Effet |
|---------|-------|-------|
| `POST` | `/admin/feature-flags/sync` | Cree en base tout flag du code absent (avec `enabled=false`). **A lancer une fois** apres deploiement pour materialiser les 8 flags. |
| `GET` | `/admin/feature-flags` | Liste les flags + compteur d'overrides. |
| `PATCH` | `/admin/feature-flags/:id` | Bascule `enabled` global (ou la description). |
| `GET` | `/admin/feature-flags/:id/users` | Liste les overrides par-user. |
| `POST` | `/admin/feature-flags/:id/users` | **Ajoute un override** (ouvre le flag a un user). |
| `DELETE` | `/admin/feature-flags/:id/users/:userId` | Retire l'override (referme pour ce user). |

> Apres tout changement, le cache flags se vide en <= 30 s
> (`CACHE_TTL_MS`), ou immediatement via `invalidateFeatureFlagsCache()`
> cote process.

## 4. Sequence de rollout recommandee

### Etape 0 — Materialiser les flags
Deployer puis `POST /admin/feature-flags/sync`. Verifier que les 8
flags `league*` apparaissent dans `/admin/feature-flags`, tous OFF.

### Etape 1 — Cohorte pilote sur le coeur
Choisir 1-3 comptes commissaires de confiance. Pour chacun, ajouter un
override sur :
1. `league` (sans lui, rien n'est visible) ;
2. `league_match_sheet` (le gros morceau a eprouver en premier) ;
3. `league_invitations` (pour qu'ils remplissent leurs ligues).

Faire jouer un cycle complet : creer une ligue → inviter → demarrer une
saison → saisir une feuille de match → valider → verifier le classement.

### Etape 2 — Elargir les fonctionnalites a la cohorte pilote
Quand le coeur est valide, ajouter pour les memes users :
`league_pools`, `league_bonus_points`, `league_manual_pairings`,
`league_leaderboards`, `league_commissioner_edit`.

### Etape 3 — Cohorte elargie
Repliquer les overrides `league` + `league_match_sheet` (+ invitations)
sur une cohorte plus large (10-50 commissaires). Surveiller les retours.

### Etape 4 — Bascule globale
Quand la confiance est la, passer `enabled=true` (global) flag par flag,
en commencant par `league` puis les sous-flags. Retirer les overrides
par-user devenus redondants (optionnel — sans effet de bord).

## 5. Rollback

- **Couper une feature pour tout le monde** : `PATCH` le flag a
  `enabled=false`. Les overrides par-user restent et redeviennent
  actifs ; pour une coupure totale, retirer aussi les overrides.
- **Couper pour un user** : `DELETE /admin/feature-flags/:id/users/:userId`.
- Les donnees deja creees (ligues, feuilles de match) ne sont pas
  supprimees par la coupure d'un flag — seule la **visibilite UI**
  change. Les effets deja appliques au classement persistent.

## 6. Pieges

- **CI** : `e2e.yml` exporte `FEATURE_FLAGS_FORCE_ENABLED=true` — tous
  les flags ligue sont donc ON pendant les E2E. Les nouveaux flags
  ligue etant des flags d'activation (pas des kill-switches), c'est le
  comportement voulu.
- **Admin = tout ON** : un compte admin voit toujours toutes les
  features (bypass). Pour tester l'experience d'un commissaire non-admin,
  utiliser un compte dedie sans le role admin.
- **Dependance implicite** : ouvrir un sous-flag sans `league` ne sert a
  rien (le hub reste masque). Toujours ouvrir `league` en premier.
