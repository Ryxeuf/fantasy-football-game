# Les Couronnes se gagnent en jouant

## Why

Hors Pro League (gelée), les Couronnes ont un puits — les thèmes de dés — et
aucune source : seul l'admin en crédite. La recette du flag `crowns` ne teste
donc que des Couronnes offertes, et aucun prix ne peut être calibré. Les
puits suivants (palettes d'équipe, épitaphe) n'ont de sens qu'une fois la
monnaie gagnée par le jeu. Décisions et alternatives écartées :
[`docs/roadmap/explorations/2026-10-06-boutique-couronnes.md`](../../../../docs/roadmap/explorations/2026-10-06-boutique-couronnes.md).

## What Changes

- **Une feuille de match validée rapporte des Couronnes** à chacun des deux
  coachs, en ligue comme en coupe. C'est la participation qui paie, pas la
  victoire : une invalidation ne reprend rien, une revalidation ne recrédite
  pas, un forfait (sans feuille) ne rapporte rien, et une feuille dont les
  deux côtés appartiennent au même compte ne rapporte rien.
- **Un succès débloqué rapporte des Couronnes**, une seule fois par succès.
- **Le bonus de bienvenue est réduit** (1000 → 250 proposé) et versé une fois
  par coach ; celui qui l'a déjà touché du temps de la Pro League ne le reçoit
  pas à nouveau.
- **Plafond par saison de ligue** (une coupe tient lieu de saison) sur les
  gains de feuilles : au-delà, la récompense est tronquée puis nulle, et
  consignée comme telle pour ne pas être retentée.
- **Rattrapage à la lecture du solde** : les récompenses dues sont créditées
  quand le coach consulte ses Couronnes, idempotentes, rétroactives (tout
  l'historique est crédité au premier passage) et sans jamais faire échouer
  la lecture. Rien n'est crédité tant que le flag `crowns` est fermé pour le
  coach.
- **Un registre des récompenses** (une ligne par récompense, clé de source
  unique) porte l'idempotence, le plafond et le détail affiché.
- **Le journal du coach explique ses gains** (« Récompenses : 3 feuilles de
  match, 1 succès ») et un texte « Comment gagner des Couronnes » accompagne
  le solde ; l'admin voit le registre d'un coach.
- **Dette trouvée en préparant le change** : quatre écrivains du solde
  (bonus de bienvenue, bonus quotidien, dédicace au Hall of Fame, entrée de
  tournoi Pro) écrivent encore « solde lu ± montant », contraire à l'exigence
  « écritures atomiques » de la capacité `crowns`. Ils passent à l'incrément
  / au décrément conditionnel.

Hors périmètre (suites) : conversion des points de pronostic et récompenses
de palmarès (champion, Oracle) à la clôture de saison, succès comptant les
feuilles de match (ceux de matchs ne comptent aujourd'hui que le jeu en
ligne), barème éditable en admin, notification de gain, Gazette, palettes.

## Capabilities

### New Capabilities

_Aucune._

### Modified Capabilities

- `crowns` : ajout des sources de Couronnes (feuille validée, succès, bonus
  de bienvenue), du plafond par saison, du rattrapage à la lecture, du
  journal explicatif des récompenses et de la vue admin du registre.

## Impact

- **Base** : nouvelle table de registre des récompenses (lisible sans
  backfill, `db push`), back-relation sur `User`. Aucune colonne existante
  modifiée.
- **Serveur** : nouveau module pur de règles (barème, clés, plafond) et
  service de rattrapage ; `GET /crowns/me` déclenche le rattrapage et sert le
  détail des récompenses ; nouvelle lecture admin du registre ; écrivains du
  wallet de `pro-wallet-rewards`, `pro-hall-of-fame-dedicate`,
  `pro-tournament-entry` rendus atomiques.
- **Web** : libellés du journal (`lib/crowns.ts`), carte Couronnes du profil
  et boutique (« Comment gagner »), écran admin des cosmétiques d'un coach.
- **Aucun flag nouveau** : tout passe derrière `crowns`, déjà en recette.
- **Économie** : à l'ouverture, chaque coach reçoit d'un coup l'historique de
  ses feuilles validées et de ses succès (plafonné par saison) plus le bonus
  de bienvenue — c'est le « cadeau de lancement » assumé.
