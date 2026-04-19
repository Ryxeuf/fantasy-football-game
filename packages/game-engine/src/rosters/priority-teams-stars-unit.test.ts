import { describe, it, expect } from 'vitest';
import {
  PRIORITY_TEAM_ROSTERS,
  getStarPlayersHirableByPriorityTeams,
  type PriorityTeamRoster,
} from './priority-teams';
import type { StarPlayerDefinition } from './star-players';

/**
 * P2.10 — Tests unitaires sur les special rules des star players des 5 equipes
 * prioritaires (Skaven, Gnomes, Hommes-Lezards, Nains, Noblesse Imperiale).
 *
 * Ces tests completent P2.8/P2.9 avec des verifications par star player :
 *   - la specialRule contient la mecanique signature attendue (mot-cle BB3),
 *   - la coherence entre le ruleset season_2 et season_3,
 *   - la coherence entre la liste de skills et le texte de la regle,
 *   - la couverture minimale de chaque equipe en contenu de qualite.
 *
 * Tout ajout / refonte de contenu narratif d'un star player doit respecter les
 * motifs ci-dessous pour etre considere valide par la CI.
 */

type StarsByRoster = Record<PriorityTeamRoster, StarPlayerDefinition[]>;

function collectUniqueStars(
  map: StarsByRoster,
): Record<string, StarPlayerDefinition> {
  const seen: Record<string, StarPlayerDefinition> = {};
  for (const roster of PRIORITY_TEAM_ROSTERS) {
    for (const sp of map[roster]) {
      if (!(sp.slug in seen)) seen[sp.slug] = sp;
    }
  }
  return seen;
}

const season2Map = getStarPlayersHirableByPriorityTeams('season_2');
const season3Map = getStarPlayersHirableByPriorityTeams('season_3');
const season2Stars = collectUniqueStars(season2Map);
const season3Stars = collectUniqueStars(season3Map);

/**
 * Signature mecanique attendue par star player. Chaque entree est un tuple :
 *   [slug, regex_pattern, label_humain]
 *
 * Les motifs sont volontairement tolerants (insensibles a la casse, plusieurs
 * alternatives) pour ne pas figer un choix de traduction precis, mais ils
 * ancrent la mecanique BB3 de chaque star player a son texte narratif.
 */
const STAR_SIGNATURE_PATTERNS: Array<[string, RegExp, string]> = [
  ['akhorne_the_squirrel', /rage aveugle|relanc/i, 'Rage Aveugle / relance'],
  ['bilerot_vomitflesh', /vomi|projectile/i, 'Vomi Projectile'],
  ['the_black_gobbo', /sournois|arme secr/i, 'Le Plus Sournois / Arme Secrete'],
  ['bomber_dribblesnot', /kaboom|bombe/i, 'Kaboom! / bombe'],
  ['fungus_the_loon', /fou furieux|boulet|cha[iî]ne/i, 'Le Fou Furieux'],
  ['glart_smashrip', /charge|blitz/i, 'Charge Frenetique'],
  ['grashnak_blackhoof', /taureau|encorn/i, 'Taureau / Encorne'],
  ['grak', /crumbleberry/i, 'duo Grak & Crumbleberry'],
  ['crumbleberry', /grak/i, 'duo Grak & Crumbleberry'],
  ['guffle_pussmaw', /bouche|monstrueuse|ballon/i, 'Bouche Monstrueuse'],
  ['hakflem_skuttlespike', /tra[iî]tre|coup de poignard/i, 'Traitre / Poignard'],
  ['helmut_wulf', /vieux pro|arme secr/i, 'Vieux Pro / Arme Secrete'],
  ['kreek_rustgouger', /boulet|rouill/i, 'Boulet Rouille'],
  ['lord_borak', /seigneur|chaos/i, 'Seigneur du Chaos'],
  ['max_spleenripper', /tron[cç]onneuse|carnage/i, 'Tronconneuse / Carnage'],
  ['morg_n_thorg', /baliste/i, 'La Baliste'],
  ['nobbla_blackwart', /faute|frappez|terre/i, 'Frappez-les a Terre / Faute'],
  ['ripper_bolgrot', /caillou|rocher|lancer/i, 'Lancer de Caillou'],
  ['rodney_roachbait', /cafards?|attrape|r[eé]ception/i, 'Attrape-Cafards'],
  ['rowana_forestfoot', /bond|f[eé]erique|zone de tacle/i, 'Bond Feerique'],
  ['scrappa_sorehead', /chipe|voler|ballon/i, 'Chipe! / voler le ballon'],
  ['scyla_anfingrimm', /khorne|bronze|immunis/i, 'Collier de Bronze'],
  ['skitter_stab_stab', /assassin|coup de poignard/i, 'Assassin / Poignard'],
  ['varag_ghoul_chewer', /goule|m[aâ]cheur/i, 'Macheur de Goules'],
  ['withergrasp_doubledrool', /bave|paralys/i, 'Bave Paralysante'],
  ['anqi_panqi', /coup sauvage|blocage/i, 'Coup Sauvage'],
  ['boa_konssstriktr', /regard hypnotique/i, 'Regard Hypnotique'],
  ['estelle_la_veneaux', /venin|venimeus|griffe/i, 'Griffes Venimeuses'],
  ['glotl_stop', /sauvagerie|primal/i, 'Sauvagerie Primale'],
  ['grombrindal', /nain blanc|sagesse/i, 'Sagesse du Nain Blanc'],
  ['karla_von_kill', /indomptable|force/i, 'Indomptable'],
  ['mighty_zug', /casse-?os|zug/i, 'Casse-Os'],
  ['zolcath_the_zoat', /d[eé]voreur|sorts?|pri[eè]re/i, 'Devoreur de Sorts'],
  ['barik_farblast', /cannoneer|passe/i, 'Cannoneer'],
  ['cindy_piewhistle', /tarte|lanceuse/i, 'Lanceuse de Tartes'],
  ['deeproot_strongbranch', /fiable|co[eé]quipier/i, 'Fiable / coequipier'],
  ['frank_n_stein', /fracas|brutal/i, 'Fracas Brutal'],
  ['griff_oberwald', /professional|consummate/i, 'Consummate Professional'],
  ['grim_ironjaw', /grudgebearer|tueur|intr[eé]pide/i, 'Tueur Grudgebearer'],
  ['ivar_eriksson', /mur|bouclier|armure/i, 'Mur de Boucliers'],
  ['maple_highgrove', /grand ent|ent/i, 'Le Grand Ent'],
  ['puggy_baconbreath', /demi-portion|zone de tacle/i, 'Demi-Portion'],
  ['rumbelow_sheepskin', /b[eé]lier|blitz/i, 'Belier'],
  ['skorg_snowpelt', /y[eé]ti|rage/i, 'Rage du Yeti'],
  ['thorsson_stoutmead', /tonneau|t[eê]te d'os|bone head/i, 'Coup de Tonneau'],
];

describe('P2.10 — Tests unitaires sur les special rules des star players MVP', () => {
  describe('Signature mecanique par star player (season_2)', () => {
    it.each(STAR_SIGNATURE_PATTERNS)(
      '%s: specialRule reflete la mecanique signature (%s)',
      (slug, pattern) => {
        const sp = season2Stars[slug];
        expect(sp, `${slug} devrait etre hirable par une equipe prioritaire`).toBeDefined();
        expect(
          sp.specialRule,
          `${slug}: specialRule absente`,
        ).toBeTruthy();
        expect(
          sp.specialRule,
          `${slug}: la regle ne colle pas au motif ${pattern} — "${sp.specialRule}"`,
        ).toMatch(pattern);
      },
    );

    it('couvre au moins 40 star players distincts', () => {
      const slugs = new Set(STAR_SIGNATURE_PATTERNS.map(([slug]) => slug));
      expect(slugs.size).toBe(STAR_SIGNATURE_PATTERNS.length);
      expect(slugs.size).toBeGreaterThanOrEqual(40);
    });
  });

  describe('Coherence S2 / S3 (meme contenu narratif)', () => {
    it('chaque star MVP a la meme specialRule en season_2 et season_3', () => {
      for (const slug of Object.keys(season2Stars)) {
        const s2 = season2Stars[slug];
        const s3 = season3Stars[slug];
        if (!s3) continue;
        expect(
          s3.specialRule,
          `${slug}: divergence narrative S2/S3`,
        ).toBe(s2.specialRule);
        expect(
          s3.specialRuleEn,
          `${slug}: divergence EN S2/S3`,
        ).toBe(s2.specialRuleEn);
      }
    });

    it('chaque star MVP S3 expose aussi une specialRule non vide', () => {
      for (const sp of Object.values(season3Stars)) {
        expect(
          sp.specialRule,
          `${sp.slug}: specialRule vide en S3`,
        ).toBeTruthy();
        expect((sp.specialRule ?? '').length).toBeGreaterThanOrEqual(80);
      }
    });
  });

  describe('Coherence skills ↔ specialRule', () => {
    function rulesText(sp: StarPlayerDefinition): string {
      return `${sp.specialRule ?? ''} ${sp.specialRuleEn ?? ''}`.toLowerCase();
    }

    function skillList(sp: StarPlayerDefinition): string[] {
      return sp.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    it('tout star avec `throw-team-mate` mentionne un lancer / baliste / coequipier', () => {
      const pattern = /lancer|co[eé]quipier|coequipier|baliste|throw|team-mate|propuls/i;
      for (const sp of Object.values(season2Stars)) {
        if (!skillList(sp).includes('throw-team-mate')) continue;
        expect(
          rulesText(sp),
          `${sp.slug}: regle ne mentionne pas le lancer de coequipier`,
        ).toMatch(pattern);
      }
    });

    it('tout star avec `ball-and-chain` mentionne boulet / chaine / aleatoire', () => {
      const pattern = /boulet|cha[iî]ne|al[eé]atoire|fou|random/i;
      for (const sp of Object.values(season2Stars)) {
        if (!skillList(sp).includes('ball-and-chain')) continue;
        expect(
          rulesText(sp),
          `${sp.slug}: regle ne mentionne pas le boulet et chaine`,
        ).toMatch(pattern);
      }
    });

    it('tout star avec `chainsaw` mentionne la tronconneuse, le carnage ou l\'arme secrete', () => {
      const pattern = /tron[cç]onneuse|chainsaw|carnage|arme secr|secret weapon|faute/i;
      for (const sp of Object.values(season2Stars)) {
        if (!skillList(sp).includes('chainsaw')) continue;
        expect(
          rulesText(sp),
          `${sp.slug}: regle incoherente avec le skill chainsaw`,
        ).toMatch(pattern);
      }
    });

    it('tout star avec `right-stuff` et `stunty` (petit et mobile) mentionne une mecanique coherente', () => {
      // Ex. Crumbleberry (porte par Grak), Scrappa (vol de ballon), Bomber (bombes).
      // Le gimmick peut etre le lancer de coequipier, le pogo, le stunty ou une
      // mecanique ballon : le test verifie au moins un ancrage narratif.
      const pattern =
        /grak|lancer|saut|propuls|pogo|right stuff|titchy|stunty|zone de tacle|ballon|\bball\b|porteur|carrier/i;
      for (const sp of Object.values(season2Stars)) {
        const skills = skillList(sp);
        if (!skills.includes('right-stuff') || !skills.includes('stunty')) continue;
        expect(
          rulesText(sp),
          `${sp.slug}: regle n'ancre aucun gimmick right-stuff / stunty`,
        ).toMatch(pattern);
      }
    });

    it('tout star avec `hypnotic-gaze` mentionne le regard hypnotique ou un effet de controle', () => {
      const pattern = /hypnotique|regard|paralys|bave|gaze|control/i;
      for (const sp of Object.values(season2Stars)) {
        if (!skillList(sp).includes('hypnotic-gaze')) continue;
        expect(
          rulesText(sp),
          `${sp.slug}: regle ne mentionne pas le regard hypnotique`,
        ).toMatch(pattern);
      }
    });
  });

  describe('Couverture minimale par equipe prioritaire', () => {
    const qualityFloor = 80;

    it.each(PRIORITY_TEAM_ROSTERS)(
      '%s dispose d\'au moins 10 star players avec regles de qualite',
      (roster) => {
        const stars = season2Map[roster];
        const quality = stars.filter((sp) => {
          const rule = sp.specialRule ?? '';
          return (
            rule.length >= qualityFloor &&
            !/^Consultez le Livre de Règles/.test(rule)
          );
        });
        expect(
          quality.length,
          `${roster} n'expose que ${quality.length} regles de qualite`,
        ).toBeGreaterThanOrEqual(10);
      },
    );

    it('chaque equipe prioritaire expose au moins une star "signature" testee ci-dessus', () => {
      const signatureSlugs = new Set(STAR_SIGNATURE_PATTERNS.map(([slug]) => slug));
      for (const roster of PRIORITY_TEAM_ROSTERS) {
        const rosterSlugs = season2Map[roster].map((sp) => sp.slug);
        const covered = rosterSlugs.filter((slug) => signatureSlugs.has(slug));
        expect(
          covered.length,
          `${roster}: aucune star signature couverte par le test unitaire`,
        ).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Anti-regressions sur le contenu narratif', () => {
    it('aucune regle FR ni EN ne doit contenir un marqueur TODO / FIXME / XXX', () => {
      const forbidden = /\b(todo|fixme|xxx|tbd|lorem)\b/i;
      for (const sp of Object.values(season2Stars)) {
        expect(
          sp.specialRule ?? '',
          `${sp.slug}: specialRule FR contient un marqueur brouillon`,
        ).not.toMatch(forbidden);
        if (sp.specialRuleEn) {
          expect(
            sp.specialRuleEn,
            `${sp.slug}: specialRuleEn contient un marqueur brouillon`,
          ).not.toMatch(forbidden);
        }
      }
    });

    it('chaque specialRule EN partage au moins un mot-cle avec la version FR', () => {
      // Heuristique d'alignement : FR et EN doivent partager la mention d'un
      // mecanisme-cle ("match", "block", "blitz", "reroll"/"relance", etc.)
      // pour eviter qu'une refonte FR desynchronise la traduction.
      // Les motifs utilisent des frontieres de mot pour eviter les faux positifs
      // (ex. "passage" ne doit pas declencher "pass"e).
      const keywordPairs: Array<[RegExp, RegExp]> = [
        [/\bblitz\b/i, /\bblitz\b/i],
        [/\bblocage\b|\bbloc\b/i, /\bblock\b/i],
        [/\bpass(e|es|er)\b/i, /\bpass(es|ing)?\b/i],
        [/\barmure\b/i, /\barmou?r\b/i],
        [/\brelance(r|s)?\b|\brelanc\b/i, /\bre-?roll(s|ed)?\b/i],
        [/\bd6\b/i, /\bd6\b/i],
      ];
      for (const sp of Object.values(season2Stars)) {
        const fr = sp.specialRule;
        const en = sp.specialRuleEn;
        if (!fr || !en) continue;
        const overlaps = keywordPairs.some(
          ([frPat, enPat]) => frPat.test(fr) && enPat.test(en),
        );
        // Si au moins un mot-cle matche en FR, on exige qu'il matche en EN aussi.
        const frHitsAny = keywordPairs.some(([frPat]) => frPat.test(fr));
        if (frHitsAny) {
          expect(
            overlaps,
            `${sp.slug}: FR et EN ne partagent aucun mot-cle BB3 commun`,
          ).toBe(true);
        }
      }
    });
  });
});
