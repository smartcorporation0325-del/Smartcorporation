import { createExpenseAction } from "../actions";

const CATEGORIES = ["Team", "Software", "Subscriptions", "Operations", "Banking Fees", "Contractors", "Other"];

export default function NewExpensePage() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink">Add Expense</h1>
      <form action={createExpenseAction} className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Date *</label>
          <input type="date" name="date" required defaultValue={today} className="input" />
        </div>
        <div>
          <label className="label">Category</label>
          <select name="category" className="input" defaultValue="Other">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description *</label>
          <input name="description" required className="input" placeholder="Zoom subscription" />
        </div>
        <div>
          <label className="label">Amount *</label>
          <input type="number" step="0.01" min="0" name="amount" required className="input" placeholder="49.99" />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" id="recurring" name="recurring" className="h-4 w-4" />
          <label htmlFor="recurring" className="text-sm text-ink">
            Recurring
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={3} className="input" />
        </div>
        <div className="flex justify-end gap-3 sm:col-span-2">
          <a href="/expenses" className="btn-secondary">
            Cancel
          </a>
          <button type="submit" className="btn-primary">
            Add Expense
          </button>
        </div>
      </form>
    </div>
  );
}
