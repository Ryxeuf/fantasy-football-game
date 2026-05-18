/**
 * BB2020 : un meme Star Player ne peut pas etre embauche en double par
 * une meme equipe. Avant le fix, `validateInducementSelection` ne
 * verifiait que la quantite globale de l'inducement 'star_player' (max 2)
 * mais autorisait `{quantity: 2}` sur le meme starPlayerSlug, ou deux
 * items separes avec le meme starPlayerSlug.
 */
import { describe, it, expect } from 'vitest';
import { validateInducementSelection } from './inducements';

function makeCtx() {
  return {
    teamCode: 'human' as const,
    teamTV: 1_000_000,
    opponentTV: 1_000_000,
    isUnderdog: false,
    homeOrAway: 'home' as const,
  };
}

describe('Star Player dedup (BB2020)', () => {
  it('refuse 2x le meme Star Player via quantity > 1', () => {
    const result = validateInducementSelection(
      {
        items: [
          { slug: 'star_player', quantity: 2, starPlayerSlug: 'morg-n-thorg' },
        ],
      },
      makeCtx(),
      1_000_000,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('star player'))).toBe(true);
  });

  it('refuse 2 items separes avec le meme starPlayerSlug', () => {
    const result = validateInducementSelection(
      {
        items: [
          { slug: 'star_player', quantity: 1, starPlayerSlug: 'morg-n-thorg' },
          { slug: 'star_player', quantity: 1, starPlayerSlug: 'morg-n-thorg' },
        ],
      },
      makeCtx(),
      1_000_000,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('deja embauche'))).toBe(true);
  });

  it('accepte 2 Star Players DIFFERENTS', () => {
    const result = validateInducementSelection(
      {
        items: [
          { slug: 'star_player', quantity: 1, starPlayerSlug: 'morg-n-thorg' },
          { slug: 'star_player', quantity: 1, starPlayerSlug: 'griff-oberwald' },
        ],
      },
      makeCtx(),
      1_000_000,
    );

    // Pas d'erreur de dedup. (Le test ne valide pas le budget, juste l'absence
    // d'erreur de dedup star-player.)
    const dedupError = result.errors.find((e) =>
      e.toLowerCase().includes('deja embauche') || e.includes('embauche qu\'une seule fois'),
    );
    expect(dedupError).toBeUndefined();
  });
});
