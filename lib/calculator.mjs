/**
 * Core mathematical engine for the NZ Retirement Planner.
 */

/**
 * Calculates retirement projections based on input parameters.
 * @param {Object} p - Input parameters
 * @returns {Object} { yearlyData, monthlyData, yearsDepleted }
 */
export function calculateProjections(p) {
  const monthlyData = [];
  const yearlyData = [];

  let currentBalance = p.startBalance;
  
  // Geometric compounding math patch
  const netAnnualRate = Math.max(0, p.grossReturnRate - p.taxRate);
  const monthlyNetRate = Math.pow(1 + netAnnualRate, 1/12) - 1;
  const monthlyGrossRate = Math.pow(1 + p.grossReturnRate, 1/12) - 1;
  const monthlyInflationRate = Math.pow(1 + p.inflationRate, 1/12) - 1;

  let yearsDepleted = null;

  for (let m = 0; m < 600; m++) {
    const yearIndex = Math.floor(m / 12);

    const age1 = p.ageP1 + (m / 12);
    const age2 = p.ageP2 + (m / 12);

    let baseMonthlySpend = p.p3Spend;
    let yearlyExtra = p.p3Holiday + p.p3Emergency;
    let additionalMonthlyIncome = p.p3Inc || 0; // Net income (after tax)

    if (yearIndex < p.p1Years) {
      baseMonthlySpend = p.p1Spend;
      yearlyExtra = p.p1Holiday + p.p1Emergency;
      additionalMonthlyIncome = p.p1Inc || 0; // Net income (after tax)
    } else if (yearIndex < (p.p1Years + p.p2Years)) {
      baseMonthlySpend = p.p2Spend;
      yearlyExtra = p.p2Holiday + p.p2Emergency;
      additionalMonthlyIncome = p.p2Inc || 0; // Net income (after tax)
    }

    const inflationMult = Math.pow(1 + monthlyInflationRate, m);
    const monthlySpend = (baseMonthlySpend + (yearlyExtra / 12)) * inflationMult;
    const monthlyAddIncome = additionalMonthlyIncome * inflationMult;

    let superEligibleRatio = 0;
    if (age1 >= p.superAgeP1) superEligibleRatio += 0.5;
    if (age2 >= p.superAgeP2) superEligibleRatio += 0.5;

    const monthlySuperIncome = ((p.annualSuper / 12) * superEligibleRatio) * inflationMult;
    const totalMonthlyIncome = monthlySuperIncome + monthlyAddIncome;

    // FIX #3: Track surplus super income so it can be reinvested into the portfolio
    const superSurplus = Math.max(0, totalMonthlyIncome - monthlySpend);
    const netDraw = Math.max(0, monthlySpend - totalMonthlyIncome);

    const startCap = currentBalance;
    let grossGain = 0;
    let taxPaid = 0;
    let netGain = 0;
    let endCap = 0;

    if (startCap > 0) {
      const taxableBase = Math.max(0, startCap - (netDraw / 2));

      // Direct calculation of net growth using net compounding rate
      netGain = taxableBase * monthlyNetRate;
      grossGain = taxableBase * monthlyGrossRate;
      taxPaid = grossGain - netGain;

      // FIX #3: Add surplus super back into the portfolio
      endCap = startCap - netDraw + netGain + superSurplus;

      if (endCap <= 0) {
        endCap = 0;
        if (yearsDepleted === null) {
          yearsDepleted = Math.ceil((m + 1) / 12);
        }
      }
    } else {
      // FIX #3: Even a depleted portfolio can be rebuilt by surplus super income
      endCap = superSurplus;
    }

    let injection = 0;
    if (m === (p.secondaryCapYear - 1) * 12 + 11) {
      // FIX #2: Use m+1 so end-of-year injections reflect the full elapsed year of
      // inflation (e.g. end of Year 1 = 12 months elapsed → (1+r)^12, not 11).
      injection = p.secondaryCapAmount * Math.pow(1 + monthlyInflationRate, m + 1);
      endCap += injection;
    }

    currentBalance = endCap;

    monthlyData.push({
      monthIdx: m + 1,
      ageP1: Math.floor(age1),
      ageP2: Math.floor(age2),
      startCap,
      spend: monthlySpend,
      superInc: monthlySuperIncome,
      addInc: monthlyAddIncome,
      netDraw,
      grossGain,
      taxPaid,
      netGain,
      endCap: currentBalance,
      injection
    });
  }

  for (let y = 0; y < 50; y++) {
    const yearMonths = monthlyData.slice(y * 12, (y + 1) * 12);
    if (!yearMonths.length) break;

    const startCap = yearMonths[0].startCap;
    const endCap = yearMonths[11].endCap;
    const spend = yearMonths.reduce((acc, row) => acc + row.spend, 0);
    const superInc = yearMonths.reduce((acc, row) => acc + row.superInc, 0);
    const addInc = yearMonths.reduce((acc, row) => acc + row.addInc, 0);
    const netDraw = yearMonths.reduce((acc, row) => acc + row.netDraw, 0);
    const grossGain = yearMonths.reduce((acc, row) => acc + row.grossGain, 0);
    const taxPaid = yearMonths.reduce((acc, row) => acc + row.taxPaid, 0);
    const netGain = yearMonths.reduce((acc, row) => acc + row.netGain, 0);
    const injection = yearMonths.reduce((acc, row) => acc + row.injection, 0);

    yearlyData.push({
      yearIdx: y,
      ageP1: p.ageP1 + y,
      ageP2: p.ageP2 + y,
      startCap,
      spend,
      superInc,
      addInc,
      netDraw,
      grossGain,
      taxPaid,
      netGain,
      endCap,
      injection
    });
  }

  return { yearlyData, monthlyData, yearsDepleted };
}
