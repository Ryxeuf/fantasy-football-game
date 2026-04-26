import { describe, it, expect } from 'vitest';
import {
  buildDiscordMatchAnnouncement,
  type DiscordMatchAnnouncementInput,
} from './discord-webhook';

const baseInput = (
  overrides: Partial<DiscordMatchAnnouncementInput> = {},
): DiscordMatchAnnouncementInput => ({
  matchUrl: 'https://nuffle.example.com/match/m1',
  teamAName: 'Skaven FC',
  teamBName: 'Dwarves United',
  teamARoster: 'skaven',
  teamBRoster: 'dwarf',
  scoreA: 2,
  scoreB: 1,
  totalCasualties: 4,
  highlight: 'Match of the Week',
  ...overrides,
});

describe('Regle: discord-webhook (O.9 community)', () => {
  it('produit un payload structuré avec embed Discord', () => {
    const payload = buildDiscordMatchAnnouncement(baseInput());
    expect(Array.isArray(payload.embeds)).toBe(true);
    expect(payload.embeds.length).toBe(1);
    expect(payload.embeds[0].title).toBeDefined();
  });

  it('inclut un titre lisible avec les noms des equipes et le score', () => {
    const payload = buildDiscordMatchAnnouncement(baseInput());
    expect(payload.embeds[0].title).toContain('Skaven FC');
    expect(payload.embeds[0].title).toContain('Dwarves United');
    expect(payload.embeds[0].title).toContain('2');
    expect(payload.embeds[0].title).toContain('1');
  });

  it('inclut le highlight (ex: Match of the Week)', () => {
    const payload = buildDiscordMatchAnnouncement(baseInput());
    expect(payload.content || payload.embeds[0].description || '').toContain(
      'Match of the Week',
    );
  });

  it('expose un champ url cliquable pointant vers le match', () => {
    const payload = buildDiscordMatchAnnouncement(baseInput());
    expect(payload.embeds[0].url).toBe('https://nuffle.example.com/match/m1');
  });

  it('utilise une couleur d embed deterministe basee sur la roster gagnante', () => {
    const skavenWin = buildDiscordMatchAnnouncement(baseInput({ scoreA: 3, scoreB: 0 }));
    const dwarfWin = buildDiscordMatchAnnouncement(baseInput({ scoreA: 0, scoreB: 3 }));
    expect(typeof skavenWin.embeds[0].color).toBe('number');
    expect(typeof dwarfWin.embeds[0].color).toBe('number');
    expect(skavenWin.embeds[0].color).not.toBe(dwarfWin.embeds[0].color);
  });

  it('expose des champs structurés avec stats du match', () => {
    const payload = buildDiscordMatchAnnouncement(baseInput());
    const fields = payload.embeds[0].fields ?? [];
    const names = fields.map((f) => f.name.toLowerCase());
    expect(names.some((n) => n.includes('score') || n.includes('touchdown'))).toBe(true);
    expect(names.some((n) => n.includes('casual'))).toBe(true);
  });

  it('reste deterministe : meme entree -> meme sortie', () => {
    const a = buildDiscordMatchAnnouncement(baseInput());
    const b = buildDiscordMatchAnnouncement(baseInput());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('rejette une URL invalide en levant une erreur claire', () => {
    expect(() =>
      buildDiscordMatchAnnouncement(baseInput({ matchUrl: 'not-a-url' })),
    ).toThrow(/url/i);
  });

  it('tronque le titre si trop long pour respecter la limite Discord (256)', () => {
    const longName = 'A'.repeat(150);
    const payload = buildDiscordMatchAnnouncement(
      baseInput({ teamAName: longName, teamBName: longName }),
    );
    expect(payload.embeds[0].title.length).toBeLessThanOrEqual(256);
  });
});
