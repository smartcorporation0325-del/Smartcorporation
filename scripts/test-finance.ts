// Verifies the exact worked example from the product spec:
//   Revenue: $3,000
//   Luciana: $300
//   Maru: $200
//   Other Expenses: $100
//   Expected -> Profit Available: $2,400 | Marianny: $1,200 | Natalia: $1,200
//
// Run with: npm run test:finance  (uses Node's native TS stripping, no build step)

import { computeMonthlyFinancials } from "../lib/finance.ts";

function assertEqual(actual: number, expected: number, label: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} -> expected ${expected}, got ${actual}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label} = ${actual}`);
  }
}

const result = computeMonthlyFinancials({
  totalRevenue: 3000,
  teamCosts: 300 + 200, // Luciana + Maru
  otherExpenses: 100,
  profitShareMembers: [
    { teamMemberId: "marianny", name: "Marianny", sharePercent: 50 },
    { teamMemberId: "natalia", name: "Natalia", sharePercent: 50 },
  ],
});

console.log("Computed result:", result);

assertEqual(result.profitAvailable, 2400, "Profit Available");
const marianny = result.distributions.find((d) => d.name === "Marianny")!;
const natalia = result.distributions.find((d) => d.name === "Natalia")!;
assertEqual(marianny.amount, 1200, "Marianny Share");
assertEqual(natalia.amount, 1200, "Natalia Share");

// Extra sanity checks:
// 1. Profit is never split before deducting team costs/expenses.
assertEqual(result.teamCosts, 500, "Team Costs (Luciana + Maru)");
assertEqual(result.totalRevenue, 3000, "Total Revenue");

// 2. A loss month still computes without throwing (negative profit allowed).
const lossMonth = computeMonthlyFinancials({
  totalRevenue: 100,
  teamCosts: 300,
  otherExpenses: 50,
  profitShareMembers: [
    { teamMemberId: "marianny", name: "Marianny", sharePercent: 50 },
    { teamMemberId: "natalia", name: "Natalia", sharePercent: 50 },
  ],
});
assertEqual(lossMonth.profitAvailable, -250, "Loss month profit available");

if (process.exitCode === 1) {
  console.error("\nOne or more finance calculations FAILED.");
  process.exit(1);
} else {
  console.log("\nAll finance calculations PASSED.");
}
