/**
 * Jeux de données d'EXEMPLE des exports PDF : une ligue à deux poules et une
 * coupe à rondes + play-offs. Servent aux tests de rendu et à la génération
 * des PDF de démonstration — jamais importés par l'application.
 */

import {
  compressWeatherResults,
  kickoffTableRows,
  prayersTableRows,
} from "./reference";
import type {
  BracketDocument,
  CalendarDocument,
  LeaderboardsDocument,
  MatchSheetDocument,
  MatchdayDocument,
  PdfFixture,
  PdfColumn,
  PdfMeta,
  PdfRound,
  PdfSheetPlayer,
  PdfStandingsTable,
  PdfTeamRef,
  StandingsDocument,
  StatsDocument,
} from "./types";

export const EXAMPLE_DATE = new Date(2026, 8, 27, 14, 30);

export const LEAGUE_META: PdfMeta = {
  competitionName: "Ligue du Vieux Monde",
  competitionKind: "league",
  seasonName: "Saison 3 - 2026",
  generatedAt: EXAMPLE_DATE,
};

export const CUP_META: PdfMeta = {
  competitionName: "Coupe de Nuffle - Open de Bordeaux",
  competitionKind: "cup",
  seasonName: null,
  generatedAt: EXAMPLE_DATE,
};

const T = (name: string, rosterName: string, coach: string): PdfTeamRef => ({
  name,
  rosterName,
  coach,
});

export const TEAMS = {
  karak: T("Les Marteaux de Karak", "Nains", "Thorgrim"),
  reavers: T("Reikland Reavers", "Humains", "Mathias"),
  morr: T("Les Crocs de Morr", "Morts-Vivants", "Nécrarque"),
  scramblers: T("Skavenblight Scramblers", "Skavens", "Squik"),
  athelorn: T("Athelorn Avengers", "Elfes Sylvains", "Lirael"),
  rotters: T("Les Pourris de Nurgle", "Nurgle", "Pustule"),
  gouged: T("Gouged Eye", "Orques", "Grukk"),
  khemri: T("Les Momies de Khemri", "Rois des Tombes", "Settra"),
} as const;

const NORTH = [TEAMS.karak, TEAMS.reavers, TEAMS.morr, TEAMS.scramblers];
const SOUTH = [TEAMS.athelorn, TEAMS.rotters, TEAMS.gouged, TEAMS.khemri];

/** Berger à 4 : trois journées, deux rencontres par poule. */
const PAIRS: Array<Array<[number, number]>> = [
  [[0, 3], [1, 2]],
  [[0, 2], [3, 1]],
  [[0, 1], [2, 3]],
  [[3, 0], [2, 1]],
  [[2, 0], [1, 3]],
  [[1, 0], [3, 2]],
];

const SCORES: Array<[number, number]> = [
  [2, 1], [1, 1], [0, 2], [3, 1], [1, 0], [2, 2], [1, 2], [0, 0],
  [2, 0], [1, 3], [2, 1], [1, 1], [0, 1], [2, 0], [1, 1], [3, 2],
];

function roundFor(n: number, playedRounds: number): PdfRound {
  const idx = n - 1;
  const played = n <= playedRounds;
  const day = 6 + idx * 7;
  const dateLabel = `${String(((day - 1) % 30) + 1).padStart(2, "0")}/${day > 30 ? "10" : "09"}/2026`;
  const mk = (pool: PdfTeamRef[], offset: number): PdfFixture[] =>
    PAIRS[idx % PAIRS.length].map(([h, a], i) => {
      const score = SCORES[(idx * 4 + offset + i) % SCORES.length];
      return {
        home: pool[h],
        away: pool[a],
        statusLabel: played ? "Jouée" : n === playedRounds + 1 ? "À jouer" : "Programmée",
        score: played ? { home: score[0], away: score[1] } : null,
        scheduledLabel: played ? null : `${dateLabel} 20:30`,
      };
    });
  return {
    title: `Journée ${n}`,
    subtitle: `du ${dateLabel}`,
    statusLabel: played ? "Terminée" : n === playedRounds + 1 ? "En cours" : "À venir",
    groups: [
      { label: "Poule du Nord", fixtures: mk(NORTH, 0) },
      { label: "Poule du Sud", fixtures: mk(SOUTH, 2) },
    ],
  };
}

export const LEAGUE_ROUNDS: PdfRound[] = [1, 2, 3, 4, 5, 6].map((n) => roundFor(n, 4));

export const leagueMatchday: MatchdayDocument = {
  meta: LEAGUE_META,
  round: { ...LEAGUE_ROUNDS[4], title: "Journée 5 - Les Jardins de Morr" },
};

export const leagueCalendar: CalendarDocument = {
  meta: LEAGUE_META,
  rounds: LEAGUE_ROUNDS,
};


// ─── Classement ──────────────────────────────────────────────────────────────

export const LEAGUE_STANDING_COLUMNS: PdfColumn[] = [
  { label: "Pts", legend: "Points", emphasis: true },
  { label: "Bo", legend: "Points bonus" },
  { label: "MJ", legend: "Matchs joués" },
  { label: "V", legend: "Victoires" },
  { label: "N", legend: "Nuls" },
  { label: "D", legend: "Défaites" },
  { label: "For", legend: "Points retirés (forfaits)" },
  { label: "TD+", legend: "Touchdowns marqués" },
  { label: "TD-", legend: "Touchdowns encaissés" },
  { label: "Diff", legend: "Différence de TD" },
  { label: "Sor+", legend: "Sorties infligées" },
  { label: "Sor-", legend: "Sorties subies" },
  { label: "DSor", legend: "Différence de sorties" },
];

type Line = [number, number, number, number, number, number, number, number, number, number, number];
// pts bonus mj v n d for td+ td- sor+ sor-
function row(team: PdfTeamRef, l: Line) {
  const [pts, bo, mj, v, n, d, fo, tdf, tda, sf, sa] = l;
  const diff = tdf - tda;
  const dsor = sf - sa;
  return {
    team,
    cells: [pts, bo, mj, v, n, d, fo, tdf, tda, diff > 0 ? `+${diff}` : diff, sf, sa, dsor > 0 ? `+${dsor}` : dsor],
  };
}

const NORTH_TABLE: PdfStandingsTable = {
  title: "Poule du Nord",
  qualifies: 2,
  columns: LEAGUE_STANDING_COLUMNS,
  rows: [
    row(TEAMS.karak, [10, 2, 4, 3, 1, 0, 0, 7, 3, 14, 6]),
    row(TEAMS.scramblers, [7, 1, 4, 2, 1, 1, 0, 8, 6, 5, 9]),
    row(TEAMS.reavers, [4, 0, 4, 1, 1, 2, 0, 4, 6, 7, 8]),
    { ...row(TEAMS.morr, [1, 1, 4, 0, 1, 3, -1, 3, 7, 9, 12]) },
  ],
};

const SOUTH_TABLE: PdfStandingsTable = {
  title: "Poule du Sud",
  qualifies: 2,
  columns: LEAGUE_STANDING_COLUMNS,
  rows: [
    row(TEAMS.khemri, [9, 1, 4, 3, 0, 1, 0, 6, 3, 11, 4]),
    row(TEAMS.rotters, [7, 2, 4, 2, 1, 1, 0, 6, 5, 10, 7]),
    row(TEAMS.athelorn, [4, 0, 4, 1, 1, 2, 0, 5, 6, 2, 9]),
    row(TEAMS.gouged, [4, 1, 4, 1, 1, 2, 0, 4, 7, 12, 8]),
  ],
};

export const leagueStandings: StandingsDocument = {
  meta: LEAGUE_META,
  tables: [NORTH_TABLE, SOUTH_TABLE],
  scoringNote: "Victoire 3 - Nul 1 - Défaite 0 - Forfait -1",
  tieBreakNote: "Points > Points bonus > Forfaits > Différence de TD > Différence de sorties",
};

// ─── Tops ────────────────────────────────────────────────────────────────────

const P = (rank: number, name: string, detail: string, value: number) => ({ rank, name, detail, value });

export const leagueLeaderboards: LeaderboardsDocument = {
  meta: LEAGUE_META,
  sections: [
    {
      title: "Joueurs",
      categories: [
        { label: "Meilleurs marqueurs", description: "Touchdowns marqués", rows: [
          P(1, "Griff Oberwald", "Blitzeur - Reikland Reavers", 6),
          P(2, "Squeek Longqueue", "Coureur d'égout - Skavenblight Scramblers", 5),
          P(3, "Thalandor", "Danseur de guerre - Athelorn Avengers", 4),
          P(4, "Gorbad", "Blitzeur orque - Gouged Eye", 3),
          P(5, "Kalim le Sec", "Coureur squelette - Les Momies de Khemri", 3),
        ] },
        { label: "Cogneurs", description: "Sorties sur blocage", rows: [
          P(1, "Durin Brisecrâne", "Tueur de trolls - Les Marteaux de Karak", 7),
          P(2, "Morg", "Ogre - Gouged Eye", 5),
          P(3, "Gros Bubon", "Bête de Nurgle - Les Pourris de Nurgle", 4),
          P(4, "Settra II", "Gardien des tombes - Les Momies de Khemri", 4),
          P(5, "Rotfang", "Rat ogre - Skavenblight Scramblers", 3),
        ] },
        { label: "Tueurs", description: "Adversaires tués", rows: [
          P(1, "Durin Brisecrâne", "Tueur de trolls - Les Marteaux de Karak", 2),
          P(2, "Morg", "Ogre - Gouged Eye", 1),
          P(3, "Varag", "Momie - Les Crocs de Morr", 1),
        ] },
        { label: "Passeurs", description: "Passes réussies", rows: [
          P(1, "Mungo Spinecracker", "Lanceur - Reikland Reavers", 9),
          P(2, "Eldril", "Lanceur - Athelorn Avengers", 7),
          P(3, "Skritt", "Lanceur - Skavenblight Scramblers", 5),
          P(4, "Bofur", "Coureur - Les Marteaux de Karak", 2),
          P(5, "Hotep", "Coureur squelette - Les Momies de Khemri", 2),
        ] },
        { label: "Intercepteurs", description: "Interceptions", rows: [
          P(1, "Lirith", "Trois-quart - Athelorn Avengers", 2),
          P(2, "Gnarl", "Goule - Les Crocs de Morr", 1),
        ] },
        { label: "Agresseurs", description: "Agressions commises", rows: [
          P(1, "Snikch", "Trois-quart gobelin - Gouged Eye", 5),
          P(2, "Gristle", "Pourri - Les Pourris de Nurgle", 3),
          P(3, "Rattus", "Trois-quart - Skavenblight Scramblers", 2),
        ] },
        { label: "Futures stars", description: "PSP gagnés sur la saison", rows: [
          P(1, "Griff Oberwald", "Blitzeur - Reikland Reavers", 23),
          P(2, "Durin Brisecrâne", "Tueur de trolls - Les Marteaux de Karak", 20),
          P(3, "Squeek Longqueue", "Coureur d'égout - Skavenblight Scramblers", 17),
          P(4, "Mungo Spinecracker", "Lanceur - Reikland Reavers", 14),
          P(5, "Thalandor", "Danseur de guerre - Athelorn Avengers", 13),
        ] },
        { label: "Joueurs du Match", description: "Titres de JDM", rows: [
          P(1, "Griff Oberwald", "Blitzeur - Reikland Reavers", 2),
          P(2, "Durin Brisecrâne", "Tueur de trolls - Les Marteaux de Karak", 2),
          P(3, "Morg", "Ogre - Gouged Eye", 1),
        ] },
      ],
    },
    {
      title: "Équipes",
      categories: [
        { label: "Attaque", description: "Touchdowns marqués", rows: [
          P(1, "Skavenblight Scramblers", "Skavens - coach Squik", 8),
          P(2, "Les Marteaux de Karak", "Nains - coach Thorgrim", 7),
          P(3, "Les Momies de Khemri", "Rois des Tombes - coach Settra", 6),
          P(4, "Les Pourris de Nurgle", "Nurgle - coach Pustule", 6),
          P(5, "Athelorn Avengers", "Elfes Sylvains - coach Lirael", 5),
        ] },
        { label: "Défense", description: "Touchdowns encaissés (moins = mieux)", rows: [
          P(1, "Les Marteaux de Karak", "Nains - coach Thorgrim", 3),
          P(2, "Les Momies de Khemri", "Rois des Tombes - coach Settra", 3),
          P(3, "Les Pourris de Nurgle", "Nurgle - coach Pustule", 5),
          P(4, "Skavenblight Scramblers", "Skavens - coach Squik", 6),
          P(5, "Reikland Reavers", "Humains - coach Mathias", 6),
        ] },
        { label: "Cogneurs", description: "Sorties infligées", rows: [
          P(1, "Les Marteaux de Karak", "Nains - coach Thorgrim", 14),
          P(2, "Gouged Eye", "Orques - coach Grukk", 12),
          P(3, "Les Momies de Khemri", "Rois des Tombes - coach Settra", 11),
          P(4, "Les Pourris de Nurgle", "Nurgle - coach Pustule", 10),
          P(5, "Les Crocs de Morr", "Morts-Vivants - coach Nécrarque", 9),
        ] },
        { label: "Martyrs", description: "Sorties subies", rows: [
          P(1, "Les Crocs de Morr", "Morts-Vivants - coach Nécrarque", 12),
          P(2, "Skavenblight Scramblers", "Skavens - coach Squik", 9),
          P(3, "Athelorn Avengers", "Elfes Sylvains - coach Lirael", 9),
          P(4, "Reikland Reavers", "Humains - coach Mathias", 8),
          P(5, "Gouged Eye", "Orques - coach Grukk", 8),
        ] },
      ],
    },
  ],
};

// ─── Play-offs ───────────────────────────────────────────────────────────────

export const leagueBracket: BracketDocument = {
  meta: LEAGUE_META,
  note: "Bracket à 4 - deux qualifiés par poule",
  stages: [
    {
      label: "Demi-finales",
      fixtures: [
        { home: TEAMS.karak, away: TEAMS.rotters, statusLabel: "Jouée", score: { home: 2, away: 1 } },
        { home: TEAMS.khemri, away: TEAMS.scramblers, statusLabel: "À jouer", scheduledLabel: "Prévue le 08/11/2026 20:30" },
      ],
    },
    {
      label: "Finale",
      fixtures: [
        { home: TEAMS.karak, away: TEAMS.karak, placeholder: true, statusLabel: "En attente" },
      ],
    },
  ],
  champion: null,
};

// ─── Statistiques ────────────────────────────────────────────────────────────

const TEAM_STAT_COLUMNS: PdfColumn[] = [
  { label: "MJ", legend: "Matchs joués" },
  { label: "TD+", legend: "Touchdowns marqués", emphasis: true },
  { label: "TD-", legend: "Touchdowns encaissés" },
  { label: "Sor+", legend: "Sorties infligées", emphasis: true },
  { label: "Sor-", legend: "Sorties subies" },
  { label: "Pas", legend: "Passes réussies" },
  { label: "Int", legend: "Interceptions" },
  { label: "Agr", legend: "Agressions" },
  { label: "SP", legend: "Sorties par le public" },
  { label: "Exclu", legend: "Expulsions subies" },
];

const statRow = (team: PdfTeamRef, cells: number[]) => ({ team, cells });

export const leagueStats: StatsDocument = {
  meta: LEAGUE_META,
  keyFigures: [
    { label: "Rencontres jouées", value: 16 },
    { label: "Touchdowns", value: 47 },
    { label: "TD par match", value: "2,9" },
    { label: "Sorties", value: 70 },
    { label: "Morts", value: 4 },
    { label: "Passes réussies", value: 31 },
  ],
  awards: [
    { label: "Plus de victoires", description: "Équipes les plus titrées", winners: "Les Marteaux de Karak, Les Momies de Khemri", value: 3 },
    { label: "Top Scorer", description: "Plus de touchdowns marqués", winners: "Skavenblight Scramblers", value: 8 },
    { label: "Meilleure défense", description: "Moins de touchdowns encaissés", winners: "Les Marteaux de Karak, Les Momies de Khemri", value: 3 },
    { label: "Basher", description: "Plus de sorties infligées", winners: "Les Marteaux de Karak", value: 14 },
    { label: "Les Martyrs", description: "Plus de sorties subies", winners: "Les Crocs de Morr", value: 12 },
    { label: "Indestructibles", description: "Moins de sorties subies", winners: "Les Momies de Khemri", value: 4 },
    { label: "Oracle", description: "Meilleur pronostiqueur (coachs)", winners: "Thorgrim", value: "27 pts" },
  ],
  teamTable: {
    title: null,
    qualifies: 0,
    columns: TEAM_STAT_COLUMNS,
    rows: [
      statRow(TEAMS.karak, [4, 7, 3, 14, 6, 2, 0, 3, 1, 0]),
      statRow(TEAMS.scramblers, [4, 8, 6, 5, 9, 6, 0, 2, 0, 1]),
      statRow(TEAMS.khemri, [4, 6, 3, 11, 4, 2, 0, 0, 2, 0]),
      statRow(TEAMS.rotters, [4, 6, 5, 10, 7, 1, 0, 4, 1, 1]),
      statRow(TEAMS.athelorn, [4, 5, 6, 2, 9, 9, 2, 0, 0, 0]),
      statRow(TEAMS.reavers, [4, 4, 6, 7, 8, 9, 0, 1, 1, 0]),
      statRow(TEAMS.gouged, [4, 4, 7, 12, 8, 1, 0, 6, 2, 2]),
      statRow(TEAMS.morr, [4, 3, 7, 9, 12, 1, 1, 1, 0, 0]),
    ],
  },
};

// ─── Feuille de rencontre ────────────────────────────────────────────────────

const S = (ma: number, st: number, ag: number, pa: number | null, av: number) => ({ ma, st, ag, pa, av });

const DWARF_PLAYERS: PdfSheetPlayer[] = [
  { number: 1, name: "Bofur Barbe-de-Fer", position: "Coureur", stats: S(6, 3, 3, 4, 9), skills: "Crâne épais, Sûr de soi, Esquive", spp: 9 },
  { number: 2, name: "Balin", position: "Coureur", stats: S(6, 3, 3, 4, 9), skills: "Crâne épais, Sûr de soi", spp: 3 },
  { number: 3, name: "Durin Brisecrâne", position: "Tueur de trolls", stats: S(5, 3, 4, null, 9), skills: "Blocage, Crâne épais, Frénésie, Intrépide, Châtaigne, Garde", spp: 20 },
  { number: 4, name: "Gimrik", position: "Tueur de trolls", stats: S(5, 3, 4, null, 9), skills: "Blocage, Crâne épais, Frénésie, Intrépide", spp: 4 },
  { number: 5, name: "Thrain", position: "Bloqueur", stats: S(4, 3, 4, 5, 10), skills: "Blocage, Crâne épais, Défenseur", spp: 7 },
  { number: 6, name: "Kili", position: "Bloqueur", stats: S(4, 3, 4, 5, 10), skills: "Blocage, Crâne épais, Défenseur", spp: 2 },
  { number: 7, name: "Fili", position: "Bloqueur", stats: S(4, 3, 4, 5, 10), skills: "Blocage, Crâne épais, Défenseur", spp: 1 },
  { number: 8, name: "Oin", position: "Bloqueur", stats: S(4, 3, 4, 5, 10), skills: "Blocage, Crâne épais, Défenseur", spp: 0, unavailable: true, note: "Absent : Amoché" },
  { number: 9, name: "Gloin", position: "Bloqueur", stats: S(4, 3, 4, 5, 10), skills: "Blocage, Crâne épais, Défenseur", spp: 0 },
  { number: 10, name: "Dwalin", position: "Démolisseur", stats: S(4, 3, 4, 4, 10), skills: "Blocage, Crâne épais, Chef, Garde", spp: 6 },
  { number: 11, name: "Nori", position: "Démolisseur", stats: S(4, 3, 4, 4, 10), skills: "Blocage, Crâne épais, Garde", spp: 2 },
  { number: 12, name: "Grungni", position: "Rouleau compresseur", stats: S(4, 7, 5, null, 11), skills: "Solitaire (4+), Écrasement, Châtaigne, Arme secrète, Stabilité, Sans les mains, Infatigable", spp: 3 },
];

const UNDEAD_PLAYERS: PdfSheetPlayer[] = [
  { number: 1, name: "Varag", position: "Momie", stats: S(3, 5, 5, null, 10), skills: "Châtaigne, Régénération, Garde", spp: 11 },
  { number: 2, name: "Ramsès", position: "Momie", stats: S(3, 5, 5, null, 10), skills: "Châtaigne, Régénération", spp: 4 },
  { number: 3, name: "Gnarl", position: "Goule", stats: S(7, 3, 3, 4, 8), skills: "Esquive, Régénération, Glissade contrôlée", spp: 8 },
  { number: 4, name: "Rictus", position: "Goule", stats: S(7, 3, 3, 4, 8), skills: "Esquive, Régénération", spp: 2 },
  { number: 5, name: "Vlad", position: "Revenant", stats: S(6, 3, 3, 5, 9), skills: "Blocage, Régénération", spp: 6 },
  { number: 6, name: "Mortis", position: "Revenant", stats: S(6, 3, 3, 5, 9), skills: "Blocage, Régénération, Tacle", spp: 9 },
  { number: 7, name: "Os-Sec", position: "Squelette", stats: S(5, 3, 4, 6, 8), skills: "Régénération, Crâne épais", spp: 0 },
  { number: 8, name: "Tibia", position: "Squelette", stats: S(5, 3, 4, 6, 8), skills: "Régénération, Crâne épais", spp: 1 },
  { number: 9, name: "Femur", position: "Squelette", stats: S(5, 3, 4, 6, 8), skills: "Régénération, Crâne épais", spp: 0 },
  { number: 10, name: "Pourri", position: "Zombie", stats: S(4, 3, 5, null, 9), skills: "Régénération", spp: 0 },
  { number: 11, name: "Moisi", position: "Zombie", stats: S(4, 3, 5, null, 9), skills: "Régénération", spp: 0 },
  { number: 12, name: "Grinçant", position: "Zombie", stats: S(4, 3, 5, null, 9), skills: "Régénération", spp: 1 },
  { number: 14, name: "Macabre", position: "Squelette", stats: S(5, 3, 4, 6, 8), skills: "Régénération, Crâne épais", spp: 2, unavailable: true, note: "Absent : Amoché" },
];

const CLASSIC_WEATHER = compressWeatherResults([
  { roll: 2, condition: "Chaleur écrasante" },
  { roll: 3, condition: "Très ensoleillé" },
  ...[4, 5, 6, 7, 8, 9, 10].map((roll) => ({ roll, condition: "Conditions parfaites" })),
  { roll: 11, condition: "Pluie battante" },
  { roll: 12, condition: "Blizzard" },
]);

export const leagueMatchSheet: MatchSheetDocument = {
  meta: LEAGUE_META,
  roundLabel: "Journée 5 - Poule du Nord",
  scheduledLabel: "04/10/2026 20:30",
  home: {
    team: TEAMS.karak,
    teamValue: 1_150_000,
    currentValue: 1_090_000,
    treasury: 85_000,
    dedicatedFans: 3,
    staff: { rerolls: 3, cheerleaders: 1, assistants: 1, apothecary: true },
    players: DWARF_PLAYERS,
  },
  away: {
    team: TEAMS.morr,
    teamValue: 1_020_000,
    currentValue: 1_000_000,
    treasury: 40_000,
    dedicatedFans: 2,
    staff: { rerolls: 2, cheerleaders: 0, assistants: 2, apothecary: false },
    players: UNDEAD_PLAYERS,
  },
  rules: { spp: true, economy: true, advancements: true, purchases: true, firings: true },
  kickoffTable: kickoffTableRows(),
  weatherTable: { name: "Classique", results: CLASSIC_WEATHER },
  prayersTable: prayersTableRows(),
  prefill: {
    inducementsAway: [
      { name: "Pot-de-vin", qty: 1, cost: 100_000 },
      { name: "Prière à Nuffle", qty: 1, cost: 10_000 },
    ],
  },
};

// ─── COUPE ───────────────────────────────────────────────────────────────────

const CUP_TEAMS: PdfTeamRef[] = [
  TEAMS.karak, TEAMS.reavers, TEAMS.morr, TEAMS.scramblers,
  TEAMS.athelorn, TEAMS.rotters, TEAMS.gouged, TEAMS.khemri,
];

export const cupRounds: PdfRound[] = [
  {
    title: "Ronde 1",
    subtitle: "Tirage au sort - 13/09/2026",
    statusLabel: "Terminée",
    groups: [{
      label: null,
      fixtures: [
        { home: TEAMS.karak, away: TEAMS.gouged, statusLabel: "Jouée", score: { home: 1, away: 0 } },
        { home: TEAMS.reavers, away: TEAMS.athelorn, statusLabel: "Jouée", score: { home: 2, away: 2 } },
        { home: TEAMS.morr, away: TEAMS.khemri, statusLabel: "Jouée", score: { home: 0, away: 1 } },
        { home: TEAMS.scramblers, away: TEAMS.rotters, statusLabel: "Jouée", score: { home: 3, away: 1 } },
      ],
    }],
  },
  {
    title: "Ronde 2",
    subtitle: "Système suisse - 20/09/2026",
    statusLabel: "Terminée",
    groups: [{
      label: null,
      fixtures: [
        { home: TEAMS.karak, away: TEAMS.scramblers, statusLabel: "Jouée", score: { home: 2, away: 1 } },
        { home: TEAMS.khemri, away: TEAMS.reavers, statusLabel: "Jouée", score: { home: 1, away: 1 } },
        { home: TEAMS.athelorn, away: TEAMS.rotters, statusLabel: "Jouée", score: { home: 2, away: 0 } },
        { home: TEAMS.gouged, away: TEAMS.morr, statusLabel: "Jouée", score: { home: 2, away: 1 } },
      ],
    }],
  },
  {
    title: "Ronde 3",
    subtitle: "Système suisse - 27/09/2026",
    statusLabel: "En cours",
    groups: [{
      label: null,
      fixtures: [
        { home: TEAMS.karak, away: TEAMS.khemri, statusLabel: "À jouer", scheduledLabel: "27/09/2026 14:00" },
        { home: TEAMS.athelorn, away: TEAMS.scramblers, statusLabel: "À jouer", scheduledLabel: "27/09/2026 14:00" },
        { home: TEAMS.reavers, away: TEAMS.gouged, statusLabel: "À jouer", scheduledLabel: "27/09/2026 14:00" },
        { home: TEAMS.rotters, away: TEAMS.morr, statusLabel: "À jouer", scheduledLabel: "27/09/2026 14:00" },
      ],
    }],
  },
];

export const cupMatchday: MatchdayDocument = { meta: CUP_META, round: cupRounds[2] };
export const cupCalendar: CalendarDocument = { meta: CUP_META, rounds: cupRounds };

export const CUP_STANDING_COLUMNS: PdfColumn[] = [
  { label: "Pts", legend: "Points (résultat + actions)", emphasis: true },
  { label: "MJ", legend: "Matchs joués" },
  { label: "V", legend: "Victoires" },
  { label: "N", legend: "Nuls" },
  { label: "D", legend: "Défaites" },
  { label: "TD+", legend: "Touchdowns marqués" },
  { label: "TD-", legend: "Touchdowns encaissés" },
  { label: "Diff", legend: "Différence de TD" },
  { label: "Pas", legend: "Passes réussies" },
  { label: "Sor", legend: "Sorties sur blocage" },
  { label: "Agr", legend: "Sorties sur agression" },
];

const cupRow = (team: PdfTeamRef, c: number[]) => ({
  team,
  cells: [c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[5] - c[6] > 0 ? `+${c[5] - c[6]}` : c[5] - c[6], c[7], c[8], c[9]],
});

export const cupStandings: StandingsDocument = {
  meta: CUP_META,
  tables: [{
    title: null,
    qualifies: 4,
    columns: CUP_STANDING_COLUMNS,
    rows: [
      cupRow(TEAMS.karak, [2040, 2, 2, 0, 0, 3, 1, 1, 4, 0]),
      cupRow(TEAMS.athelorn, [1545, 2, 1, 1, 0, 4, 2, 3, 0, 0]),
      cupRow(TEAMS.khemri, [1530, 2, 1, 1, 0, 2, 1, 0, 3, 0]),
      cupRow(TEAMS.gouged, [1025, 2, 1, 0, 1, 2, 2, 0, 3, 1]),
      cupRow(TEAMS.scramblers, [1030, 2, 1, 0, 1, 4, 3, 2, 1, 0]),
      cupRow(TEAMS.reavers, [530, 2, 0, 2, 0, 3, 3, 2, 1, 0]),
      cupRow(TEAMS.rotters, [15, 2, 0, 0, 2, 1, 5, 0, 2, 1]),
      cupRow(TEAMS.morr, [10, 2, 0, 0, 2, 1, 3, 0, 2, 0]),
    ],
  }],
  scoringNote: "Victoire 1000 - Nul 500 - Défaite 0 - TD 5 - Sortie 5 - Passe 5",
  tieBreakNote: "Points > Différence de TD > TD marqués > Sorties",
};

export const cupLeaderboards: LeaderboardsDocument = {
  meta: CUP_META,
  sections: [
    {
      title: "Joueurs",
      categories: [
        { label: "Meilleurs marqueurs", description: "Touchdowns marqués", rows: [
          P(1, "Squeek Longqueue", "Skavenblight Scramblers", 3),
          P(2, "Thalandor", "Athelorn Avengers", 2),
          P(3, "Bofur Barbe-de-Fer", "Les Marteaux de Karak", 2),
        ] },
        { label: "Cogneurs", description: "Sorties sur blocage", rows: [
          P(1, "Durin Brisecrâne", "Les Marteaux de Karak", 3),
          P(2, "Morg", "Gouged Eye", 2),
          P(3, "Settra II", "Les Momies de Khemri", 2),
        ] },
      ],
    },
    {
      title: "Équipes",
      categories: [
        { label: "Top Scorers", description: "Touchdowns marqués", rows: [
          P(1, "Athelorn Avengers", "Elfes Sylvains", 4),
          P(2, "Skavenblight Scramblers", "Skavens", 4),
          P(3, "Les Marteaux de Karak", "Nains", 3),
        ] },
        { label: "Bashers", description: "Sorties infligées", rows: [
          P(1, "Les Marteaux de Karak", "Nains", 4),
          P(2, "Les Momies de Khemri", "Rois des Tombes", 3),
          P(3, "Gouged Eye", "Orques", 3),
        ] },
        { label: "Experts en agression", description: "Sorties sur agression", rows: [
          P(1, "Gouged Eye", "Orques", 1),
          P(2, "Les Pourris de Nurgle", "Nurgle", 1),
        ] },
        { label: "Passoires", description: "Touchdowns encaissés", rows: [
          P(1, "Les Pourris de Nurgle", "Nurgle", 5),
          P(2, "Skavenblight Scramblers", "Skavens", 3),
          P(3, "Les Crocs de Morr", "Morts-Vivants", 3),
        ] },
      ],
    },
  ],
};

export const cupBracket: BracketDocument = {
  meta: CUP_META,
  note: "Bracket à 8 - quatre premiers de la phase suisse + repêchés",
  stages: [
    {
      label: "Quarts de finale",
      fixtures: [
        { home: TEAMS.karak, away: TEAMS.morr, statusLabel: "Jouée", score: { home: 3, away: 0 } },
        { home: TEAMS.gouged, away: TEAMS.scramblers, statusLabel: "Jouée", score: { home: 1, away: 2 } },
        { home: TEAMS.athelorn, away: TEAMS.rotters, statusLabel: "Jouée", score: { home: 2, away: 1 } },
        { home: TEAMS.khemri, away: TEAMS.reavers, statusLabel: "Jouée", score: { home: 1, away: 0 } },
      ],
    },
    {
      label: "Demi-finales",
      fixtures: [
        { home: TEAMS.karak, away: TEAMS.scramblers, statusLabel: "Jouée", score: { home: 2, away: 1 } },
        { home: TEAMS.athelorn, away: TEAMS.khemri, statusLabel: "À jouer", scheduledLabel: "Prévue le 04/10/2026 16:00" },
      ],
    },
    {
      label: "Finale",
      fixtures: [{ home: TEAMS.karak, away: TEAMS.karak, placeholder: true, statusLabel: "En attente" }],
    },
  ],
  champion: null,
};

export const cupStats: StatsDocument = {
  meta: CUP_META,
  keyFigures: [
    { label: "Rencontres jouées", value: 8 },
    { label: "Touchdowns", value: 20 },
    { label: "TD par match", value: "2,5" },
    { label: "Sorties sur blocage", value: 16 },
    { label: "Sorties sur agression", value: 2 },
    { label: "Passes réussies", value: 8 },
  ],
  awards: [
    { label: "Top Scorers", description: "Plus de touchdowns", winners: "Athelorn Avengers, Skavenblight Scramblers", value: 4 },
    { label: "Meilleure défense", description: "Moins de touchdowns encaissés", winners: "Les Marteaux de Karak, Les Momies de Khemri", value: 1 },
    { label: "Bashers", description: "Plus de sorties infligées", winners: "Les Marteaux de Karak", value: 4 },
    { label: "Experts en agression", description: "Plus de sorties sur agression", winners: "Gouged Eye, Les Pourris de Nurgle", value: 1 },
    { label: "Passoires", description: "Plus de touchdowns encaissés", winners: "Les Pourris de Nurgle", value: 5 },
  ],
  teamTable: {
    title: null,
    qualifies: 0,
    columns: CUP_STANDING_COLUMNS.slice(1),
    rows: cupStandings.tables[0].rows.map((r) => ({ ...r, cells: r.cells.slice(1) })),
  },
};

export const cupMatchSheet: MatchSheetDocument = {
  ...leagueMatchSheet,
  meta: CUP_META,
  roundLabel: "Ronde 3",
  scheduledLabel: "27/09/2026 14:00",
  away: { ...leagueMatchSheet.away, team: TEAMS.khemri, players: UNDEAD_PLAYERS.map((p) => ({ ...p, unavailable: false, note: null, spp: null })) },
  home: { ...leagueMatchSheet.home, players: DWARF_PLAYERS.map((p) => ({ ...p, unavailable: false, note: null, spp: null })) },
  rules: { spp: false, economy: false, advancements: false, purchases: false, firings: false },
  prefill: null,
};

void CUP_TEAMS;
