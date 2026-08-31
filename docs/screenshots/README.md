# Captures d'écran — corrections FDM & ligue

Preuves visuelles des corrections livrées. Régénérables :

```bash
pnpm --filter @bb/tests-screenshots run capture
```

Le harnais vit dans [`tests/screenshots/`](../../tests/screenshots) : il rend
les **vrais composants** de `apps/web` avec la vraie feuille Tailwind, et
exécute les specs e2e-api pour en capturer la sortie **verbatim**.

| Point | Capture | Ce qu'elle montre |
|---|---|---|
| E37 | `e37-journaliers-choix-par-journalier.png` | Un sélecteur de poste PAR journalier (Orques : Trois-quart Orque / Gobelin). |
| A138 | `e41-sequence-apres-match.png` | Le journalier du match recruté à l'étape 4 (« Journalier du match »). |
| A156 | `a156-star-player-picker-evenement.png` | Le Star Player engagé proposé comme acteur d'évènement. |
| A157 | `a157-tags-etat-gerer-mon-equipe.png` | Les étiquettes Mort / Absent / N BP / Séquelles sur le roster. |
| E41 | `e41-sequence-apres-match.png` | Les 5 étapes numérotées, embauches AVANT renvois, erreurs coûteuses en dernier. |
| E45 | `e45-psp-reception-etourdissante.png` | Le réceptionneur crédité de 1 PSP sous la Prière n°11. |
| A158 | `a158-invalidation-playoff.png` | Le contrôle d'invalidation disponible sur un match de play-off. |
| E46/E47 | `e46-e47-catalogue-achats.png` | Les postes du roster avec leur quota (un poste complet grisé) et le prix rempli automatiquement — relance d'après-match au double du prix de construction. |
| A159 | `a159-ligue-retenue-seule.png` | Seule la Ligue régionale retenue par l'équipe est affichée. |
| A160 | `a160-trait-haine-en-francais.png` | Les variantes de Haine affichées en français, hors catalogue chargé. |
| E30 | `e30-psp-elimination-action-speciale.png` | Le rappel de règle sous le sélecteur : une Élimination sur Action Spéciale ne rapporte rien sans Innovateur Violent. |

Les deux corrections purement serveur n'ont pas de surface visuelle qui
prouve leur comportement : elles sont attestées par la sortie réelle des
tests, capturée à la génération.

| Point | Capture | Ce qu'elle prouve |
|---|---|---|
| A158 | `a158-preuve-tests-playoff.png` | Bracket qui avance jusqu'à la finale, invalidation d'une demi-finale, refus maintenu sur un match régulier. |
| E45 + A138/A156/A157 | `e45-preuve-tests-psp-reception.png` | Les 8 cas du parcours FDM, sur une base réelle. |
