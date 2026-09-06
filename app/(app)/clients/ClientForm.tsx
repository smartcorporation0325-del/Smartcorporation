"use client";

import { useState } from "react";
import type { BillingModel, Client, TeamMember } from "@/lib/types";

const BILLING_MODELS: { value: BillingModel; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "fixed_monthly", label: "Fixed Monthly" },
  { value: "project", label: "Project" },
  { value: "other", label: "Other" },
];

const STATUSES = ["prospect", "active", "paused", "closed"];

export default function ClientForm({
  client,
  teamMembers,
  action,
}: {
  client?: Client;
  teamMembers: TeamMember[];
  action: (formData: FormData) => void;
}) {
  const [billingModel, setBillingModel] = useState(client?.billing_model ?? "hourly");

  return (
    <form action={action} className="card space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-ink">Basics</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Client Name *</label>
            <input
              name="client_name"
              required
              defaultValue={client?.client_name}
              className="input"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="label">Company Name</label>
            <input
              name="company_name"
              defaultValue={client?.company_name ?? ""}
              className="input"
              placeholder="Acme Inc."
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue={client?.status ?? "prospect"} className="input">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Source</label>
            <input name="source" defaultValue={client?.source ?? ""} className="input" placeholder="Referral" />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-ink">Billing</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Billing Model *</label>
            <div className="flex flex-wrap gap-2">
              {BILLING_MODELS.map((bm) => (
                <label
                  key={bm.value}
                  className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    billingModel === bm.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-cloud bg-white text-ink/70 hover:bg-mist"
                  }`}
                >
                  <input
                    type="radio"
                    name="billing_model"
                    value={bm.value}
                    checked={billingModel === bm.value}
                    onChange={() => setBillingModel(bm.value)}
                    className="sr-only"
                  />
                  {bm.label}
                </label>
              ))}
            </div>
          </div>

          {billingModel === "hourly" && (
            <div>
              <label className="label">Hourly Rate</label>
              <input
                type="number"
                step="0.01"
                name="hourly_rate"
                defaultValue={client?.hourly_rate ?? ""}
                className="input"
                placeholder="35.00"
              />
            </div>
          )}

          {billingModel === "fixed_monthly" && (
            <div>
              <label className="label">Monthly Fixed Fee</label>
              <input
                type="number"
                step="0.01"
                name="monthly_fixed_fee"
                defaultValue={client?.monthly_fixed_fee ?? ""}
                className="input"
                placeholder="500.00"
              />
            </div>
          )}

          {billingModel === "project" && (
            <div>
              <label className="label">Project Fee</label>
              <input
                type="number"
                step="0.01"
                name="project_fee"
                defaultValue={client?.project_fee ?? ""}
                className="input"
                placeholder="2000.00"
              />
            </div>
          )}

          <div>
            <label className="label">Payment Status</label>
            <select name="payment_status" defaultValue={client?.payment_status ?? "pending"} className="input">
              <option value="pending">Pending</option>
              <option value="current">Current</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="label">Start Date</label>
            <input type="date" name="start_date" defaultValue={client?.start_date ?? ""} className="input" />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" name="end_date" defaultValue={client?.end_date ?? ""} className="input" />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-ink">Contact &amp; Scope</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Main Contact</label>
            <input name="main_contact" defaultValue={client?.main_contact ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" name="email" defaultValue={client?.email ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" defaultValue={client?.phone ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Assigned Team Member</label>
            <select
              name="assigned_team_member_id"
              defaultValue={client?.assigned_team_member_id ?? ""}
              className="input"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Service / Scope</label>
            <input name="service_scope" defaultValue={client?.service_scope ?? ""} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea name="notes" defaultValue={client?.notes ?? ""} className="input" rows={3} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <a href="/clients" className="btn-secondary">
          Cancel
        </a>
        <button type="submit" className="btn-primary">
          {client ? "Save Changes" : "Add Client"}
        </button>
      </div>
    </form>
  );
}
