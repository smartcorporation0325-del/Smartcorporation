import { createProspectAction } from "../actions";

const STATUSES = [
  "new_lead",
  "contacted",
  "meeting_scheduled",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
];

const STATUS_LABELS: Record<string, string> = {
  new_lead: "New Lead",
  contacted: "Contacted",
  meeting_scheduled: "Meeting Scheduled",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export default function NewProspectPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink">Add Prospect</h1>
      <form action={createProspectAction} className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Company *</label>
          <input name="company" required className="input" />
        </div>
        <div>
          <label className="label">Contact</label>
          <input name="contact" className="input" />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" name="email" className="input" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="phone" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Service Interested In</label>
          <input name="service_interested" className="input" />
        </div>
        <div>
          <label className="label">Estimated Value</label>
          <input type="number" step="0.01" name="estimated_value" className="input" />
        </div>
        <div>
          <label className="label">Billing Model</label>
          <select name="billing_model" className="input" defaultValue="">
            <option value="">—</option>
            <option value="hourly">Hourly</option>
            <option value="fixed_monthly">Fixed Monthly</option>
            <option value="project">Project</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" className="input" defaultValue="new_lead">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Next Follow-Up</label>
          <input type="date" name="next_follow_up" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={3} className="input" />
        </div>
        <div className="flex justify-end gap-3 sm:col-span-2">
          <a href="/prospects" className="btn-secondary">
            Cancel
          </a>
          <button type="submit" className="btn-primary">
            Add Prospect
          </button>
        </div>
      </form>
    </div>
  );
}
