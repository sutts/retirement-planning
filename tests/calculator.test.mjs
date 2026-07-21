import { calculateProjections } from '../lib/calculator.mjs';

// ─── Shared baseline parameters ───────────────────────────────────────────────
// Neither partner qualifies for super at the start (P1 qualifies at Year 6, P2 at Year 12).
const BASE = {
  startBalance:       1500000,
  grossReturnRate:    0.04,
  taxRate:            0.008,
  inflationRate:      0.025,
  ageP1:              59,
  ageP2:              53,
  superAgeP1:         65,
  superAgeP2:         65,
  annualSuper:        40000,
  secondaryCapAmount: 0,
  secondaryCapYear:   10,
  p1Years:            10,
  p2Years:            10,
  p1Spend:            9000,
  p2Spend:            6000,
  p3Spend:            4000,
  p1Holiday:          20000,
  p1Emergency:        5000,
  p2Holiday:          10000,
  p2Emergency:        5000,
  p3Holiday:          2000,
  p3Emergency:        5000,
};

// Pre-compute shared rates that match the engine's own formulas exactly.
const monthlyInflationRate = Math.pow(1 + BASE.inflationRate, 1 / 12) - 1;

describe('calculateProjections', () => {

  // ─── 1. Output shape ────────────────────────────────────────────────────────

  test('returns exactly 600 monthly rows and 50 yearly rows', () => {
    const { monthlyData, yearlyData } = calculateProjections(BASE);
    expect(monthlyData.length).toBe(600);
    expect(yearlyData.length).toBe(50);
  });

  // ─── 2. Balance chain continuity ────────────────────────────────────────────

  test('endCap of every month equals startCap of the following month', () => {
    const { monthlyData } = calculateProjections(BASE);
    for (let i = 0; i < monthlyData.length - 1; i++) {
      expect(monthlyData[i].endCap).toBeCloseTo(monthlyData[i + 1].startCap, 8);
    }
  });

  test('yearly endCap equals the following year\'s startCap', () => {
    const { yearlyData } = calculateProjections(BASE);
    for (let y = 0; y < yearlyData.length - 1; y++) {
      expect(yearlyData[y].endCap).toBeCloseTo(yearlyData[y + 1].startCap, 8);
    }
  });

  test('yearly startCap matches the first monthly row\'s startCap for every year', () => {
    const { monthlyData, yearlyData } = calculateProjections(BASE);
    for (let y = 0; y < yearlyData.length; y++) {
      expect(yearlyData[y].startCap).toBeCloseTo(monthlyData[y * 12].startCap, 8);
    }
  });

  // ─── 3. Balance accounting identity ─────────────────────────────────────────
  // When startCap > 0 and the portfolio does NOT hit zero during a month:
  //   startCap - netDraw + netGain + superSurplus + injection = endCap
  // (superSurplus = max(0, superInc - spend), which is the reinvested portion)

  test('accounting identity holds for all non-clamped months', () => {
    const { monthlyData } = calculateProjections(BASE);
    for (const row of monthlyData) {
      // Skip any month where the portfolio is already at zero — the engine clamps
      // endCap to 0 (rather than going negative) so the identity intentionally breaks.
      if (row.endCap === 0) continue;
      const superSurplus = Math.max(0, row.superInc - row.spend);
      const computed = row.startCap - row.netDraw + row.netGain + superSurplus + row.injection;
      expect(computed).toBeCloseTo(row.endCap, 5);
    }
  });

  test('yearly accounting identity holds for all non-clamped years', () => {
    const { yearlyData } = calculateProjections(BASE);
    for (const row of yearlyData) {
      if (row.endCap === 0) continue;
      const superSurplus = Math.max(0, row.superInc - row.spend);
      const computed = row.startCap - row.netDraw + row.netGain + superSurplus + row.injection;
      expect(computed).toBeCloseTo(row.endCap, 4);
    }
  });

  // ─── 4. Tax relationship ─────────────────────────────────────────────────────

  test('taxPaid = grossGain - netGain for every month', () => {
    const { monthlyData } = calculateProjections(BASE);
    for (const row of monthlyData) {
      expect(row.taxPaid).toBeCloseTo(row.grossGain - row.netGain, 8);
    }
  });

  // ─── 5. Investment return arithmetic (Month 1 hand-check) ────────────────────

  test('Month 1 investment gain arithmetic matches manual calculation', () => {
    const p = BASE;
    const { monthlyData } = calculateProjections(p);
    const m0 = monthlyData[0]; // m = 0, first month

    const netAnnualRate    = Math.max(0, p.grossReturnRate - p.taxRate); // 0.032
    const monthlyNetRate   = Math.pow(1 + netAnnualRate, 1 / 12) - 1;
    const monthlyGrossRate = Math.pow(1 + p.grossReturnRate, 1 / 12) - 1;

    // At m=0: inflationMult=1, no super (both partners under 65)
    const expectedSpend      = p.p1Spend + (p.p1Holiday + p.p1Emergency) / 12;
    const expectedNetDraw    = expectedSpend; // super = 0
    const expectedTaxBase    = Math.max(0, p.startBalance - expectedNetDraw / 2);
    const expectedNetGain    = expectedTaxBase * monthlyNetRate;
    const expectedGrossGain  = expectedTaxBase * monthlyGrossRate;
    const expectedTaxPaid    = expectedGrossGain - expectedNetGain;
    const expectedEndCap     = p.startBalance - expectedNetDraw + expectedNetGain;

    expect(m0.spend).toBeCloseTo(expectedSpend, 4);
    expect(m0.netDraw).toBeCloseTo(expectedNetDraw, 4);
    expect(m0.grossGain).toBeCloseTo(expectedGrossGain, 4);
    expect(m0.netGain).toBeCloseTo(expectedNetGain, 4);
    expect(m0.taxPaid).toBeCloseTo(expectedTaxPaid, 4);
    expect(m0.endCap).toBeCloseTo(expectedEndCap, 4);
  });

  // ─── 6. Inflation compounding ────────────────────────────────────────────────

  test('monthly spend is correctly inflation-compounded at m=0 and m=23', () => {
    const { monthlyData } = calculateProjections(BASE);
    const baseSpend = BASE.p1Spend + (BASE.p1Holiday + BASE.p1Emergency) / 12;

    expect(monthlyData[0].spend).toBeCloseTo(
      baseSpend * Math.pow(1 + monthlyInflationRate, 0), 4
    );
    expect(monthlyData[23].spend).toBeCloseTo(
      baseSpend * Math.pow(1 + monthlyInflationRate, 23), 4
    );
  });

  // ─── 7. Spending phase transitions ──────────────────────────────────────────

  test('spend uses the correct base rate at the first month of each phase', () => {
    const p = { ...BASE, p1Years: 5, p2Years: 5 };
    const { monthlyData } = calculateProjections(p);

    // Phase 1: m=0
    const expectedPhase1 = (p.p1Spend + (p.p1Holiday + p.p1Emergency) / 12)
      * Math.pow(1 + monthlyInflationRate, 0);
    expect(monthlyData[0].spend).toBeCloseTo(expectedPhase1, 4);

    // Phase 2: m=60 (yearIndex=5 = p1Years)
    const expectedPhase2 = (p.p2Spend + (p.p2Holiday + p.p2Emergency) / 12)
      * Math.pow(1 + monthlyInflationRate, 60);
    expect(monthlyData[60].spend).toBeCloseTo(expectedPhase2, 4);

    // Phase 3: m=120 (yearIndex=10 = p1Years+p2Years)
    const expectedPhase3 = (p.p3Spend + (p.p3Holiday + p.p3Emergency) / 12)
      * Math.pow(1 + monthlyInflationRate, 120);
    expect(monthlyData[120].spend).toBeCloseTo(expectedPhase3, 4);
  });

  test('last month of Phase 1 and first month of Phase 2 use different base spend rates', () => {
    const p = { ...BASE, p1Years: 5, p2Years: 5 };
    const { monthlyData } = calculateProjections(p);

    const inflRatio = Math.pow(1 + monthlyInflationRate, 60) / Math.pow(1 + monthlyInflationRate, 59);
    // If the phase base rate hadn't changed, spend[60] / spend[59] would equal inflRatio.
    // It should NOT — the base rate dropped from p1Spend to p2Spend.
    expect(monthlyData[60].spend / monthlyData[59].spend).not.toBeCloseTo(inflRatio, 2);
  });

  test('yearly aggregate spend equals the sum of its 12 monthly spend values', () => {
    const { monthlyData, yearlyData } = calculateProjections(BASE);
    for (let y = 0; y < yearlyData.length; y++) {
      const monthlySum = monthlyData
        .slice(y * 12, (y + 1) * 12)
        .reduce((acc, r) => acc + r.spend, 0);
      expect(yearlyData[y].spend).toBeCloseTo(monthlySum, 4);
    }
  });

  // ─── 8. NZ Super eligibility ────────────────────────────────────────────────

  test('super income is zero before either partner reaches eligibility age', () => {
    // Both partners well under 65 at m=0 in BASE
    const { monthlyData } = calculateProjections(BASE);
    expect(monthlyData[0].superInc).toBeCloseTo(0, 8);
    expect(monthlyData[11].superInc).toBeCloseTo(0, 8);
  });

  test('super income is 50% when only one partner qualifies', () => {
    // P1 already 65, P2 aged 60 (qualifies at m=60)
    const p = { ...BASE, ageP1: 65, ageP2: 60 };
    const { monthlyData } = calculateProjections(p);

    const expectedHalf = (p.annualSuper / 12) * 0.5 * Math.pow(1 + monthlyInflationRate, 0);
    expect(monthlyData[0].superInc).toBeCloseTo(expectedHalf, 4);

    // P2 still not eligible at m=59 (age = 60 + 59/12 = 64.92)
    expect(monthlyData[59].superInc).toBeCloseTo(
      (p.annualSuper / 12) * 0.5 * Math.pow(1 + monthlyInflationRate, 59), 4
    );
  });

  test('super income jumps to 100% the month the second partner qualifies', () => {
    // P1 aged 65 at start, P2 aged 64 → P2 qualifies at m=12 (age = 65.0)
    const p = { ...BASE, ageP1: 65, ageP2: 64 };
    const { monthlyData } = calculateProjections(p);

    // m=11: P2 age = 64 + 11/12 = 64.917 — not yet
    expect(monthlyData[11].superInc).toBeCloseTo(
      (p.annualSuper / 12) * 0.5 * Math.pow(1 + monthlyInflationRate, 11), 4
    );

    // m=12: P2 age = 64 + 12/12 = 65.0 — both eligible
    expect(monthlyData[12].superInc).toBeCloseTo(
      (p.annualSuper / 12) * 1.0 * Math.pow(1 + monthlyInflationRate, 12), 4
    );
  });

  // ─── 9. Surplus super reinvestment (FIX #3) ─────────────────────────────────

  test('when super income exceeds spend, netDraw is zero and surplus grows the portfolio', () => {
    // Both on super, spending very low → large monthly surplus
    const p = {
      ...BASE,
      ageP1:        65,
      ageP2:        65,
      annualSuper:  120000,  // $10,000/month super
      p1Spend:      2000,    // well below super income
      p1Holiday:    0,
      p1Emergency:  0,
    };
    const { monthlyData } = calculateProjections(p);
    const m0 = monthlyData[0];

    // netDraw must be floored at zero
    expect(m0.netDraw).toBe(0);

    // Surplus = superInc - spend ≈ $10,000 - $2,000 = $8,000
    const superSurplus = m0.superInc - m0.spend;
    expect(superSurplus).toBeGreaterThan(0);

    // Portfolio should be larger than startBalance after Month 1
    // (investment gains + surplus super added in)
    expect(m0.endCap).toBeGreaterThan(p.startBalance);
  });

  test('surplus super rebuilds a depleted portfolio', () => {
    // Force depletion early, then super kicks in and should start rebuilding
    const p = {
      ...BASE,
      startBalance:  1,         // essentially zero from the start
      ageP1:         65,
      ageP2:         65,
      annualSuper:   120000,    // $10,000/month super
      p1Spend:       2000,
      p1Holiday:     0,
      p1Emergency:   0,
    };
    const { monthlyData } = calculateProjections(p);

    // With startBalance=1 the very first month is technically depleted,
    // but surplus super of ~$8,000 should make endCap > 0.
    expect(monthlyData[0].endCap).toBeGreaterThan(0);

    // And it should keep growing
    expect(monthlyData[11].endCap).toBeGreaterThan(monthlyData[0].endCap);
  });

  // ─── 10. Capital injection (FIX #2) ─────────────────────────────────────────

  test('injection occurs only at the last month of the specified year', () => {
    const p = { ...BASE, secondaryCapAmount: 100000, secondaryCapYear: 2 };
    const { monthlyData } = calculateProjections(p);

    // Year 2 last month = m=23
    expect(monthlyData[23].injection).toBeGreaterThan(0);
    // Surrounding months must have zero injection
    expect(monthlyData[22].injection).toBe(0);
    expect(monthlyData[24].injection).toBe(0);
  });

  test('injection inflation uses m+1 months (FIX #2): end of Year 1 = 12 months of inflation', () => {
    const p = { ...BASE, secondaryCapAmount: 100000, secondaryCapYear: 1 };
    const { monthlyData, yearlyData } = calculateProjections(p);

    const month12 = monthlyData[11]; // m=11, end of Year 1
    const month13 = monthlyData[12];
    const year1   = yearlyData[0];
    const year2   = yearlyData[1];

    // Inflation over 12 full months (m+1 = 11+1 = 12)
    const expectedInjection = 100000 * Math.pow(1 + monthlyInflationRate, 12);
    expect(month12.injection).toBeCloseTo(expectedInjection, 2);

    // Balance chain is preserved through injection month
    expect(month12.endCap).toBeCloseTo(month13.startCap, 5);
    expect(year1.endCap).toBeCloseTo(year2.startCap, 5);

    // Accounting identity on injection month
    const superSurplus = Math.max(0, month12.superInc - month12.spend);
    const computed = month12.startCap - month12.netDraw + month12.netGain + superSurplus + month12.injection;
    expect(computed).toBeCloseTo(month12.endCap, 5);
  });

  // ─── 11. Capital depletion ───────────────────────────────────────────────────

  test('yearsDepleted is null when the portfolio survives all 50 years', () => {
    // High balance, very low spend, good returns — provably survives 50 years.
    const p = {
      ...BASE,
      startBalance:   10000000,
      p1Spend:        1000,
      p1Holiday:      0,
      p1Emergency:    0,
      p2Spend:        1000,
      p2Holiday:      0,
      p2Emergency:    0,
      p3Spend:        1000,
      p3Holiday:      0,
      p3Emergency:    0,
    };
    const { yearsDepleted } = calculateProjections(p);
    expect(yearsDepleted).toBeNull();
  });

  test('yearsDepleted correctly identifies the year the portfolio first hits zero', () => {
    const p = {
      ...BASE,
      startBalance:   10000,
      p1Spend:        100000,   // far exceeds any return or super
      p1Holiday:      0,
      p1Emergency:    0,
      annualSuper:    0,
    };
    const { yearsDepleted, monthlyData } = calculateProjections(p);

    expect(yearsDepleted).not.toBeNull();

    // Engine computes: yearsDepleted = Math.ceil((m+1) / 12)
    const firstDepletedM = monthlyData.findIndex(r => r.endCap === 0);
    expect(yearsDepleted).toBe(Math.ceil((firstDepletedM + 1) / 12));
  });

  test('portfolio stays at zero after depletion (when no super surplus exists)', () => {
    const p = {
      ...BASE,
      startBalance:   10000,
      p1Spend:        100000,
      p1Holiday:      0,
      p1Emergency:    0,
      annualSuper:    0,
      secondaryCapAmount: 0,
    };
    const { monthlyData } = calculateProjections(p);

    const firstDepletedM = monthlyData.findIndex(r => r.endCap === 0);
    for (let i = firstDepletedM; i < monthlyData.length; i++) {
      expect(monthlyData[i].endCap).toBe(0);
      expect(monthlyData[i].grossGain).toBe(0);
      expect(monthlyData[i].netGain).toBe(0);
    }
  });

  // ─── 12. Edge cases ──────────────────────────────────────────────────────────

  test('zero gross return rate produces no investment gains in any month', () => {
    const p = { ...BASE, grossReturnRate: 0, taxRate: 0 };
    const { monthlyData } = calculateProjections(p);
    for (const row of monthlyData) {
      expect(row.grossGain).toBeCloseTo(0, 8);
      expect(row.netGain).toBeCloseTo(0, 8);
      expect(row.taxPaid).toBeCloseTo(0, 8);
    }
  });

  test('zero tax rate means taxPaid is zero and grossGain equals netGain', () => {
    const p = { ...BASE, taxRate: 0 };
    const { monthlyData } = calculateProjections(p);
    for (const row of monthlyData) {
      expect(row.taxPaid).toBeCloseTo(0, 8);
      expect(row.grossGain).toBeCloseTo(row.netGain, 8);
    }
  });

});
