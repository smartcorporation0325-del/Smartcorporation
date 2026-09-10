-- Lets the app build a direct "Open in Quo" link (https://my.quo.com/inbox/{inboxId}/c/{conversationId})
-- instead of only a tel: link. Neither id was ever stored: quo_inbox_id is Quo's own
-- "PN..." id for the inbox a call came through (distinct from the inbox's phone
-- number, which we do store), and quo_conversation_id is the "CN..." conversation
-- thread id. Both are known only when a call is discovered via the conversation-
-- listing path (the bulk "Sync now" flow), not via a direct per-call fetch (webhook,
-- backfill) — so both are nullable and filled in opportunistically.
alter table calls add column quo_inbox_id text;
alter table calls add column quo_conversation_id text;
