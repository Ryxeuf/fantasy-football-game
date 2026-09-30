# Design — thèmes de dés

## Où vit quoi

| Donnée | Lieu | Rôle |
|---|---|---|
| Ids + prix + défaut | `apps/server/src/services/dice-theme-catalogue.ts` (pur) | fait foi pour sélection et possession |
| Miroir ids + prix + libellés | `apps/web/app/components/dice/themes/catalogue.ts` | affichage, repli hors réseau |
| Rendu | `apps/web/app/components/dice/themes/<id>.tsx` + `registry.ts` | dessin SVG |
| Préférence | `User.diceTheme String?` | `null` = jamais choisi |

Cohérence verrouillée par `catalogue-consistency.test.ts` (web ↔ serveur ↔
registre), sur le modèle de `block-dice-faces-consistency`.

## Décisions

- **Préférence en base, pas en localStorage** : un thème acheté doit suivre
  le compte (appareils multiples) et la possession sera vérifiée serveur.
- **Colonne nullable, résolution à la lecture** : `db push` sans backfill.
  `effectiveDiceThemeId` replie sur le défaut un id absent, retiré du
  catalogue ou plus possédé — jamais d'erreur à la lecture. L'écriture, elle,
  refuse (`unknown-theme` 400, `theme-not-owned` 403).
- **Le thème ne fait que dessiner** : le libellé accessible est résolu par
  l'icône (noms officiels des faces), la préférence par le contexte. Un
  nouveau thème n'a donc que deux composants à écrire.
- **Hook no-op hors provider** (`useDiceTheme`) : les icônes rendent le
  défaut dans les tests et les pages sans `ClientLayout`.
- **Rendu défensif côté web** : un id servi mais inconnu du web (serveur
  déployé en avance) retombe sur le rendu par défaut ; `D6Icon` rend une
  valeur hors 1-6 en texte brut.
- **Aperçu forcé** : `theme` en prop des icônes, pour le sélecteur.
- **Ids de dégradé uniques** (`useId`) : plusieurs dés par page ne se volent
  plus leur `<defs>`.
- **Gate normal, pas kill-switch** : `FEATURE_FLAGS_FORCE_ENABLED` l'ouvre en
  CI ; la clé est seedée ON dans `/__test/seed-rosters`, OFF dans `seed.ts`.
