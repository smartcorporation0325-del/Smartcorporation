"use client";

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

export default function ProspectStatusSelect({
  status,
  action,
}: {
  status: string;
  action: (formData: FormData) => void;
}) {
  return (
    <form
      action={action}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <select name="status" defaultValue={status} className="input w-auto">
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
