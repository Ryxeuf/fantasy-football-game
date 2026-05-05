# Backlog — Idees futures (Pro League & engagement async)

> Derniere mise a jour : 2026-05-05
> Statut : **idees consignees**, non scopees.
> Ces items ont ete brainstormes lors de la conception du SPRINT Pro League
> ([sprints/SPRINT-pro-league.md](../sprints/SPRINT-pro-league.md)) puis
> exclus volontairement du MVP pour eviter la sur-ingenierie.
> **Aucune de ces idees ne doit etre attaquee** tant que les KPI MVP du
> SPRINT Pro League ne sont pas atteints (cf. section "Gate de reactivation"
> en bas).

## 0. Pourquoi ce backlog

Lors de la conception du SPRINT Pro League, plusieurs directions audacieuses
ont ete explorees (MPG-layer mercato, weather sync IRL, NFL Twin Mirror,
Twitch auto-cast, etc.). On les a ecartees du MVP par discipline produit :
**si le MVP ne trouve pas son audience, ces extensions n'ont pas de sens**.

Ce document garde la **memoire produit** : si demain on decide d'avancer, on
reprend la reflexion ici plutot que de tout re-explorer.

## Gate de reactivation

Les items de ce backlog ne sont **pas reactivables a la legere**. Pre-requis
generiques avant d'attaquer **n'importe quel item ci-dessous** :

| KPI MVP Pro League | Cible minimale |
|--------------------|----------------|
| Coachs uniques ayant place >=1 pari/semaine | >= 100 |
| Spectateurs simultanes pic mardi 21h | >= 200 |
| Retention J30 (utilisateurs revenant 30j apres 1er pari) | >= 35% |
| NPS beta + early users | >= 40 |
| Saison complete livree sans bug bloquant | 1 saison reussie minimum |

Si ces seuils sont atteints, on peut piocher dans le backlog par ordre de ROI
estime. Sinon, on itere sur le MVP avant tout.

---

## 1. MPG-layer (mercato + lineups + ligues privees) [ITEM PHARE]

**Concept** : couche fantasy par-dessus la Pro League. Les coachs creent des
**ligues privees entre amis** (6-10 membres), draftent via mercato hebdo des
**joueurs de la Pro League**, composent leur 11 chaque journee. Le score est
calcule a partir des perfs simulees des joueurs. Equivalent direct de MPG.

**Modeles Prisma envisages** :
```
FantasyLeague        # ligue privee d'amis
FantasyLeagueMember  # coach + budget mercato + roster
FantasyRoster        # joueurs detenus
FantasyLineup        # composition de la semaine N (titulaires, banc, capitaine)
FantasyTransfer      # encheres mercato hebdo (Vickrey)
PlayerWeekRating     # note 0-10 calculee depuis MatchEvents
```

**Pourquoi differe** :
- Triple la complexite produit/UI/regles.
- N'a de sens que si la Pro League fait deja vibrer une vraie audience.
- L'economie Crowns du MVP (gagnees en pariant) devient le **budget mercato
  initial** : crucial pour la peception "fair" mais necessite que le MVP
  fasse circuler suffisamment de Crowns avant.

**Gate specifique** : >= 100 utilisateurs avec >= 5000 Crowns au wallet
(donc actifs depuis >= 1 mois) + retention J30 >= 35%.

**Effort estime a la reactivation** : 6-8 semaines.

## 2. Multi-leagues (Old World League #2, Gridiron League foot US flavored)

**Concept** : ouvrir une 2e Pro League apres la S1 reussie.
- **Old World League #2** : nouveau roster d'equipes (16 hommages NFL non
  utilises au MVP : Texans, Broncos, Lions, Bengals, etc.).
- **Gridiron League** : alternative thematique pure foot US, equipes "Steel
  City Hammers", "Kansas Plains Flyers" sans melange races BB → un univers
  homogene foot US fantasy.

**Pourquoi differe** : multiplication de la sim engine load + complexite UI +
risque de diluer l'audience. Pertinent uniquement avec >= 500 utilisateurs
actifs sur OWL #1.

**Effort** : 2-3 sem (reutilise infra MVP) + 1 sem tuning par nouvelle ligue.

## 3. Cross-over PvP (prets joueurs, XP partagee)

**Concept** : un coach actif sur le mode PvP existant peut "preter" un star
player de son equipe Pro League favorite (suivi via SpectatorFollow) pour
booster ses matchs PvP. Ou inversement : un joueur qui performe dans son
equipe PvP gagne XP qui se traduit en bonus narratif Pro League.

**Pourquoi differe** :
- Risque de cassure de l'equilibre PvP existant.
- Mecanique meta complexe a expliquer.
- Pertinent uniquement si les deux modes ont chacun une vraie traction.

**Idee design** : pret limite a 1 match, bonus mineurs (+ aura, narrative
flair), pas de stat boost direct.

## 4. Weather Sync IRL

**Concept** : la meteo reelle de la ville d'une equipe influence le match.
Pittsburgh Smashers jouent sous la pluie si Pittsburgh PA est en alerte
meteo le jour du match.

**Pourquoi audacieux et viral** : aucun jeu ne fait ca. Differenciateur
poetique. Crea moments uniques impossibles a reproduire = partages.

**Pourquoi differe** :
- Necessite integration API meteo fiable (OpenWeather ~free, Tomorrow.io payant).
- Risque de paraitre gimmicky si mal dose.
- A tester en flag opt-in avant d'imposer.

**Effort** : 1 sem (API integration + regles weather mapping).

## 5. NFL Twin Mirror

**Concept** : le coach "lie" son equipe Pro League favorite a une franchise
NFL reelle. Si Mahomes se blesse, le QB elf de Kansas City Soaring Hawks est
"blesse" (MNG 1 match). Trade NFL = trade fantasy auto propose.

**Pourquoi audacieux** : hook fan NFL + double couverture mediatique.

**Pourquoi differe** :
- Necessite scraping/API NFL (sportsdata.io ~100 €/mois).
- Risque deséquilibre sim si trop deterministe par evt NFL.
- Encore plus sensible juridiquement (lien explicite NFL).

**Effort** : 2 sem.

## 6. Twitch Auto-Cast 24/7

**Concept** : chaine Twitch officielle qui stream **en continu** des replays
de matchs Pro League aleatoires, avec 2 commentateurs IA generes en temps
reel (un serieux, un drunk uncle complotiste). Highlights auto-clippes vers
TikTok/YouTube Shorts.

**Pourquoi audacieux** : machine a memes + viralite = PR gratuit a vie.

**Pourquoi differe** :
- Cout transcoding Twitch.
- Outil custom de rendering Pixi → video stream + TTS LLM = stack lourde.
- Modeling juridique du "stream automatique" (DMCA, Twitch policies).

**Effort** : 4 sem (lourd, infra-heavy).

## 7. Pep Talk push (notification 2 min avant kickoff)

**Concept** : push 2 min avant le match : "Tap pour parler a ton equipe". Le
coach (s'il a une equipe en Pro League en V2 mercato) tape 3 mots-cles ou
choisit un ton, l'IA genere un pep talk qui boost stats specifiques selon
l'emotion detectee.

**Pourquoi differe** : depend de la couche V2 mercato (item #1). Pas de sens
au MVP ou les equipes sont 100% IA.

**Effort** : 1 sem (post-V2 mercato).

## 8. Conferences de presse interactives

**Concept** : apres chaque match, journalistes IA posent 3 questions au
coach. Reponses (choix multiples ou texte libre) impactent moral equipe,
fans, rivaux. Gaffe = scandale = storyline Gazette.

**Pourquoi differe** : depend de la couche V2 mercato.

**Effort** : 2 sem.

## 9. Promotion / relegation pyramidale

**Concept** : 8+ divisions persistantes mondiales. Promotion enivrante,
relegation traumatique. Saison de 6-8 semaines reelles.

**Pourquoi differe** : necessite >= 5 ligues actives donc >= 80 equipes.
Aucun sens au MVP a 1 ligue de 16 equipes.

**Effort** : 3 sem (post-multi-leagues item #2).

## 10. Insurance Brokerage P2P

**Concept** : marche P2P d'assurances joueurs. Un coach vend une police "si
ton star meurt, je te file 500 Crowns" a un autre coach. Cree derives
financiers ludiques facon Lloyd's of London nain.

**Pourquoi audacieux** : profondeur meta-economique unique.

**Pourquoi differe** : necessite la couche V2 mercato (item #1) + masse
critique d'utilisateurs (>= 200) pour avoir un marche liquide.

**Effort** : 2 sem (post-V2).

## 11. Survivor Pick'em hebdo

**Concept** : chaque semaine, choisis 1 equipe gagnante de Pro League. Faux
= elimine. Dernier survivant = trophee saisonnier + skin legendaire. Une
seule equipe utilisable par saison.

**Pourquoi differe** : add-on pari complementaire, mais MVP a deja >= 6
markets par match. A reactiver si l'engagement paris est solide mais qu'on
veut une couche FOMO additionnelle.

**Effort** : 1 sem (reutilise wallet + bet infra MVP).

## 12. Loan Wager (pari de star player entre coachs)

**Concept** : avant un duel coach vs coach (en mode V2), chacun met en gage
un joueur de sa fantasy team. Le perdant le prete 3 matchs au gagnant.
Risque de blessure pendant le pret = perte seche.

**Pourquoi differe** : depend de V2 mercato.

**Effort** : 1 sem (post-V2).

## 13. Hall of Fame eternel inter-saisons

**Concept** : les joueurs qui prennent leur retraite avec une carriere
legendaire (>= 200 TD ou >= 50 kills) entrent au HoF ETERNEL visible par
TOUS les joueurs du monde a jamais. Statue dans la cathedrale virtuelle.
Descendants proceduraux portant son nom emergent dans les drafts d'autres
joueurs avec un buff "heritage".

**Pourquoi differe** : item HoF "light" deja inclus au MVP. Version
"eternelle" + descendants procedural = scope V2/V3.

**Effort** : 2 sem (post-V2).

## 14. Ligues thematiques limitees

**Concept** : tournois flash week-end : "Coupe des Maudits" (que des morts-
vivants), "Tournoi de Sang" (blessures permanentes activees), "Skaven Only
League". Recompenses cosmetiques exclusives.

**Pourquoi differe** : cosmetiques pas implementes au MVP. A tracer comme
extension post-monetisation cosmetique.

**Effort** : 1-2 sem.

## 15. Cartes joueurs collectibles (Sorare-style sans NFT)

**Concept** : chaque joueur de la Pro League a une carte avec rarete visuelle
(Common / Rare / Super Rare / Unique). Score auto base sur perf des matchs
auto. Possession emotionnelle d'un joueur. Galaxy brain.

**Pourquoi differe** : depend de V2 mercato. Risque de complexifier si
ajoute trop tot.

**Effort** : 3 sem (post-V2).

## 16. Permadeath Franchise (mode hardcore)

**Concept** : mode opt-in ou si tu te fais releguer 3 saisons de suite, ta
franchise est dissoute definitivement. Tu repars de zero, gardes 1 veteran
qui devient ton coach legendaire. Cimetiere des franchises mortes
consultable.

**Pourquoi differe** : necessite multi-ligues + relegation (item #9). Mode
streamer-friendly mais pas au MVP.

**Effort** : 1 sem (post-#9).

## 17. AR / scan figurine GW

**Concept** : pointe ton telephone vers une figurine BB GW (ou peinte par
un pote, ou un dessin) → IA scanne, genere un joueur unique dans ton roster
avec couleurs/nom/histoire/stats equilibrees. Edition limitee : scan en
magasin partenaire = joueur ultra-rare geolocalisé.

**Pourquoi audacieux** : pont collectionneurs / digitaux, partenariat
naturel GW.

**Pourquoi differe** : tech AR + ML lourde, partenariat GW complexe,
scope post-1.0.

**Effort** : 4-6 sem.

## 18. Multiverse / ligues parallel weird

**Concept** : ton equipe a 6 doppelgangers dans des ligues parallles aux
regles barrees : Underwater (sous l'eau, ralenti), Lovecraft (folie
progressive), Disco (danse-off pour resoudre tackles), Speedrun (1 min/
match), Inverse (perdre = gagner), Permadeath. Reliques cross-univers
buffant l'equipe principale.

**Pourquoi audacieux** : memes infinis, contenu UGC enorme.

**Pourquoi differe** : meme remarque que #16, scope post-1.0 et
necessite stack multi-ligues mature.

**Effort** : 6+ sem.

---

## Annexe — Reports hors Pro League

### A.1 Mobile parite ligues (ex L2.C.7)

**Concept** : portage de l'experience ligues sur l'app Expo
(`apps/mobile/app/leagues/`) — liste des ligues, detail saison, calendrier,
classement, bouton inscription, bouton "Lancer match" qui redirige vers le
flow match existant. Reutilise i18n module S27.3.

**Source** : reporte du `SPRINT-leagues-v2` (L2.C.7), categorie Mobile,
effort L. Initialement deja dans le backlog "restes optionnels" du TODO.md,
deplace ici le 2026-05-05 par decision produit (priorisation Pro League
avant extensions Ligues v2).

**Pourquoi differe** :
- Les fonctionnalites ligues web sont stables et testees ; l'usage mobile
  pour de la gestion de ligue async n'est pas un cas d'usage prioritaire
  (creation/inscription/lancement match restent confortables sur web).
- L'effort L (semaines) est mieux investi dans Pro League MVP qui apportera
  une boucle d'engagement plus differenciante.

**Pre-requis de reactivation** :
- Pro League MVP livre et stabilise.
- Demande utilisateur explicite (analytics : >= 30% des coachs ligues actifs
  ouvrent l'app mobile au moins 1x/semaine) OU itinerance reseau
  (deplacements) prouvee comme cas d'usage frequent en beta.

**Effort** : L (~1-2 sem).

---

## Synthese de la matrice "Quand reactiver quoi"

| Item | Pre-requis | Effort | Priorite si gate atteint |
|------|-----------|--------|--------------------------|
| **#1 MPG-layer** | 100 users actifs + 35% retention J30 | 6-8 sem | **P0** |
| #11 Survivor Pick'em | MVP paris stable | 1 sem | P1 (quick win) |
| #4 Weather Sync | MVP stable | 1 sem | P1 (differenciateur facile) |
| #2 Multi-leagues | 500 users actifs | 3 sem | P2 |
| #6 Twitch Auto-Cast | 1000 users actifs | 4 sem | P2 (impact PR) |
| #7 Pep Talk | Item #1 livre | 1 sem | P2 |
| #5 NFL Twin Mirror | Item #1 livre + budget API NFL | 2 sem | P2 |
| #15 Cartes collectibles | Item #1 livre | 3 sem | P2 |
| #10 Insurance Brokerage | Item #1 + 200 users | 2 sem | P3 |
| #3 Cross-over PvP | Item #1 + audit balance PvP | 3 sem | P3 |
| #8 Conferences presse | Item #1 livre | 2 sem | P3 |
| #12 Loan Wager | Item #1 livre | 1 sem | P3 |
| #9 Promotion/relegation | Item #2 livre (multi-leagues) | 3 sem | P3 |
| #13 HoF eternel + heritage | Item #1 livre | 2 sem | P3 |
| #16 Permadeath Franchise | Items #2, #9 livres | 1 sem | P4 |
| #14 Ligues thematiques | Cosmetiques implementes | 1-2 sem | P4 |
| #17 AR scan figurines | Partenariat GW + ML team | 4-6 sem | P4 |
| #18 Multiverse | Stack multi-ligues mature | 6+ sem | P4 |

---

## Process de reactivation

Si un KPI MVP atteint son seuil et qu'un item devient pertinent :
1. Ouvrir une issue GitHub "Reactivation backlog : <nom item>".
2. Re-evaluer le scope a froid (les hypotheses ont 6+ mois, peuvent etre
   obsoletes).
3. Confronter aux donnees terrain (analytics MVP) avant scoping.
4. Sortir un sprint dedie dans `docs/roadmap/sprints/` avec la rigueur du
   sprint pro-league (Phase 0 testing + Phase 1 livraison).
5. Mettre a jour ce document : marquer l'item "REACTIVE" avec lien sprint.

## Sources

- Audit produit + brainstorm conduit le 2026-05-05 par 5 agents en parallele
  (game design / paris / paysage concurrentiel / architecture technique /
  moonshots).
- Conversation produit transcrit dans le ticket de design Pro League.
- Inspirations : MPG (Mon Petit Gazon), Hattrick, FM, OOTP, Sorare, NFL
  Fantasy, FUMBBL, NAF.
