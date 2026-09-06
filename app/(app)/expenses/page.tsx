import Link from "next/link";
import DeleteButton from "@/components/DeleteButton";
import MonthSwitcher from "@/components/MonthSwitcher";
import { currentMonthKey, getExpenses, getSettings } from "@/lib/data";
import { formatCurrency } from "@/lib/finance";
import { deleteExpenseAction } from "./actions";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = searchParams.month ?? currentMonthKey();
  const [expenses, settings] = await Promise.all([getExpenses(month), getSettings()]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink">Expenses</h1>
        <div className="flex items-center gap-3">
          <MonthSwitcher month={month} />
          <Link href="/expenses/new" className="btn-primary">
            + Add Expense
          </Link>
        </div>
      </div>

      <div className="card flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Total Expenses This Month</span>
        <span className="text-lg font-semibold text-danger">{formatCurrency(total, settings.currency)}</span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Recurring</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ink/40">
                  No expenses recorded for this month.
                </td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id}>
                <td className="text-ink/70">{e.date}</td>
                <td className="font-medium text-ink">{e.description}</td>
                <td className="text-ink/70">{e.category}</td>
                <td className="font-semibold text-ink">{formatCurrency(Number(e.amount), settings.currency)}</td>
                <td className="text-ink/70">{e.recurring ? "Yes" : "No"}</td>
                <td className="text-right">
                  <DeleteButton action={deleteExpenseAction.bind(null, e.id)} confirmMessage={`Delete "${e.description}"?`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
