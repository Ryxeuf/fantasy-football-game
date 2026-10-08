# site-help

## ADDED Requirements

### Requirement: L'aide explique le mode de saisie d'une coupe

La page d'aide DOIT présenter, dans la catégorie des coupes, le mode de
saisie de la feuille de match : ce que demandent la saisie complète et la
saisie simplifiée, qui le choisit, qu'il se change à tout moment, et que le
mode simplifié ne fait rien perdre au classement ni aux tops. Le bandeau de
la feuille de coupe et le réglage du formulaire de coupe DOIVENT renvoyer à
cette section.

#### Scenario: Consultation de l'aide
- WHEN un visiteur ouvre la catégorie « Coupes » de la page d'aide
- THEN une section DOIT décrire les deux modes de saisie et ce que chacun demande

#### Scenario: Lien depuis la feuille
- WHEN un coach ouvre une feuille de match de coupe
- THEN le bandeau de la coupe DOIT indiquer le mode de saisie et proposer un lien vers la section d'aide

#### Scenario: Lien depuis le réglage
- WHEN un commissaire choisit le mode de saisie à la création ou à l'édition d'une coupe
- THEN le réglage DOIT proposer un lien vers la section d'aide
