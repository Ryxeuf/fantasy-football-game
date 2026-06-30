# Guide d'activation — Feature flag Ligue

> Strategie d'ouverture de la brique "gestion des ligues". Toute la
> surface est OFF par defaut ; on l'ouvre cohorte par cohorte via un
> **flag unique** `league`.
>
> **Maj 2026-06-30** : les 7 anciens sous-flags de rollout granulaire
> (`league_invitations`, `league_pools`, `league_manual_pairings`,
> `league_bonus_points`, `league_match_sheet`, `league_leaderboards`,
> `league_commissioner_edit`) ont ete **supprimes** et fusionnes dans
> `league`. Toute la fonctionnalite ligue s'active/se desactive desormais
> d'un seul geste. (Audit initial : 2026-06-06, cf.
> [`sessions/2026-06-06-league-management.md`](./sessions/2026-06-06-league-management.md).)

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
> force-ON par la CI ni le bypass admin. `league` n'est PAS un
> kill-switch — c'est un flag d'activation classique.

## 2. Le flag ligue (unique)

| Flag | Gate |
|------|------|
| `league` | **Toute** la brique ligue : hub `/leagues`, creation/edition, saisons, invitations de coachs, multi-poules, calendrier (auto + saisie manuelle), points bonus, feuille de match v2 (saisie joueurs, evenements, validation, panneaux pre/post-match, invalidation), edition ex-post commissaire (SPP/comp/carac/treso, auditee), classements + leaderboards, level-up, section admin. |

> **Important** : le flag gate l'**UI**. Les routes API restent protegees
> par l'authentification + les roles (commissaire = createur de la ligue,
> admin global). Activer `league` pour un user lui rend la section
> visible ; il ne peut agir que sur ses propres ligues.

## 3. Outils d'activation (admin)

### Panneau admin
`/admin/feature-flags` (liste + toggle global + edition) et
`/admin/feature-flags/[id]` (overrides par-utilisateur).

### API (reservee admin — `authUser` + `adminOnly`)

| Methode | Route | Effet |
|---------|-------|-------|
| `POST` | `/admin/feature-flags/sync` | Cree en base tout flag du code absent (avec `enabled=false`). **A lancer une fois** apres deploiement. |
| `GET` | `/admin/feature-flags` | Liste les flags + compteur d'overrides. |
| `PATCH` | `/admin/feature-flags/:id` | Bascule `enabled` global (ou la description). |
| `GET` | `/admin/feature-flags/:id/users` | Liste les overrides par-user. |
| `POST` | `/admin/feature-flags/:id/users` | **Ajoute un override** (ouvre le flag a un user). |
| `DELETE` | `/admin/feature-flags/:id` | **Supprime un flag** (sert au menage des anciens sous-flags orphelins, cf. §6). |
| `DELETE` | `/admin/feature-flags/:id/users/:userId` | Retire l'override (referme pour ce user). |

> Apres tout changement, le cache flags se vide en <= 30 s
> (`CACHE_TTL_MS`), ou immediatement via `invalidateFeatureFlagsCache()`
> cote process.

## 4. Sequence de rollout recommandee

### Etape 0 — Materialiser le flag
Deployer puis `POST /admin/feature-flags/sync`. Verifier que `league`
apparait dans `/admin/feature-flags`, OFF.

### Etape 1 — Cohorte pilote
Choisir 1-3 comptes commissaires de confiance et ajouter un override
`league` a chacun. Faire jouer un cycle complet : creer une ligue →
inviter → demarrer une saison → saisir une feuille de match → valider →
verifier le classement + les leaderboards.

### Etape 2 — Cohorte elargie
Repliquer l'override `league` sur une cohorte plus large (10-50
commissaires). Surveiller les retours.

### Etape 3 — Bascule globale
Quand la confiance est la, passer `league` en `enabled=true` (global).
Retirer les overrides par-user devenus redondants (optionnel — sans
effet de bord).

## 5. Rollback

- **Couper pour tout le monde** : `PATCH` `league` a `enabled=false`. Les
  overrides par-user restent et redeviennent actifs ; pour une coupure
  totale, retirer aussi les overrides.
- **Couper pour un user** : `DELETE /admin/feature-flags/:id/users/:userId`.
- Les donnees deja creees (ligues, feuilles de match) ne sont pas
  supprimees par la coupure du flag — seule la **visibilite UI** change.
  Les effets deja appliques au classement persistent.

## 6. Menage des anciens sous-flags (apres 2026-06-30)

Les 7 sous-flags supprimes du code ne sont plus recrees par `sync`, mais
les lignes deja presentes en base (issues d'un `sync` anterieur)
subsistent comme **orphelins** : inoffensifs (plus rien ne les lit) mais
visibles dans `/admin/feature-flags`. Pour nettoyer, les supprimer une
fois via `DELETE /admin/feature-flags/:id` (ou le bouton du panneau) :
`league_invitations`, `league_pools`, `league_manual_pairings`,
`league_bonus_points`, `league_match_sheet`, `league_leaderboards`,
`league_commissioner_edit`.

## 7. Pieges

- **CI** : `e2e.yml` exporte `FEATURE_FLAGS_FORCE_ENABLED=true` — `league`
  est donc ON pendant les E2E. C'est un flag d'activation (pas un
  kill-switch), donc c'est le comportement voulu.
- **Admin = tout ON** : un compte admin voit toujours toutes les features
  (bypass). Pour tester l'experience d'un commissaire non-admin, utiliser
  un compte dedie sans le role admin.
