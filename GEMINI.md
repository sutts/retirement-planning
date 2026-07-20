# NZ Retirement Income & Capital Planner — Developer & AI Guide

This document provides a technical overview of the codebase, explanation of the core calculation logic, file mapping, and guidance for future modifications or AI-assisted development.

---

## 📂 Codebase Structure

The project is a lightweight, frontend-only application structured as follows:

```
retirement-planning/
├── index.html               # Main UI, responsive layout, chart rendering, and scenario manager
├── package.json             # Project metadata, scripts, and dependencies (Jest)
├── lib/
│   └── calculator.mjs       # Core math engine (isolated, stateless calculation function)
└── tests/
    └── calculator.test.mjs  # Jest test suite for testing the math engine
```

---

## ⚙️ Core Mathematical Engine (`lib/calculator.mjs`)

The calculation engine is entirely stateless. Given an object of parameters `p`, it projects cashflow and balance over a 50-year horizon (600 months).

### 1. Spending Phases
The planner models three spending phases:
- **Phase 1 (Active):** Months $0$ to $(P_1 \times 12)$
- **Phase 2 (Passive):** Months $(P_1 \times 12)$ to $((P_1 + P_2) \times 12)$
- **Phase 3 (Supportive):** Remaining months up to 600

Monthly spend is computed by summing the phase's base monthly spend and the yearly extra (holidays + emergencies) divided by 12, then compounding with monthly inflation:
$$\text{Monthly Spend} = \left(\text{Base Spend} + \frac{\text{Yearly Extra}}{12}\right) \times (1 + r_{\text{inflation\_monthly}})^m$$
Where:
$$r_{\text{inflation\_monthly}} = (1 + r_{\text{inflation\_annual}})^{1/12} - 1$$

### 2. NZ Superannuation Eligibility
Superannuation is split 50/50 between Partner 1 and Partner 2:
- If Partner 1's age $\ge$ Partner 1's eligibility age, eligibility increases by $0.5$.
- If Partner 2's age $\ge$ Partner 2's eligibility age, eligibility increases by $0.5$.

$$\text{Monthly Super Income} = \left(\frac{\text{Annual Super}}{12} \times \text{Eligibility Ratio}\right) \times (1 + r_{\text{inflation\_monthly}})^m$$

### 3. Investment Return & Tax Drag
Returns and taxes are calculated monthly using geometric compounding:
- **Net Annual Rate:** $r_{\text{net}} = \max(0, r_{\text{gross}} - r_{\text{tax\_drag}})$
- **Monthly Net Rate:** $m_{\text{net}} = (1 + r_{\text{net}})^{1/12} - 1$
- **Monthly Gross Rate:** $m_{\text{gross}} = (1 + r_{\text{gross}})^{1/12} - 1$

For months where the starting balance is positive:
- **Taxable Base:** $\max(0, \text{Start Capital} - \frac{\text{Net Draw}}{2})$ (assumes net withdrawal is spread across the month)
- **Net Gain:** $\text{Taxable Base} \times m_{\text{net}}$
- **Gross Gain:** $\text{Taxable Base} \times m_{\text{gross}}$
- **Tax Paid:** $\text{Gross Gain} - \text{Net Gain}$
- **Ending Capital:** $\text{Start Capital} - \text{Net Draw} + \text{Net Gain}$

### 4. Capital Injections
A lump sum injection occurs at the *end* of the specified year (Month 12 of the year index):
$$\text{Ending Capital} = \text{Ending Capital} + (\text{Injection Amount} \times (1 + r_{\text{inflation\_monthly}})^m)$$

---

## 🎨 User Interface & State (`index.html`)

- **Styling:** Uses Tailwind CSS via CDN.
- **Charts:**
  - **Capital Trajectory:** Drawn using a native responsive SVG path.
  - **Cashflow Breakdown:** Generated using CSS flexbox columns representing annual spend vs. NZ Super income.
- **Data Persistence:**
  - Saves current workspace parameters automatically to `localStorage` (`nz_retirement_planner_state`).
  - Implements a local scenario manager allowing users to save, name, update, delete, and download/upload scenarios as a JSON file.
- **Exports:**
  - **CSV Export:** Extracts yearly/monthly projection data to a spreadsheet-compatible format.
  - **PDF Export:** Uses `html2pdf.js` to render a print-friendly version of the planner.

---

## 🛠️ Developer Reference

### Prerequisites
- Node.js (v14 or higher)

### Setup & Testing
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run tests:
   ```bash
   npm test
   ```

---

## 🤖 Guidelines for AI Assistants

When modifying this repository, observe the following:
1. **Mathematical Isolation:** Keep all math models inside `lib/calculator.mjs`. Do not perform calculation projections inside `index.html`.
2. **ES Modules:** Use `.mjs` extensions for JavaScript modules to ensure Jest runs correctly with the `--experimental-vm-modules` flag.
3. **Preserve State Parameters:** Ensure any input additions/deletions in `index.html` are added to/removed from `inputIds` and `DEFAULT_PARAMS` so local storage state syncs properly.
4. **Test Maintenance:** When modifying calculation parameters or formulas, update `tests/calculator.test.mjs` accordingly to maintain 100% coverage of the calculation scenarios.
