import { calculateProjections } from '../lib/calculator.mjs';

describe('calculateProjections', () => {
  const defaultParams = {
    startBalance: 1500000,
    grossReturnRate: 0.04,
    taxRate: 0.008,
    inflationRate: 0.025,
    ageP1: 59,
    ageP2: 53,
    superAgeP1: 65,
    superAgeP2: 65,
    annualSuper: 40000,
    secondaryCapAmount: 0,
    secondaryCapYear: 10,
    p1Years: 10,
    p2Years: 10,
    p1Spend: 9000,
    p2Spend: 6000,
    p3Spend: 4000,
    p1Holiday: 20000,
    p1Emergency: 5000,
    p2Holiday: 10000,
    p2Emergency: 5000,
    p3Holiday: 2000,
    p3Emergency: 5000
  };

  test('should return 600 months of data', () => {
    const result = calculateProjections(defaultParams);
    expect(result.monthlyData.length).toBe(600);
  });

  test('should return 50 years of data', () => {
    const result = calculateProjections(defaultParams);
    expect(result.yearlyData.length).toBe(50);
  });

  test('should handle secondary capital injection and maintain balance consistency', () => {
    const params = { ...defaultParams, secondaryCapAmount: 100000, secondaryCapYear: 1 };
    const result = calculateProjections(params);
    
    // Injection at end of Year 1 (Month 12)
    const month12 = result.monthlyData[11];
    const month13 = result.monthlyData[12];
    const year1 = result.yearlyData[0];
    const year2 = result.yearlyData[1];

    expect(month12.injection).toBeGreaterThan(0);
    
    // Inflation adjustment: (1 + monthlyRate) ^ 11 for Month 12
    const monthlyInflationRate = Math.pow(1 + params.inflationRate, 1/12) - 1;
    const expectedInjection = 100000 * Math.pow(1 + monthlyInflationRate, 11);
    expect(month12.injection).toBeCloseTo(expectedInjection, 2);

    // Consistency: End balance of period MUST match start balance of next period
    expect(month12.endCap).toBeCloseTo(month13.startCap, 5);
    expect(year1.endCap).toBeCloseTo(year2.startCap, 5);

    // Balance calculation: startCap - netDraw + netGain + injection = endCap
    expect(month12.startCap - month12.netDraw + month12.netGain + month12.injection).toBeCloseTo(month12.endCap, 5);
    expect(year1.startCap - year1.netDraw + year1.netGain + year1.injection).toBeCloseTo(year1.endCap, 5);
  });

  test('should deplete capital if spending is too high', () => {
    const params = { ...defaultParams, p1Spend: 100000 };
    const result = calculateProjections(params);
    expect(result.yearsDepleted).not.toBeNull();
    expect(result.yearsDepleted).toBeLessThan(50);
  });

  test('should correctly transition between phases', () => {
    const params = { ...defaultParams, p1Years: 5, p2Years: 5 };
    const result = calculateProjections(params);
    
    // Year 1 (Phase 1)
    const year1 = result.yearlyData[0];
    const expectedSpendY1 = (9000 + (25000 / 12)) * 12; // Base + yearly extra
    // Inflation not applied to base in my manual check here but applied in code
    // Let's check ratios or something more stable if inflation is applied monthly.
    
    // Phase 1: Months 0-59 (5 years)
    // Phase 2: Months 60-119 (5 years)
    // Phase 3: Months 120+
    
    const month1 = result.monthlyData[0];
    const month61 = result.monthlyData[60];
    const month121 = result.monthlyData[120];
    
    // Spend should be different (inflation aside)
    // Month 1 spend: (9000 + 25000/12) * 1.0 = 11083.33
    expect(month1.spend).toBeCloseTo(9000 + 25000/12, 1);
    
    // Month 61 spend: (6000 + 15000/12) * inflation
    // Month 121 spend: (4000 + 7000/12) * inflation
    expect(month61.spend / Math.pow(Math.pow(1.025, 1/12), 60)).toBeCloseTo(6000 + 15000/12, 1);
    expect(month121.spend / Math.pow(Math.pow(1.025, 1/12), 120)).toBeCloseTo(4000 + 7000/12, 1);
  });
});
