import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TEAM_LOGO,
  ROSTER_LOGOS,
  getTeamLogo,
  renderTeamLogoSvg,
  TEAM_LOGO_SHAPES,
  type TeamLogo,
} from './team-logos';
import { TEAM_ROSTERS_BY_RULESET } from './positions';
import { ROSTER_COLORS } from './team-colors';

describe('Regle: team-logos (O.8b cosmetiques visuels)', () => {
  describe('DEFAULT_TEAM_LOGO', () => {
    it('expose une forme et un glyph valides', () => {
      expect(TEAM_LOGO_SHAPES).toContain(DEFAULT_TEAM_LOGO.shape);
      expect(typeof DEFAULT_TEAM_LOGO.glyph).toBe('string');
      expect(DEFAULT_TEAM_LOGO.glyph.length).toBeGreaterThan(0);
      expect(DEFAULT_TEAM_LOGO.glyph.length).toBeLessThanOrEqual(3);
    });
  });

  describe('ROSTER_LOGOS map', () => {
    it('definit un logo pour chaque roster connu (cohesion avec ROSTER_COLORS)', () => {
      for (const slug of Object.keys(ROSTER_COLORS)) {
        expect(ROSTER_LOGOS[slug], `missing logo for roster "${slug}"`).toBeDefined();
      }
    });

    it('definit un logo pour chaque roster declare dans tous les rulesets', () => {
      const allSlugs = new Set<string>();
      for (const ruleset of Object.keys(TEAM_ROSTERS_BY_RULESET) as Array<
        keyof typeof TEAM_ROSTERS_BY_RULESET
      >) {
        for (const slug of Object.keys(TEAM_ROSTERS_BY_RULESET[ruleset])) {
          allSlugs.add(slug);
        }
      }
      for (const slug of allSlugs) {
        expect(ROSTER_LOGOS[slug], `missing logo for roster "${slug}"`).toBeDefined();
      }
    });

    it('chaque entree expose une forme valide et un glyph 1 a 3 caracteres', () => {
      for (const [slug, logo] of Object.entries(ROSTER_LOGOS)) {
        expect(TEAM_LOGO_SHAPES, `${slug}.shape invalide`).toContain(logo.shape);
        expect(typeof logo.glyph, `${slug}.glyph type`).toBe('string');
        expect(logo.glyph.length, `${slug}.glyph empty`).toBeGreaterThan(0);
        expect(logo.glyph.length, `${slug}.glyph trop long`).toBeLessThanOrEqual(3);
      }
    });

    it('produit au moins 3 formes distinctes pour la diversite visuelle', () => {
      const shapes = new Set(Object.values(ROSTER_LOGOS).map((l) => l.shape));
      expect(shapes.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getTeamLogo()', () => {
    it('retourne DEFAULT_TEAM_LOGO si le slug est undefined', () => {
      expect(getTeamLogo(undefined)).toEqual(DEFAULT_TEAM_LOGO);
    });

    it('retourne DEFAULT_TEAM_LOGO si le slug est une chaine vide', () => {
      expect(getTeamLogo('')).toEqual(DEFAULT_TEAM_LOGO);
    });

    it('retourne DEFAULT_TEAM_LOGO pour un slug inconnu', () => {
      expect(getTeamLogo('not_a_real_roster_zzz')).toEqual(DEFAULT_TEAM_LOGO);
    });

    it('retourne le logo canonique pour un slug connu', () => {
      const skaven = getTeamLogo('skaven');
      expect(skaven).toEqual(ROSTER_LOGOS.skaven);
    });
  });

  describe('renderTeamLogoSvg()', () => {
    it('produit un SVG bien forme avec namespace, viewBox 64x64 par defaut', () => {
      const svg = renderTeamLogoSvg('skaven');
      expect(svg).toMatch(/^<svg /);
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('viewBox="0 0 64 64"');
      expect(svg.trim().endsWith('</svg>')).toBe(true);
    });

    it('respecte la taille demandee via opts.size', () => {
      const svg = renderTeamLogoSvg('skaven', { size: 128 });
      expect(svg).toContain('width="128"');
      expect(svg).toContain('height="128"');
    });

    it('inclut un titre accessible via opts.title', () => {
      const svg = renderTeamLogoSvg('skaven', { title: 'Skaven Logo' });
      expect(svg).toContain('<title>Skaven Logo</title>');
      expect(svg).toContain('role="img"');
      expect(svg).toContain('aria-label="Skaven Logo"');
    });

    it('marque le SVG comme decoratif quand aucun titre nest fourni', () => {
      const svg = renderTeamLogoSvg('skaven');
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).not.toContain('<title>');
    });

    it('utilise les couleurs canoniques de la roster', () => {
      const svg = renderTeamLogoSvg('skaven');
      // skaven primary 0x92400e -> #92400e (rust)
      expect(svg.toLowerCase()).toContain('#92400e');
      // skaven secondary 0xd6d3d1 -> #d6d3d1 (bone)
      expect(svg.toLowerCase()).toContain('#d6d3d1');
    });

    it('accepte une override de couleurs', () => {
      const svg = renderTeamLogoSvg('skaven', {
        override: { primary: 0x123456, secondary: 0xabcdef },
      });
      expect(svg.toLowerCase()).toContain('#123456');
      expect(svg.toLowerCase()).toContain('#abcdef');
      expect(svg.toLowerCase()).not.toContain('#92400e');
    });

    it('inclut le glyph du roster en sortie', () => {
      const expectedGlyph = ROSTER_LOGOS.skaven.glyph;
      const svg = renderTeamLogoSvg('skaven');
      expect(svg).toContain(`>${escapeXml(expectedGlyph)}<`);
    });

    it('echappe les caracteres dangereux dans le glyph et le titre (no XSS)', () => {
      const customLogo: TeamLogo = { shape: 'circle', glyph: '<&>"' };
      const svg = renderTeamLogoSvg(undefined, {
        title: '<script>alert(1)</script>',
        logo: customLogo,
      });
      expect(svg).not.toContain('<script>');
      expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(svg).toContain('&lt;&amp;&gt;&quot;');
    });

    it('produit des SVG differents selon le slug (diversite visuelle)', () => {
      const skaven = renderTeamLogoSvg('skaven');
      const dwarf = renderTeamLogoSvg('dwarf');
      expect(skaven).not.toBe(dwarf);
    });

    it('reste deterministe : meme slug -> meme sortie', () => {
      expect(renderTeamLogoSvg('skaven')).toBe(renderTeamLogoSvg('skaven'));
    });

    it('fallback sur DEFAULT_TEAM_LOGO quand le slug est inconnu', () => {
      const unknown = renderTeamLogoSvg('not_a_real_roster_zzz');
      const defaultGlyph = DEFAULT_TEAM_LOGO.glyph;
      expect(unknown).toContain(`>${escapeXml(defaultGlyph)}<`);
    });

    it('rejete une taille non strictement positive (clamp ou fallback a 64)', () => {
      const zero = renderTeamLogoSvg('skaven', { size: 0 });
      expect(zero).toContain('width="64"');
      const negative = renderTeamLogoSvg('skaven', { size: -10 });
      expect(negative).toContain('width="64"');
    });
  });
});

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
