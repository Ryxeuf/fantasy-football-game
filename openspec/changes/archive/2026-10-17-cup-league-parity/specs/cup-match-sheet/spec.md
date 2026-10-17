# cup-match-sheet

## ADDED Requirements

### Requirement: L'état de la feuille se lit sur la carte de la rencontre

Une carte de ronde de coupe DOIT annoncer une feuille soumise par un seul
coach (« En attente validation (1/2) ») ou par les deux (« En attente
validation »), comme le calendrier d'une ligue. `GET /cup/:id/rounds` (et les
rondes de `GET /cup/:id`) DOIVENT servir le statut de la feuille de chaque
rencontre.

#### Scenario: Les deux coachs ont soumis
- WHEN les deux coachs d'une rencontre de coupe ont soumis leur feuille
- THEN la carte DOIT afficher « En attente validation »

### Requirement: Matchs à valider d'une coupe

Quand les deux coachs d'une rencontre de coupe ont soumis la feuille, la
notification du commissaire DOIT nommer les deux équipes et pointer
`/cups/:id/pending-validations`. Cette page DOIT lister les feuilles de la
coupe en attente (« Ronde N »), avec un retour vers la coupe et un lien vers
chaque feuille de coupe.

#### Scenario: Notification d'une coupe
- WHEN la seconde soumission d'une feuille de coupe est enregistrée
- THEN le commissaire DOIT recevoir « Match à valider : <domicile> vs <extérieur> » menant à `/cups/:id/pending-validations`
