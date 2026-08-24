---
"@bb/game-engine": patch
"@bb/server": patch
---

Le choix de Ligue régionale à la création suit les Ligues du roster.

Les Ligues d'un roster vivaient à deux endroits sans lien : la colonne éditable `Roster.regionalRules` (console admin, servie par la fiche publique `/teams/[slug]`) et la table canonique du moteur. Le sélecteur de Ligue à la création d'une équipe ne lisait que la seconde : dès qu'un admin éditait la colonne, les deux divergeaient. Cas signalé sur les Halflings — la fiche annonce « Coupe Dé à Coudre Halfling » + « Ligue Sylvestre », la création proposait en plus « Classique du Vieux Monde ».

- Source unique : `effectiveRegionalRules` (valeur en base, repli sur le catalogue du moteur quand la colonne est vide), extraite dans `services/roster-regional-rules`. `getRegionalLeagueOptions(roster, ruleset, declaredRules)` s'y limite ; `getRosterFromDb` l'expose dans `RosterPayload.regionalRules`.
- `GET /api/rosters` (liste + détail) : `regionalLeagueOptions` et `regionalLeagueChoiceRequired` bornés aux Ligues déclarées — le builder web, l'assistant onboarding et l'écran mobile en héritent sans changement client.
- `POST /team/build` et `POST /team/create-from-roster` : la validation serveur refuse (422) une Ligue absente de la déclaration du roster. `GET /api/star-players/regional-rules/:roster` sert les mêmes Ligues.
- Restent des règles portées par le moteur : les alignements conditionnés par la Ligue (Nordiques au Clash du Chaos ⇒ Favori de Khorne) et le Clash du Chaos des Nordiques, que la table ne sait pas exprimer.
- Les équipes déjà créées ne perdent rien : `resolveTeamRegionalRules` garde son repli historique, une édition admin ne retire pas rétroactivement des recrutements.
