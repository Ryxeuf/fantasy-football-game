# Sorties : la règle rattrape les feuilles déjà validées — et Haine (X) se choisit

## Pourquoi

Deux retours de la même session de test.

**1. « L'appli compte 5 sorties alors que c'est 4 + 1 agression. »** Le change
`casualties-are-spp-eliminations` a pourtant posé la bonne définition
(`eliminationEarnsSpp`) : seule une Élimination qui rapporte des PSP est une
sortie. Mais il n'a corrigé que le CALCUL. Les compteurs des feuilles déjà
validées sont PERSISTÉS — `LeagueParticipant.casualtiesFor/Against` (colonnes
Sor+/Sor- du classement), points bonus « sorties infligées » du pairing,
`TeamPlayer.totalCasualties` et PSP. La feuille se relit avec la règle
courante et dit « 4 » ; le classement, lui, garde le « 5 » écrit à la
validation. Le rattrapage existe (`league-sheet-casualty-resync`) mais il n'est
branché que sur un script d'opérateur qui n'a jamais tourné : pour un coach,
l'anomalie n'a jamais été corrigée.

Deux compteurs restants ignoraient aussi la règle :

- « Sac de frappe » comptait une élimination SUBIE sur le seul type
  d'évènement, sans regarder la blessure — une agression ratée (aucune
  blessure consignée) classait quand même sa victime ;
- le libellé du « Meilleur castagneur » annonçait encore « sur blocage **et
  autres** », c'est-à-dire l'ancienne règle.

**2. Haine (X) — le mot-clé était imposé.** À la validation, le trait retenait
le PREMIER mot-clé éligible de l'adversaire (`pickHateKeyword`). Or un joueur
en porte souvent plusieurs : un Zombie est *Humain* ET *Morts-Vivants*. Haïr
« les Humains » ou « les Morts-Vivants » ne recouvre pas les mêmes adversaires
au reste de la saison — c'est un choix de coach, pas un défaut de catalogue.

## Quoi

- **Rattrapage automatique, sans opérateur.** `LeagueMatchSheet` porte un
  marqueur `casualtyRuleVersion` (nullable, donc lisible sans backfill — les
  migrations sont gitignorées ici). Une feuille validée sous la règle courante
  le porte ; les autres sont rattrapées à la PREMIÈRE lecture du classement de
  leur saison, par la resynchronisation existante (idempotente, journalisée),
  puis marquées. Après le passage, la lecture coûte une requête qui ne ramène
  rien.
- **« Sac de frappe » exige une blessure** (et connaît l'atterrissage sur un
  adversaire) ; le libellé du castagneur dit la règle en vigueur.
- **Haine (X) se choisit.** La feuille dérive, pour chaque candidat au jet, la
  liste des mots-clés éligibles de celui qui l'a blessé. Le coach (ou le
  commissaire) en retient un ; le choix est STOCKÉ (`hateChoices`), le
  candidat reste DÉRIVÉ. À la validation, le choix stocké l'emporte s'il est
  encore éligible, sinon on retombe sur le premier mot-clé — une feuille
  antérieure se valide donc exactement comme avant.

## Hors périmètre

- Rejouer les traits de Haine déjà accordés sous l'ancienne règle : le mot-clé
  retenu était légitime (le premier de la lignée), il n'y a rien de faux à
  réparer.
- Le « Sac de frappe » reste volontairement plus large que les sorties : un
  joueur sorti par une agression l'est bel et bien. Ce sont les sorties
  INFLIGÉES (bonus, Sor+/Sor-, castagneur) que la règle des PSP gouverne.
