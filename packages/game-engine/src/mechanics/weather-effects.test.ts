import { describe, it, expect } from 'vitest';
import { getWeatherModifiers, isPassRangeAllowed, type WeatherModifiers } from './weather-effects';
import type { WeatherCondition } from '../core/weather-types';

describe('Weather Effects', () => {
  describe('getWeatherModifiers', () => {
    it('returns default modifiers for perfect conditions', () => {
      const condition: WeatherCondition = {
        condition: 'Conditions parfaites',
        description: 'Conditions idéales',
      };
      const mods = getWeatherModifiers(condition);
      expect(mods.passingModifier).toBe(0);
      expect(mods.agilityModifier).toBe(0);
      expect(mods.gfiModifier).toBe(0);
      expect(mods.maxPassRange).toBeNull();
    });

    it('returns -1 passing modifier for sunny weather', () => {
      const condition: WeatherCondition = {
        condition: 'Très ensoleillé',
        description: 'Interfère avec le jeu de passe',
      };
      const mods = getWeatherModifiers(condition);
      expect(mods.passingModifier).toBe(-1);
    });

    it('returns blizzard modifiers (GFI -1, pass range limited)', () => {
      const condition: WeatherCondition = {
        condition: 'Blizzard',
        description: 'Conditions glaciales',
      };
      const mods = getWeatherModifiers(condition);
      expect(mods.gfiModifier).toBe(-1);
      expect(mods.maxPassRange).toBe('short');
    });

    it('returns agility modifier for rain', () => {
      const condition: WeatherCondition = {
        condition: 'Pluie battante',
        description: 'Pluie torrentielle',
      };
      const mods = getWeatherModifiers(condition);
      expect(mods.agilityModifier).toBe(-1);
    });

    it('returns reserve effect for extreme heat', () => {
      const condition: WeatherCondition = {
        condition: 'Chaleur écrasante',
        description: 'Joueurs s\'évanouissent',
      };
      const mods = getWeatherModifiers(condition);
      expect(mods.playersToReserves).toBe(1);
    });

    it('returns default for undefined condition', () => {
      const mods = getWeatherModifiers(undefined);
      expect(mods.passingModifier).toBe(0);
    });
  });

  describe('isPassRangeAllowed', () => {
    it('allows all ranges when no restriction', () => {
      const mods: WeatherModifiers = {
        passingModifier: 0, agilityModifier: 0, gfiModifier: 0,
        maxPassRange: null, playersToReserves: 0,
      };
      expect(isPassRangeAllowed('quick', mods)).toBe(true);
      expect(isPassRangeAllowed('short', mods)).toBe(true);
      expect(isPassRangeAllowed('long', mods)).toBe(true);
      expect(isPassRangeAllowed('bomb', mods)).toBe(true);
    });

    it('restricts to short range in blizzard', () => {
      const mods: WeatherModifiers = {
        passingModifier: 0, agilityModifier: 0, gfiModifier: -1,
        maxPassRange: 'short', playersToReserves: 0,
      };
      expect(isPassRangeAllowed('quick', mods)).toBe(true);
      expect(isPassRangeAllowed('short', mods)).toBe(true);
      expect(isPassRangeAllowed('long', mods)).toBe(false);
      expect(isPassRangeAllowed('bomb', mods)).toBe(false);
    });
  });
});
