# Elite Marry Me — Sales Call Intelligence

Internal sales call intelligence, coaching, QA, and revenue intelligence platform for
Elite Marry Me. Pulls sales calls from Quo (formerly OpenPhone), matches them to
HubSpot CRM context, analyzes the conversation with Claude against a custom scorecard,
and surfaces coaching, objection, and revenue intelligence.

This is a **Phase 1 MVP**: it runs fully in demo mode with seeded data and requires no
external credentials to explore.

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
- `supabase/migrations/*.sql` — full relational schema + RLS policies.
- `scripts/seed-supabase.ts` — loads the demo dataset into a real Supabase project.

## What's implemented (Phase 1)

- Dashboard, Calls list + detail, Coaching Center, Objection Intelligence, Revenue
  Intelligence, Ask Your Calls (retrieval-grounded Q&A), Alerts, Settings.
- Elite Marry Me scorecard (7 weighted sections, seeded per spec).
- Manual transcript entry, paste/upload, and re-run analysis — the required fallback
  when Quo/HubSpot sync isn't available.
- Quo webhook receiver (`/api/webhooks/quo`) with signature verification and
  idempotent ingest — wired for Phase 2 once `QUO_API_KEY`/`WEBHOOK_SECRET` are set.
- HubSpot read-only service scaffold — wired for Phase 2 once `HUBSPOT_ACCESS_TOKEN`
  is set.

## What's next (Phase 2+)

- Live Quo call/transcript sync and HubSpot contact/deal matching by phone/email.
- Sync Center "test connection" / "sync now" actions and populated sync logs.
- Scorecard admin editing (create/duplicate/version) beyond the read-only view.
