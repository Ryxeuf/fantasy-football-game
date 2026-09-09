# Tasks

## 1. Règlement de tournoi en coupe
- [x] 1.1 `apps/web/app/me/teams/new/build-budget.ts` (pur) : précédence règlement > coupe > rien. Tests.
- [x] 1.2 Builder : un seul effet de budget/pool ; l'effet « pack force édition/format/mode avancé » n'est plus coupé par `cupId` ; libellé du budget verrouillé cite le règlement.
- [x] 1.3 `apps/web/app/cups/build-for-cup-href.ts` (pur) + branchements page coupe et page d'invitation ; `tournamentRuleset` exposé par l'info publique d'une invitation.
- [x] 1.4 Test de régression `page.cup-tournament-ruleset.test.tsx` (vérifié rouge avant correctif : pool 0 au lieu de 60, budget 1000 au lieu de 1080).

## 2. Code couleur officiel des compétences
- [x] 2.1 `apps/web/app/lib/skill-category-colors.ts` : palette par catégorie ET par code d'accès, variantes douce et pleine. Tests de code couleur + de contraste.
- [x] 2.2 Branchements : liste `/skills` (badges + chips), `SkillAccessBadges`, `AdvancementEditor`, `SkillPickerSheet`.
- [x] 2.3 Test de rendu `SkillAccessBadges.test.tsx` (teinte par catégorie, rôle porté par la bordure).

## 3. Ligues archivées
- [x] 3.1 `listLeagues` : sans statut explicite, `where.status = { not: "archived" }`. Tests.
- [x] 3.2 `/leagues` : l'option « Archivée » quitte le filtre. Tests.
- [x] 3.3 E2E : la liste de base ne sert plus une ligue qu'on vient d'archiver.

## 4. Relance d'une journée
- [x] 4.1 `services/league-round-followup.ts` (pur) : sélection des rencontres, motifs, textes. Tests.
- [x] 4.2 `services/league-round-followup-notify.ts` : autorisation commissaire, trois canaux isolés, compte rendu. Tests.
- [x] 4.3 `POST /leagues/rounds/:roundId/remind` + mapping d'erreurs (403/404). Kind `league.round_followup` + icône web.
- [x] 4.4 `RoundFollowupButton` + `SeasonCalendar.isCommissioner`. Tests (compte rendu, vide, erreur, double-clic, gating).
- [x] 4.5 E2E `leagues-round-followup.spec.ts` : les deux cas, les refus, la rejouabilité.

## 5. Vérification
- [x] 5.1 `tsc --noEmit` serveur + web.
- [x] 5.2 Suites complètes serveur (6056) et web (2719).
- [x] 5.3 E2E API des specs touchées.

## Suites possibles (hors périmètre)
- Faire résoudre budget et pool de construction par le serveur et les servir au builder, pour n'avoir plus qu'une implémentation de la précédence (cf. `design.md` §1).
- Étendre le code couleur aux icônes de catégorie et à la version mobile Expo.
- Relance planifiée (rappel automatique J-2 / J+1) plutôt que déclenchée à la main.
- Bouton de relance par rencontre, pour ne réveiller qu'un binôme.
