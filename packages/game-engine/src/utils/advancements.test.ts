import { describe, it, expect } from 'vitest';
import {
  getNextAdvancementPspCost,
  calculateAdvancementsSurcharge,
  calculatePlayerCurrentValue,
  surchargeForAdvancement,
  CHARACTERISTIC_VALUE_INCREASE,
  isRandomAdvancement,
  applyCharacteristicImprovement,
  characteristicOptionsForRoll,
  canImproveCharacteristic,
  isAtCharacteristicLimit,
  MAX_CHARACTERISTIC_IMPROVEMENTS,
  type PlayerStats,
} from './advancements';

describe('advancements utils (BB2025 / Saison 3)', () => {
  it('computes SPP cost per advancement number (primary, inchangé)', () => {
    expect(getNextAdvancementPspCost(0, 'primary')).toBe(6);
    expect(getNextAdvancementPspCost(1, 'primary')).toBe(8);
    expect(getNextAdvancementPspCost(5, 'primary')).toBe(30);
  });

  it('computes SPP cost per advancement number (secondary, S3 = moins cher)', () => {
    // S3 : 1ère secondaire = 10 (et non plus 12), toute la courbe baisse.
    expect(getNextAdvancementPspCost(0, 'secondary')).toBe(10);
    expect(getNextAdvancementPspCost(1, 'secondary')).toBe(12);
    expect(getNextAdvancementPspCost(2, 'secondary')).toBe(16);
    expect(getNextAdvancementPspCost(5, 'secondary')).toBe(34);
  });

  it('computes SPP cost per advancement number (random-primary, inchangé)', () => {
    expect(getNextAdvancementPspCost(0, 'random-primary')).toBe(3);
    expect(getNextAdvancementPspCost(5, 'random-primary')).toBe(15);
  });

  it('computes SPP cost per advancement number (characteristic, S3)', () => {
    expect(getNextAdvancementPspCost(0, 'characteristic')).toBe(14);
    expect(getNextAdvancementPspCost(1, 'characteristic')).toBe(16);
    expect(getNextAdvancementPspCost(5, 'characteristic')).toBe(38);
  });

  it('sums surcharges for chosen skill advancements', () => {
    expect(calculateAdvancementsSurcharge([{ type: 'primary' }])).toBe(20000);
    expect(calculateAdvancementsSurcharge([{ type: 'secondary' }])).toBe(40000);
    expect(
      calculateAdvancementsSurcharge([
        { type: 'primary' },
        { type: 'secondary' },
        { type: 'primary' },
      ]),
    ).toBe(20000 + 40000 + 20000);
  });

  it('computes per-stat surcharge for characteristic advancements', () => {
    expect(surchargeForAdvancement({ type: 'characteristic', stat: 'av' })).toBe(10000);
    expect(surchargeForAdvancement({ type: 'characteristic', stat: 'ma' })).toBe(20000);
    expect(surchargeForAdvancement({ type: 'characteristic', stat: 'pa' })).toBe(20000);
    expect(surchargeForAdvancement({ type: 'characteristic', stat: 'ag' })).toBe(30000);
    expect(surchargeForAdvancement({ type: 'characteristic', stat: 'st' })).toBe(60000);
    expect(CHARACTERISTIC_VALUE_INCREASE.st).toBe(60000);
  });

  it('keeps legacy random-secondary surcharge (read back-compat)', () => {
    // Plus proposable en S3, mais des données existantes peuvent en avoir.
    expect(surchargeForAdvancement({ type: 'random-secondary' })).toBe(20000);
  });

  it('computes player current value = base + surcharges (skills + carac)', () => {
    expect(calculatePlayerCurrentValue(85000, [])).toBe(85000);
    expect(calculatePlayerCurrentValue(85000, [{ type: 'primary' }])).toBe(105000);
    expect(
      calculatePlayerCurrentValue(85000, [
        { type: 'secondary' },
        { type: 'characteristic', stat: 'st' },
      ]),
    ).toBe(85000 + 40000 + 60000);
  });

  it('only random-primary is a random advancement in S3', () => {
    expect(isRandomAdvancement('random-primary')).toBe(true);
    expect(isRandomAdvancement('primary')).toBe(false);
    expect(isRandomAdvancement('secondary')).toBe(false);
    expect(isRandomAdvancement('characteristic')).toBe(false);
  });

  describe('applyCharacteristicImprovement', () => {
    const base: PlayerStats = { ma: 6, st: 3, ag: 3, pa: 4, av: 9 };

    it('increments MA / ST / AV (plus haut = meilleur)', () => {
      expect(applyCharacteristicImprovement(base, 'ma').ma).toBe(7);
      expect(applyCharacteristicImprovement(base, 'st').st).toBe(4);
      expect(applyCharacteristicImprovement(base, 'av').av).toBe(10);
    });

    it('décrémente AG / PA (cible "X+", plus bas = meilleur)', () => {
      expect(applyCharacteristicImprovement(base, 'ag').ag).toBe(2);
      expect(applyCharacteristicImprovement(base, 'pa').pa).toBe(3);
    });

    it('respecte un plancher de 1 pour AG / PA', () => {
      const elite: PlayerStats = { ma: 6, st: 3, ag: 1, pa: 1, av: 9 };
      expect(applyCharacteristicImprovement(elite, 'ag').ag).toBe(1);
      expect(applyCharacteristicImprovement(elite, 'pa').pa).toBe(1);
    });

    it('laisse PA inchangée si elle est null (— = pas de passe)', () => {
      const noPass: PlayerStats = { ma: 6, st: 3, ag: 3, pa: null, av: 9 };
      expect(applyCharacteristicImprovement(noPass, 'pa').pa).toBeNull();
    });

    it('ne mute pas l’objet source (immutable)', () => {
      applyCharacteristicImprovement(base, 'ma');
      expect(base.ma).toBe(6);
    });

    it('borne les améliorations aux limites BB2025 (p.37)', () => {
      expect(applyCharacteristicImprovement({ ma: 9, st: 3, ag: 3, pa: 4, av: 9 }, 'ma').ma).toBe(9);
      expect(applyCharacteristicImprovement({ ma: 6, st: 5, ag: 3, pa: 4, av: 9 }, 'st').st).toBe(5);
      expect(applyCharacteristicImprovement({ ma: 6, st: 3, ag: 3, pa: 4, av: 11 }, 'av').av).toBe(11);
      expect(applyCharacteristicImprovement({ ma: 6, st: 3, ag: 1, pa: 4, av: 9 }, 'ag').ag).toBe(1);
    });
  });

  describe('D8 characteristic table (BB2025)', () => {
    it('mappe chaque jet D8 vers les bonnes options', () => {
      expect(characteristicOptionsForRoll(1)).toEqual(['av']);
      expect(characteristicOptionsForRoll(2)).toEqual(['av', 'pa']);
      expect(characteristicOptionsForRoll(3)).toEqual(['av', 'ma', 'pa']);
      expect(characteristicOptionsForRoll(4)).toEqual(['av', 'ma', 'pa']);
      expect(characteristicOptionsForRoll(5)).toEqual(['ma', 'pa']);
      expect(characteristicOptionsForRoll(6)).toEqual(['ag', 'pa']);
      expect(characteristicOptionsForRoll(7)).toEqual(['ag', 'ma']);
      expect(characteristicOptionsForRoll(8)).toEqual(['ma', 'st', 'ag', 'pa', 'av']);
    });

    it("la Force (ST) n'est accessible que sur un 8", () => {
      for (let d = 1; d <= 7; d += 1) {
        expect(characteristicOptionsForRoll(d)).not.toContain('st');
      }
      expect(characteristicOptionsForRoll(8)).toContain('st');
    });

    it('jet hors plage → aucune option', () => {
      expect(characteristicOptionsForRoll(0)).toEqual([]);
      expect(characteristicOptionsForRoll(9)).toEqual([]);
    });
  });

  describe('Characteristic caps (BB2025 p.37)', () => {
    const fresh: PlayerStats = { ma: 6, st: 3, ag: 3, pa: 4, av: 9 };

    it('refuse au-delà de 2 améliorations de la même caractéristique', () => {
      expect(canImproveCharacteristic(fresh, 'ma', 0)).toBe(true);
      expect(canImproveCharacteristic(fresh, 'ma', 1)).toBe(true);
      expect(canImproveCharacteristic(fresh, 'ma', MAX_CHARACTERISTIC_IMPROVEMENTS)).toBe(false);
    });

    it('refuse une caractéristique déjà à sa limite', () => {
      expect(canImproveCharacteristic({ ...fresh, st: 5 }, 'st', 0)).toBe(false); // ST max 5
      expect(canImproveCharacteristic({ ...fresh, ma: 9 }, 'ma', 0)).toBe(false); // MA max 9
      expect(canImproveCharacteristic({ ...fresh, av: 11 }, 'av', 0)).toBe(false); // AV max 11+
      expect(canImproveCharacteristic({ ...fresh, ag: 1 }, 'ag', 0)).toBe(false); // AG meilleure cible 1+
    });

    it('refuse PA quand le joueur n’a pas de passe (— / null)', () => {
      expect(isAtCharacteristicLimit('pa', null)).toBe(true);
      expect(canImproveCharacteristic({ ...fresh, pa: null }, 'pa', 0)).toBe(false);
    });
  });
});
