# team-build-tournament-ruleset

## ADDED Requirements

### Requirement: Le règlement de tournoi prime sur les règles de coupe

Quand une équipe est construite pour une coupe qui impose un règlement de
tournoi, le builder DOIT appliquer le budget d'or et le pool de PSP du
RÈGLEMENT, et non ceux de la coupe — même précédence que le serveur, qui
écrase les budgets de coupe dans son bloc `if (pack)`. Le pool DOIT être
servi net de la taxe Star Players, sans jamais passer sous zéro.

Une coupe SANS règlement garde ses propres règles : override par roster,
puis budget du tier, puis budget natif du roster et pool nul.

#### Scenario: Coupe à règlement, sans budget par tier
- WHEN un coach ouvre `/me/teams/new?cupId=<coupe>` pour une coupe qui
  impose un règlement mais ne configure aucun budget par tier
- THEN le budget affiché DOIT être celui du règlement pour ce roster
- AND le pool de PSP DOIT être celui du règlement, donc non nul
- AND le coach DOIT pouvoir acheter des compétences avec ce pool

#### Scenario: Coupe à règlement ET budgets par tier
- WHEN la coupe configure aussi des budgets et pools par tier
- THEN le règlement DOIT l'emporter sur les deux

#### Scenario: Coupe sans règlement
- WHEN la coupe n'impose aucun règlement
- THEN le budget et le pool DOIVENT venir de la configuration de la coupe

### Requirement: Le règlement d'une coupe est posé dès le lien de construction

Le lien « Construire une équipe pour cette coupe » DOIT porter
`tournamentRuleset` en paramètre d'URL quand la coupe en impose un, pour que
budget et pool s'appliquent au premier rendu plutôt qu'après le chargement
de `GET /cup/:id`. L'info publique d'une invitation à une coupe DOIT exposer
le champ pour la même raison.

#### Scenario: Coupe sans règlement
- WHEN la coupe n'impose aucun règlement
- THEN le lien NE DOIT PAS porter le paramètre
