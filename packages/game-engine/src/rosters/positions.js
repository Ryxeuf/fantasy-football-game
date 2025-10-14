/**
 * Système de positions unifiées avec slugs uniques
 * Chaque position a un slug unique (ex: skaven_lineman) et un nom d'affichage
 */
// Mapping complet des équipes avec leurs positions
export const TEAM_ROSTERS = {
    skaven: {
        name: "Skavens",
        budget: 1000,
        positions: [
            {
                slug: "skaven_lineman",
                displayName: "Lineman",
                cost: 50,
                min: 0,
                max: 16,
                ma: 7,
                st: 3,
                ag: 3,
                pa: 4,
                av: 8,
                skills: "",
            },
            {
                slug: "skaven_thrower",
                displayName: "Thrower",
                cost: 85,
                min: 0,
                max: 2,
                ma: 7,
                st: 3,
                ag: 3,
                pa: 2,
                av: 8,
                skills: "Pass,Sure Hands",
            },
            {
                slug: "skaven_blitzer",
                displayName: "Blitzer",
                cost: 90,
                min: 0,
                max: 2,
                ma: 7,
                st: 3,
                ag: 3,
                pa: 4,
                av: 9,
                skills: "Block",
            },
            {
                slug: "skaven_gutter_runner",
                displayName: "Gutter Runner",
                cost: 85,
                min: 0,
                max: 4,
                ma: 9,
                st: 2,
                ag: 2,
                pa: 4,
                av: 8,
                skills: "Dodge",
            },
            {
                slug: "skaven_rat_ogre",
                displayName: "Rat Ogre",
                cost: 150,
                min: 0,
                max: 1,
                ma: 6,
                st: 5,
                ag: 5,
                pa: 6,
                av: 9,
                skills: "Animal Savagery,Frenzy,Loner (4+),Mighty Blow (+1),Prehensile Tail",
            },
        ],
    },
    lizardmen: {
        name: "Hommes-Lézards",
        budget: 1000,
        positions: [
            {
                slug: "lizardmen_skink",
                displayName: "Skink",
                cost: 60,
                min: 0,
                max: 8,
                ma: 8,
                st: 2,
                ag: 3,
                pa: 5,
                av: 8,
                skills: "Dodge,Stunty",
            },
            {
                slug: "lizardmen_saurus",
                displayName: "Saurus",
                cost: 85,
                min: 0,
                max: 6,
                ma: 6,
                st: 4,
                ag: 4,
                pa: 6,
                av: 10,
                skills: "",
            },
            {
                slug: "lizardmen_kroxigor",
                displayName: "Kroxigor",
                cost: 140,
                min: 0,
                max: 1,
                ma: 6,
                st: 5,
                ag: 5,
                pa: 6,
                av: 10,
                skills: "Bone Head,Loner (4+),Mighty Blow (+1),Prehensile Tail,Thick Skull,Throw Team-mate",
            },
        ],
    },
};
// Fonction utilitaire pour obtenir une position par son slug
export function getPositionBySlug(slug) {
    for (const roster of Object.values(TEAM_ROSTERS)) {
        const position = roster.positions.find(p => p.slug === slug);
        if (position)
            return position;
    }
    return null;
}
// Fonction utilitaire pour obtenir toutes les positions d'une équipe
export function getTeamPositions(teamRoster) {
    const roster = TEAM_ROSTERS[teamRoster];
    return roster ? roster.positions : [];
}
// Fonction utilitaire pour obtenir le nom d'affichage d'un slug
export function getDisplayName(slug) {
    const position = getPositionBySlug(slug);
    return position ? position.displayName : slug;
}
// Fonction utilitaire pour obtenir le slug à partir du nom d'affichage et de l'équipe
export function getSlugFromDisplayName(displayName, teamRoster) {
    const positions = getTeamPositions(teamRoster);
    const position = positions.find(p => p.displayName === displayName);
    return position ? position.slug : null;
}
// Mapping des anciennes clés vers les nouveaux slugs (pour migration)
export const LEGACY_POSITION_MAPPING = {
    // Skaven
    "lineman": "skaven_lineman",
    "thrower": "skaven_thrower",
    "blitzer": "skaven_blitzer",
    "gutter": "skaven_gutter_runner",
    "gutter_runner": "skaven_gutter_runner",
    "ratogre": "skaven_rat_ogre",
    "rat_ogre": "skaven_rat_ogre",
    // Lizardmen
    "skink": "lizardmen_skink",
    "saurus": "lizardmen_saurus",
    "kroxigor": "lizardmen_kroxigor",
};
