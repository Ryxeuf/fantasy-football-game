# Coupes : retrait d'une équipe par le commissaire, double validation des feuilles

## Why

Deux manques remontés par un commissaire de coupe :

1. **Le commissaire ne peut retirer AUCUNE équipe de sa coupe.**
   `POST /cup/:id/unregister` n'accepte que le propriétaire de l'équipe (ou un
   admin), et seulement tant que les inscriptions sont ouvertes. L'écran ne
   propose d'ailleurs que « Retirer mon équipe ». Une mauvaise inscription,
   un coach qui abandonne après la clôture des inscriptions ou en cours de
   coupe : le commissaire doit passer par un administrateur. La ligue, elle,
   a déjà sa suppression par le commissaire (`commissioner-team-removal`).
2. **Le commissaire peut valider une feuille qu'aucun coach n'a relue.** Le
   parcours prévoit la soumission des deux coachs, mais la validation du
   commissaire ne l'exige pas : une feuille en `draft` se valide. Certaines
   coupes veulent l'accord des deux coachs avant toute validation.

## What Changes

- **Retrait d'une équipe par le commissaire** (ou un admin) : possible à tout
  moment d'une coupe ni terminée ni archivée — inscriptions ouvertes, closes,
  ou coupe en cours —, depuis la liste des équipes inscrites. Le propriétaire
  garde son « Retirer mon équipe » tant que les inscriptions sont ouvertes.
- **Garde « rencontre ouverte »** : une équipe dont une rencontre de ronde est
  encore ouverte (planifiée ou en cours) ne se retire pas — le commissaire la
  règle d'abord (forfait sur la feuille ou annulation), parce que c'est LUI
  qui décide si l'adversaire gagne ou non la rencontre.
- **Résultats acquis** : le retrait supprime l'inscription, pas l'historique.
  Les matchs déjà joués restent au classement (ceux de l'adversaire aussi),
  l'équipe y est marquée « retirée », n'est plus appariée aux rondes
  suivantes et n'entre jamais dans le bracket.
- **Le coach est prévenu** par une notification interne quand c'est le
  commissaire qui retire son équipe.
- **Option « double validation des feuilles de match »** par coupe, décochée
  par défaut, choisie à la création et modifiable à tout moment : si elle est
  cochée, le commissaire ne peut valider une feuille qu'une fois soumise par
  ses DEUX coachs. Exception : sur un forfait déclaré, la soumission du coach
  forfaitaire n'est pas attendue (un coach absent bloquerait la ronde).
- **Feuille de match** : quand l'option est active, un bandeau l'annonce, le
  bouton du commissaire est désactivé tant qu'il manque une soumission (et
  dit laquelle), et un commissaire qui joue la rencontre peut soumettre SON
  côté (le bouton « Valider ma saisie » lui était masqué).

## Capabilities

### New Capabilities

- `cup-team-removal` : retrait d'une équipe d'une coupe (propriétaire,
  commissaire, admin), gardes et effets sur le classement, les rondes et le
  bracket.

### Modified Capabilities

- `cup-match-sheet` : option de double validation (réglage de coupe, garde de
  validation, exception forfait, affichage sur la feuille).

## Impact

- **Base** : `Cup.sheetDoubleValidation Boolean @default(false)` dans
  `prisma/schema.prisma` et le miroir `apps/server/prisma/sqlite/schema.prisma`.
  Le `@default` est ici correct : l'existant et le neuf ont le MÊME défaut
  (décoché), donc `db push` ne change le comportement d'aucune coupe.
- **Serveur** : `services/cup-team-removal` (décision pure + retrait),
  `routes/cup.ts` (`unregister` délégué au service, champ de double validation
  à la création, à l'édition et à la lecture, ligne de classement `withdrawn`),
  `services/cup-playoffs` (seeding limité aux inscrits),
  `services/in-app-notifications` (`cup.team_removed`),
  `services/sheet-double-validation` (pur), `services/competition-match-sheet-context`
  (`CompetitionSheetRules.doubleValidation`), `services/league-match-sheet`
  (garde de validation, code `coach_submissions_missing`), mapping HTTP 409.
- **Web** : page de coupe (bouton « Retirer » du commissaire, badge « retirée »
  au classement), champ partagé de création / édition de coupe, feuille de
  match (bandeau, bouton du commissaire, soumission du commissaire-coach).
- **Aucune** nouvelle route, aucun flag.
