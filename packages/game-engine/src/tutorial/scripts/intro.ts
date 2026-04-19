/**
 * Premier tutoriel : "Mon premier match".
 * Initie le debutant au plateau, au mouvement, au blocage et au touchdown.
 */
import type { TutorialScript } from '../types';

export const MON_PREMIER_MATCH: TutorialScript = {
  slug: 'mon-premier-match',
  titleFr: 'Mon premier match',
  titleEn: 'My first match',
  summaryFr:
    "Decouvrez les bases de Nuffle Arena : plateau, mouvement, blocage, passe et touchdown en moins de dix minutes.",
  summaryEn:
    'Learn the basics of Nuffle Arena: board, movement, blocking, passing and touchdowns in under ten minutes.',
  estimatedMinutes: 8,
  difficulty: 'beginner',
  nextSlugs: ['regles-allegees'],
  steps: [
    {
      id: 'welcome',
      titleFr: 'Bienvenue dans Nuffle Arena',
      titleEn: 'Welcome to Nuffle Arena',
      bodyFr:
        "Nuffle Arena est un jeu de football fantastique au tour par tour. Chaque equipe tente de marquer des touchdowns en franchissant la ligne d'en-but adverse. Ce tutoriel vous accompagne pas a pas, sans risquer de perdre votre equipe.",
      bodyEn:
        'Nuffle Arena is a turn-based fantasy football game. Each team tries to score touchdowns by crossing the opposing end zone. This tutorial guides you step by step, with no risk to your team.',
      action: 'info',
      imageKey: 'tutorial/welcome',
    },
    {
      id: 'board',
      titleFr: 'Le plateau 26 x 15',
      titleEn: 'The 26 x 15 pitch',
      bodyFr:
        "Le terrain mesure 26 cases de long pour 15 de large. Les deux zones bleues de chaque cote sont les en-but : y deposer le ballon avec un joueur debout marque un touchdown.",
      bodyEn:
        'The pitch is 26 squares long and 15 wide. The blue zones on each side are the end zones: taking the ball there with a standing player scores a touchdown.',
      action: 'info',
      highlights: [
        { kind: 'cell', cell: { x: 0, y: 7 } },
        { kind: 'cell', cell: { x: 25, y: 7 } },
      ],
      imageKey: 'tutorial/board',
    },
    {
      id: 'turn',
      titleFr: 'Le tour de jeu',
      titleEn: 'The turn',
      bodyFr:
        "A chaque tour, vous pouvez bouger chacun de vos joueurs une fois et realiser une seule action speciale (blitz, passe, faute). Un jet rate provoque un turnover : votre tour s'arrete immediatement.",
      bodyEn:
        'Each turn you may move each of your players once and perform a single special action (blitz, pass, foul). A failed roll triggers a turnover: your turn ends immediately.',
      action: 'info',
      tipFr: 'Astuce : commencez par les actions les plus sures pour eviter un turnover precoce.',
      tipEn: 'Tip: start with the safest actions to avoid an early turnover.',
    },
    {
      id: 'move',
      titleFr: 'Deplacer un joueur',
      titleEn: 'Move a player',
      bodyFr:
        "Selectionnez un joueur pour afficher ses cases de mouvement vertes. Chaque case coute 1 point de MA (Movement Allowance). Sortir de la zone de tacle d'un adversaire declenche un jet d'esquive.",
      bodyEn:
        "Select a player to reveal their green movement squares. Each square costs 1 MA (Movement Allowance). Leaving an opponent's tackle zone triggers a dodge roll.",
      action: 'move-player',
      highlights: [{ kind: 'hud', target: 'selected-player' }],
      imageKey: 'tutorial/move',
    },
    {
      id: 'block',
      titleFr: 'Bloquer un adversaire',
      titleEn: 'Block an opponent',
      bodyFr:
        "Un joueur debout peut bloquer un adversaire debout en case adjacente. Le nombre de des (1 a 3) depend des forces et des assistances. Le joueur le plus faible choisit parmi les des si vous etes moins fort.",
      bodyEn:
        'A standing player can block an adjacent standing opponent. The number of dice (1 to 3) depends on strengths and assists. The weaker player picks the die if you are outmatched.',
      action: 'block-player',
      highlights: [{ kind: 'dice', target: 'block-dice' }],
      imageKey: 'tutorial/block',
      tipFr: 'Les des de blocage ne sont pas des D6 : chaque face represente un resultat specifique.',
      tipEn: 'Block dice are not D6: each face represents a specific outcome.',
    },
    {
      id: 'pickup',
      titleFr: 'Ramasser le ballon',
      titleEn: 'Pick up the ball',
      bodyFr:
        "Deplacez un joueur sur la case du ballon pour declencher un jet de ramassage base sur son AG. L'echec est un turnover, pensez a depenser une relance si besoin.",
      bodyEn:
        "Move a player onto the ball's square to trigger a pickup roll based on AG. A failure is a turnover; spend a re-roll if needed.",
      action: 'pickup-ball',
      highlights: [{ kind: 'info-panel', target: 'ball-carrier' }],
      imageKey: 'tutorial/pickup',
    },
    {
      id: 'pass',
      titleFr: 'Passer le ballon',
      titleEn: 'Pass the ball',
      bodyFr:
        "Une passe est une action speciale : un seul joueur peut la tenter par tour. Portee courte, longue ou tres longue, plus la distance est grande plus le jet est difficile.",
      bodyEn:
        'A pass is a special action: only one player per turn can attempt it. Range is short, long, or very long — the farther you throw, the harder the roll.',
      action: 'pass-ball',
      highlights: [{ kind: 'hud', target: 'pass-button' }],
      imageKey: 'tutorial/pass',
    },
    {
      id: 'touchdown',
      titleFr: 'Marquer un touchdown',
      titleEn: 'Score a touchdown',
      bodyFr:
        "Deposez un joueur debout avec le ballon dans l'en-but adverse pour marquer un touchdown. La partie repart ensuite sur un nouveau kickoff.",
      bodyEn:
        "Place a standing player carrying the ball in the opposing end zone to score a touchdown. The game then restarts with a new kickoff.",
      action: 'score-touchdown',
      highlights: [{ kind: 'cell', cell: { x: 25, y: 7 } }],
      imageKey: 'tutorial/touchdown',
    },
    {
      id: 'end-turn',
      titleFr: 'Terminer son tour',
      titleEn: 'End your turn',
      bodyFr:
        "Cliquez sur 'Fin de tour' pour passer la main. L'adversaire joue alors son tour. Une partie dure deux mi-temps de huit tours chacune (ou six en mode allege).",
      bodyEn:
        "Click 'End turn' to hand the game over. Your opponent then plays their turn. A match lasts two halves of eight turns each (six in simplified mode).",
      action: 'end-turn',
      highlights: [{ kind: 'hud', target: 'end-turn-button' }],
      imageKey: 'tutorial/end-turn',
    },
    {
      id: 'next-steps',
      titleFr: 'Prochaines etapes',
      titleEn: 'Next steps',
      bodyFr:
        "Vous connaissez l'essentiel ! Continuez avec le mode regles allegees pour pratiquer sans competences, puis affrontez l'IA avant un match en ligne classe.",
      bodyEn:
        'You know the essentials! Continue with the simplified rules mode to practice without skills, then challenge the AI before a ranked online match.',
      action: 'info',
    },
  ],
};
