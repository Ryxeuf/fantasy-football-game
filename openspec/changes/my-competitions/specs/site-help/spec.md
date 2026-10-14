# site-help

## ADDED Requirements

### Requirement: L'aide présente « Mes compétitions »

La page d'aide DOIT présenter, dans la catégorie des compétitions, la page
« Mes compétitions » : ce qu'est une compétition « à moi » (créée, ou une de
mes équipes y est ou y a été inscrite), le filtre « Toutes / Les miennes »
des listes de ligues et de coupes, et la liste des « à faire » du joueur et
du commissaire. L'entrée DOIT renvoyer vers `/me/competitions`.

#### Scenario: Consultation de l'aide
- **WHEN** un visiteur ouvre la catégorie des compétitions de la page d'aide
- **THEN** une entrée DOIT décrire « Mes compétitions » et ses « à faire », avec un lien vers `/me/competitions`

#### Scenario: Exhaustivité
- **WHEN** la page `/me/competitions` est ajoutée au site
- **THEN** la vérification d'exhaustivité de l'aide DOIT la trouver référencée
