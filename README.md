# Elite Marry Me — Sales Call Intelligence

Internal sales call intelligence, coaching, QA, and revenue intelligence platform for
Elite Marry Me. Pulls sales calls from Quo (formerly OpenPhone), matches them to
HubSpot CRM context, analyzes the conversation with Claude against a custom scorecard,
and surfaces coaching, objection, and revenue intelligence.

This is a **Phase 1 + Phase 2 MVP**: it runs fully in demo mode with seeded data and
requires no external credentials to explore. Phase 2 adds the Quo/HubSpot sync
orchestration and contact/deal matching engine — wired and testable today, and ready
to go live the moment real credentials are added.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no `.env.local`, you're in
demo mode: 15 seeded Federico calls, the Elite Marry Me scorecard, dashboards, and the
manual transcript → analysis pipeline all work against in-memory data.

## Connecting real services

Copy `.env.example` to `.env.local` and fill in what you have — everything is optional
and additive:

- **Supabase** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) — persists data in Postgres instead of in-memory demo
  data, and enables auth. Run the SQL in `supabase/migrations/` against your project,
  then `npm run seed` to load the same 15 demo calls into real tables.
- **Anthropic** (`ANTHROPIC_API_KEY`) — enables real Claude-driven call analysis.
  Without it, analysis falls back to a deterministic keyword heuristic (clearly
  labeled in the UI) so the pipeline is still fully exercisable.
- **Quo** (`QUO_API_KEY`) — enables call/transcript sync (Phase 2). Without it, use
  the manual call entry flow at `/calls/new`.
- **HubSpot** (`HUBSPOT_ACCESS_TOKEN`) — enables read-only CRM matching (Phase 2).
  HubSpot is never written to in this MVP.

Check connection status any time at `/settings/integrations`.

## Architecture

- `src/services/{quo,hubspot,anthropic}` — adapter layers. Each exposes a stable
  interface; live implementations and demo fallbacks live side by side so missing
  credentials never block the rest of the app.
- `src/lib/pipeline/analyze.ts` — the call analysis pipeline: ingest → normalize →
  associate CRM → prepare AI context → run analysis → validate → store. Source data
  (transcripts, CRM fields) is never overwritten by AI interpretation.
- `src/lib/data/*` — data access layer. Branches on whether Supabase is configured;
  callers (pages, server actions) never care which mode they're in.
- `src/lib/demo/seed-data.ts` — the 15 fictional demo calls for Federico.
- `src/lib/matching/associate.ts` — the contact/deal association engine (phone →
  email → existing local association → manual), writes only to our own tables.
- `src/lib/sync/quo-sync.ts` — shared ingest/sync orchestration used by both the Quo
  webhook and the manual "Sync now" action; idempotent on `quo_call_id`.
- `src/lib/data/sync-logs.ts` — sync log writer/reader (Postgres when Supabase is
  configured, an in-memory demo log otherwise so Sync Now/Test Connection are
  demonstrable either way).
- `supabase/migrations/*.sql` — full relational schema + RLS policies.
- `scripts/seed-supabase.ts` — loads the demo dataset into a real Supabase project.

## What's implemented

**Phase 1** — Dashboard, Calls list + detail (Overview/Scorecard/Transcript/
Objections/Coaching/CRM Context tabs), Coaching Center, Objection Intelligence,
Revenue Intelligence, Ask Your Calls (retrieval-grounded Q&A), Alerts, Settings. Elite
Marry Me scorecard (7 weighted sections, seeded per spec). Manual transcript entry,
paste/upload, and re-run analysis — the fallback that keeps the app usable when
Quo/HubSpot sync isn't available.

**Phase 2** — Quo webhook receiver (`/api/webhooks/quo`) with signature verification
and idempotent ingest; a shared sync orchestrator (`lib/sync/quo-sync.ts`) so the
webhook and a manual "Sync now" button do the same ingest logic; the contact/deal
matching engine (phone → email → existing local association → manual); a manual
"Associate HubSpot contact/deal" search on the call detail CRM Context tab; and
Test Connection / Sync Now buttons + populated sync logs on
`/settings/integrations` and `/settings/sync`.

Quo's live service methods are grounded against the best-verified shape available —
this environment's egress proxy blocks direct access to quo.com's docs, so the
request/response shapes were cross-checked against Quo's own MCP tool contracts
(inbox-scoped calls, `AC…`/`CN…`/`US…`/`PN…` id prefixes, cursor pagination) rather
than guessed from memory. Re-verify against `https://www.quo.com/docs` once you have
a real `QUO_API_KEY` and can reach it, and adjust `services/quo/index.ts` if the
actual endpoints differ.

**Founder features** — a lightweight layer of executive-facing intelligence on top of
Phase 1/2, all computed from structured analysis data already stored (no extra
transcript passes):

- **Founder Snapshot** on the dashboard: Biggest Sales Risk, Best Opportunity, Main
  Objection, Coaching Focus.
- **Hot Lead** detection (`lib/rules/hot-lead.ts`) and **Missed Revenue Opportunity**
  detection (`lib/rules/missed-revenue.ts`) — simple, readable deterministic rules,
  visible on the dashboard, calls list, and call detail.
- **Smart Next Action** — Claude (or the demo heuristic) now returns an operational
  `actionType`/`actionDescription`/`dueDate`/`dueTime`/`owner`/`priority`/
  `closeStrategy`, never inventing a date the client didn't give.
- **Suggested Follow-Up** — a ready-to-copy SMS and email per call (never sent
  automatically).
- **Call Quality Badges** (`lib/rules/badges.ts`) and **Deal Risk**
  (`lib/rules/deal-risk.ts`, deliberately separate from call quality, rule-based, not
  a black-box score).
- **Approve & Push to HubSpot** — a preview of exactly what would be written (summary,
  objection, buying intent, next action, score, follow-up task), with per-field
  opt-out, idempotent on repeat clicks, only ever triggered by an explicit click.
- **Weekly Founder Brief** — last 7 days, plus a short executive summary (Claude
  phrases a handful of aggregate numbers when configured; otherwise a deterministic
  template — never a second transcript pass).
- **Open Opportunity Value** / **Value Requiring Attention**, and a subtle **Demo
  Data** tag so seeded data is never mistaken for production data.
- A flagship **"Founder Demo Call"** (Jordan Ellis — Skyline Rooftop Proposal) built to
  show the full experience at once: a hot lead, a missed close, a price objection, a
  high-risk deal, a specific smart next action, and a ready HubSpot push preview.

## What's next (Phase 3+)

- Webhook-driven automated call ingestion at scale, alert engine notifications.
- Coaching Center / Objection Intelligence enrichment from live sync data volume.
- Scorecard admin editing (create/duplicate/version) beyond the read-only view.
