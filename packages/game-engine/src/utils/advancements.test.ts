import { getNextAdvancementPspCost, calculateAdvancementsSurcharge, calculatePlayerCurrentValue } from './advancements';

describe('advancements utils', () => {
  it('computes PSP cost per advancement number (primary)', () => {
    expect(getNextAdvancementPspCost(0, 'primary')).toBe(6);
    expect(getNextAdvancementPspCost(1, 'primary')).toBe(8);
    expect(getNextAdvancementPspCost(5, 'primary')).toBe(30);
  });

  it('computes PSP cost per advancement number (secondary)', () => {
    expect(getNextAdvancementPspCost(0, 'secondary')).toBe(12);
    expect(getNextAdvancementPspCost(2, 'secondary')).toBe(18);
    expect(getNextAdvancementPspCost(5, 'secondary')).toBe(40);
  });

  it('sums surcharges for chosen advancements', () => {
    expect(calculateAdvancementsSurcharge(['primary'])).toBe(20000);
    expect(calculateAdvancementsSurcharge(['secondary'])).toBe(40000);
    expect(calculateAdvancementsSurcharge(['primary','secondary','primary'])).toBe(20000+40000+20000);
  });

  it('computes player current value = base + surcharges', () => {
    expect(calculatePlayerCurrentValue(85000, [])).toBe(85000);
    expect(calculatePlayerCurrentValue(85000, ['primary'])).toBe(105000);
    expect(calculatePlayerCurrentValue(85000, ['secondary','primary'])).toBe(145000);
  });
});


