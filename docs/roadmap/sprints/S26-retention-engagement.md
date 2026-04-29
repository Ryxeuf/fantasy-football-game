# Sprint 26 — Refactor + Retention & engagement

> Duree cible : ~6 jours
> Theme : transformer le trafic SEO/GEO en joueurs recurrents. Le sprint
> commence par un refactor prerequis pour ne pas builder les nouvelles
> features sur du code rendu illisible.
> Pre-requis : S25 (logs + perf en place pour mesurer l'impact retention).

## Taches

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| S26.0 | **PREREQUIS** Refactor `play/[id]/page.tsx` (1628l → ~600l) + retirer 15 `as any` | AMELIO | XL | [x] | `apps/web/app/play/[id]/page.tsx`. Extraire `InducementsPhaseUI`, `SetupPhaseUI`, `MatchEndUI`, `BlockChoiceFlow`, `ThrowTeamMateFlow` en modules. Creer types Move unions explicites (`hooks/types.ts`) pour eliminer les casts. Etalable sur 2-3j en debut de sprint, BLOQUE le reste sinon. **TERMINE en S26.0a-x : 1666 -> 573 lignes (-65.6%), 0 `as any`, types Move unions stricts (`LegalAction`, `ActivationAction`), 21 utils + 13 composants extraits.** |
| S26.1 | Tutoriel onboarding plus engageant (progression visuelle, badges unlock) | FIX | M | [x] | `apps/web/app/tutoriel/page.tsx`. N.1 livre mais UI basique : checkpoints lineaires sans recompense visible. Ajouter : barre de progression XP, badges debloques en temps reel, recommandation "essaie ces 3 equipes" a la fin. **TERMINE en S26.1a (badges+timestamp), S26.1b (panel teams recommandees), S26.1c (barre XP globale `/tutoriel`).** |
| S26.2 | Notifications temps-reel achievement unlock | AMELIO | M | [x] | 38 achievements existent (4 rosters Master + milestones match/win/td/cas + 2 social) mais aucune notification visible quand debloques. Ajouter : toast in-game, son optionnel, redirect vers `/me/achievements` au clic. **TERMINE en S26.2a (backend `newlyUnlocked`), S26.2b (banner + badge "Nouveau" sur `/me/achievements`), S26.2c (panel match-end "Voir mes succes" sur `MatchEndScreen` redirigeant vers `/me/achievements`). Son optionnel ecarte (peut etre ajoute en S27).** |
| S26.3 | Profil coach sharable `/coach/{slug}` + courbe ELO temporelle | AMELIO | M | [~] | `apps/web/app/me/profile/page.tsx` montre les stats mais pas en URL publique. Creer `/coach/{slug}` avec : header (pseudo, ELO actuel, badge supporter), graph ELO 90j, achievements vitrine, equipes recentes, export PDF roster. SEO bonus : indexable. **EN COURS : S26.3a (utilitaire `coachSlugFrom`), S26.3b (service `getCoachPublicProfile`), S26.3c (route Express publique `GET /coach/:slug`), S26.3d (page Next.js `/coach/[slug]` SSR/ISR avec header pseudo+ELO+supporter).** |
| S26.4 | Systeme d'amis : invitation par `@username` (pas userId) | AMELIO | M | [ ] | `apps/server/src/services/friendship.ts:14`. `sendFriendRequest(targetUserId)` actuel = userId interne, friction max. Ajouter resolveur `@username -> userId` + autocomplete UI. |
| S26.5 | Notification "ami demarre un match" + suggestions par ELO | AMELIO | S | [ ] | Hook leger sur `friendship.ts` + `connected-users.ts`. Push optionnel "Foo joue contre Bar maintenant" (decoupe par preference user). Suggestions amis par ELO ±100 dans `/friends/suggestions`. |
| S26.6 | Ligues thematiques saisonnieres + reset ELO | EVO | L | [ ] | `prisma/schema.prisma:671` (LeagueSeason) + `services/league.ts`. Infra L.8 saisonniere existe mais pas de themes ni rewards. Creer : "Skaven Cup" (mars), "Nordic Challenge" (avril), "Underworld Open" (mai). UI calendrier `/leagues/seasons`. Reward : badge profil "Champion {theme} {date}". |

## Definition of done

- [x] `play/[id]/page.tsx` < 600 lignes, 0 `as any`, types Move unions stricts
- [ ] Tutoriel : 80% des nouveaux comptes finissent au moins une lecon
- [x] 1 achievement debloque -> 1 toast visible + 1 ligne dans `/me/achievements`
- [ ] `/coach/foo` accessible publiquement + indexe sitemap
- [ ] Invitation ami par `@username` fonctionne sur 100% des comptes existants
- [ ] 1 ligue thematique active dans le calendrier au moment du release

## Risques

- **Refactor page.tsx (S26.0)** : risque de regression silencieuse sur
  les flows pre-match / setup / inducements. Couvrir avec tests E2E
  Playwright avant de couper, pas apres.
- **Profil public (S26.3)** : RGPD - permettre `private profile` opt-in
  pour ne pas exposer les coachs qui veulent rester discrets.
- **Ligues thematiques (S26.6)** : risque de creer des themes sans
  joueurs interesses. Lancer 1 theme test, mesurer participation, puis
  scaler.

## Sources

Findings agents : engagement#1-5 + #3 (ligues), frontend#2-3 (refactor).
