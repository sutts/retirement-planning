# NZ Retirement Income & Capital Planner

An interactive retirement planning tool built with vanilla JavaScript and Tailwind CSS. It allows users to model phased spending, capital injections, and NZ Superannuation with inflation adjustments and tax drag.

## Features

- **Phased Spending:** Define three distinct phases (Active, Passive, Supportive) with different monthly spend, holiday, and emergency budgets.
- **Secondary Capital Injection:** Model lump-sum events like house sales or inheritances.
- **NZ Super:** Automated calculation of NZ Super eligibility and income based on partner ages.
- **Tax Drag:** Monthly approximation of investment tax impact.
- **Interactive Visuals:** Real-time charts for capital trajectory and cashflow breakdown.
- **Detailed Ledger:** Full yearly and monthly breakdown with tooltips explaining every calculation.
- **CSV Export:** Export your projection data for further analysis.

## Development

The core mathematical engine is isolated in `lib/calculator.mjs` and is fully tested.

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later recommended)
- npm (usually comes with Node.js)

### Installation

Install the development dependencies (primarily Jest for testing):

```bash
npm install
```

### Running Tests

To run the automated test suite:

```bash
npm test
```

*Note: The tests use ECMAScript Modules (ESM). The test script in `package.json` handles the necessary configuration.*

## Technology Stack

- **UI:** HTML5, Tailwind CSS
- **Logic:** Vanilla JavaScript (ESM)
- **Testing:** [Jest](https://jestjs.io/)
- **Charts:** Native SVG and CSS-based visualizations