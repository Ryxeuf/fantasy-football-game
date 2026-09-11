# Design — Désactiver la partie offline

## Pourquoi un flag plutôt qu'une suppression

La brique offline représente ~1 800 lignes de route, quatre écrans et un
modèle (`LocalMatch`) dont dépendent DEUX choses qui, elles, marchent : le
classement d'une coupe (dérivé des `LocalMatch` matérialisés par la
validation d'une feuille) et l'administration des parties déjà enregistrées
par des coachs.

La supprimer, c'est donc soit casser le classement de coupe, soit garder le
modèle sans le code qui l'écrit — et perdre l'historique des coachs qui ont
joué avec. **Décision** : un feature gate, `offline_match`, OFF par défaut.
Le code reste, la porte se ferme, et la décision se relit (et se révoque)
d'un toggle admin.

## Feature gate NORMAL, jamais kill-switch

`KILL_SWITCH_FLAGS` existe pour les flags dont « ON » BLOQUE (maintenance,
validation des inscriptions) : la CI ne doit pas les forcer. Celui-ci est
l'inverse — « ON » ouvre la brique. Le laisser hors de cette liste a un
effet concret et voulu : `FEATURE_FLAGS_FORCE_ENABLED=true` (e2e-api,
e2e-ui, intégration) continue d'ouvrir `/local-match`, donc les suites
existantes gardent leur valeur au lieu de virer au 403 en masse.

Piège associé, déjà connu du repo : `listEnabledKeysForUser` ne renvoie que
les clés PRÉSENTES EN BASE, même en force-enabled. Un flag absent de la
table est donc vu « OFF » par le client, force-enabled ou pas. D'où la clé
ajoutée au seed de `/__test/seed-rosters` (ON, pour les suites) ET au
`seed.ts` (OFF, pour la prod et le dev).

## Le bandeau : des CLÉS, pas du texte

`cupRoundsHeadingKeys` retourne des clés i18n (`titleKey`, `systemLabelKey`,
`descriptionKey`), pas des libellés résolus. Le module reste pur et testable
sans DOM ni provider de langue, et le composant n'a plus qu'à indexer
`t.cups`. Le test vérifie en prime que chaque système a bien un libellé ET
une description dans LES DEUX locales, et que deux systèmes ne partagent
jamais la même description — c'est exactement le bug d'origine.

Le petit texte sous les pastilles disparaît : il disait la même chose que la
description du bandeau, qui est désormais réactive. Une seule phrase à
l'écran, à un seul endroit (`roundSystem*Hint` → `roundSystem*Description`).

## Neutre plutôt que « dernier système utilisé »

Tentation : hors sélection, afficher le système de la DERNIÈRE ronde. Faux
dès qu'une coupe panache (tirage au sort en ronde 1, suisse ensuite,
bracket en play-offs) — le bandeau annoncerait un appariement pour des
rondes composées autrement. Le badge par ronde porte déjà cette information
au bon niveau ; le bandeau reste neutre.

## Ce que le gate NE ferme pas

`LocalMatch` reste écrit par le serveur hors du routeur `/local-match` : la
validation d'une feuille de coupe le matérialise (cf.
`docs/cup-match-sheet.md`). Fermer le routeur ne touche pas ce chemin — et
c'est la raison pour laquelle le gate est posé au MONTAGE de la route, pas
dans le service.
