import { getHubSpotService, isHubSpotConfigured } from "@/services/hubspot";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getManualCallById, updateManualCall } from "@/lib/data/manual-store";
import { getCallById } from "@/lib/data/calls";
import { titleCase } from "@/lib/utils";
import type { CallWithRelations } from "@/types/db";

// ============================================================================
// Approve & Push to HubSpot (Section 8). Never runs automatically — only from the
// manager clicking "Approve & Push" after reviewing exactly what will be written.
// Idempotent: once a call has hubspot_synced_at set, a repeat push is a no-op that
// returns the original result instead of creating a second note/task.
// ============================================================================

export const PUSHABLE_FIELDS = ["summary", "objection", "buyingIntent", "nextAction", "score", "followUpTask"] as const;
export type PushableField = (typeof PUSHABLE_FIELDS)[number];

export interface PushPreview {
  fields: Record<PushableField, string>;
  alreadySynced: boolean;
  syncedAt: string | null;
  canPush: boolean;
  blockReason: string | null;
}

export function buildPushPreview(call: CallWithRelations): PushPreview {
  const a = call.analysis;
  const topObjection = a?.objections[0];
  const nextAction = a?.next_actions.find((n) => !n.completed) ?? a?.next_actions[0];

  const fields: Record<PushableField, string> = {
    summary: a?.summary ?? "—",
    objection: topObjection ? `${titleCase(topObjection.objection_type ?? "")}: ${topObjection.objection_text ?? ""}` : "No objection detected.",
    buyingIntent: a?.buying_intent ? titleCase(a.buying_intent) : "Unknown",
    nextAction: nextAction ? `${nextAction.action} (${nextAction.owner}${nextAction.due_date ? `, due ${nextAction.due_date.slice(0, 10)}` : ""})` : "No next action recorded.",
    score: a?.overall_score != null ? `${a.overall_score}/100` : "—",
    followUpTask: nextAction ? `Create HubSpot task: "${nextAction.action}"` : "No task to create.",
  };

  let blockReason: string | null = null;
  if (!a) blockReason = "This call has no completed analysis yet.";
  else if (!call.contact?.hubspot_contact_id) blockReason = "No HubSpot contact is associated with this call yet — use “Associate HubSpot contact” on the CRM Context tab first.";
  else if (!isHubSpotConfigured()) blockReason = "HubSpot is not connected — add HUBSPOT_ACCESS_TOKEN in Settings > Integrations to actually push. This preview shows exactly what would be written.";

  return {
    fields,
    alreadySynced: Boolean(a?.hubspot_synced_at),
    syncedAt: a?.hubspot_synced_at ?? null,
    canPush: Boolean(a) && Boolean(call.contact?.hubspot_contact_id),
    blockReason,
  };
}

export interface PushResult {
  status: "success" | "skipped" | "failed";
  message: string;
  noteId?: string | null;
  taskId?: string | null;
  syncedAt?: string | null;
}

export async function pushAnalysisToHubSpot(callId: string, selected: PushableField[]): Promise<PushResult> {
  const call = await getCallById(callId);
  if (!call || !call.analysis) return { status: "failed", message: "Call or analysis not found." };
  const a = call.analysis;

  if (a.hubspot_synced_at) {
    return {
      status: "skipped",
      message: `Already synced to HubSpot on ${new Date(a.hubspot_synced_at).toLocaleString()} — not creating a duplicate note or task.`,
      noteId: a.hubspot_note_id,
      taskId: a.hubspot_task_id,
      syncedAt: a.hubspot_synced_at,
    };
  }

  if (!isHubSpotConfigured()) {
    return { status: "failed", message: "HubSpot is not connected. Add HUBSPOT_ACCESS_TOKEN in Settings > Integrations, then try again." };
  }
  if (!call.contact?.hubspot_contact_id) {
    return { status: "failed", message: "No HubSpot contact is associated with this call yet — associate one from the CRM Context tab first." };
  }

  const preview = buildPushPreview(call);
  const noteLines: string[] = ["Elite Marry Me — AI Call Analysis"];
  if (selected.includes("summary")) noteLines.push(`Summary: ${preview.fields.summary}`);
  if (selected.includes("objection")) noteLines.push(`Primary objection: ${preview.fields.objection}`);
  if (selected.includes("buyingIntent")) noteLines.push(`Buying intent: ${preview.fields.buyingIntent}`);
  if (selected.includes("nextAction")) noteLines.push(`Recommended next action: ${preview.fields.nextAction}`);
  if (selected.includes("score")) noteLines.push(`AI call score: ${preview.fields.score}`);

  const hubspot = getHubSpotService();
  let noteId: string | null = null;
  let taskId: string | null = null;

  try {
    if (noteLines.length > 1) {
      const note = await hubspot.createNoteForContact(call.contact.hubspot_contact_id, noteLines.join("\n"));
      noteId = "id" in note ? note.id : null;
    }

    if (selected.includes("followUpTask")) {
      const nextAction = a.next_actions.find((n) => !n.completed) ?? a.next_actions[0];
      if (nextAction) {
        const task = await hubspot.createTaskForContact(call.contact.hubspot_contact_id, {
          subject: `Elite Marry Me follow-up: ${nextAction.action}`,
          body: nextAction.close_strategy ?? nextAction.action ?? "",
          dueDate: nextAction.due_date,
          priority: nextAction.priority ?? "medium",
          ownerId: call.sales_rep?.hubspot_owner_id ?? null,
        });
        taskId = "id" in task ? task.id : null;
      }
    }
  } catch (err) {
    return { status: "failed", message: err instanceof Error ? err.message : String(err) };
  }

  const syncedAt = new Date().toISOString();
  await persistPushResult(callId, { syncedAt, noteId, taskId, selected });

  return {
    status: "success",
    message: "Successfully synced to HubSpot.",
    noteId,
    taskId,
    syncedAt,
  };
}

async function persistPushResult(
  callId: string,
  result: { syncedAt: string; noteId: string | null; taskId: string | null; selected: PushableField[] }
) {
  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();
    if (!admin) return;
    const { data: call } = await admin.from("calls").select("id").eq("id", callId).maybeSingle();
    if (!call) return;
    await admin
      .from("call_analyses")
      .update({
        hubspot_synced_at: result.syncedAt,
        hubspot_note_id: result.noteId,
        hubspot_task_id: result.taskId,
        hubspot_pushed_fields: result.selected,
      })
      .eq("call_id", callId);
    return;
  }

  const existing = getManualCallById(callId);
  if (!existing?.analysis) return;
  updateManualCall(callId, (c) => ({
    ...c,
    analysis: c.analysis
      ? {
          ...c.analysis,
          hubspot_synced_at: result.syncedAt,
          hubspot_note_id: result.noteId,
          hubspot_task_id: result.taskId,
          hubspot_pushed_fields: result.selected,
        }
      : c.analysis,
  }));
}
