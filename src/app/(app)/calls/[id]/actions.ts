"use server";

import { revalidatePath } from "next/cache";
import { rerunAnalysisForCall } from "@/lib/pipeline/analyze";
import { updateManualCall, getManualCallById } from "@/lib/data/manual-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { manuallyAssociateCall } from "@/lib/matching/associate";
import { pushAnalysisToHubSpot, type PushableField } from "@/lib/pipeline/push-to-hubspot";

export async function rerunAnalysisAction(callId: string) {
  const result = await rerunAnalysisForCall(callId);
  revalidatePath(`/calls/${callId}`);
  return result;
}

export async function attachTranscriptAction(callId: string, transcriptText: string) {
  const text = transcriptText.trim();
  if (!text) return { status: "failed" as const, error: "Transcript is empty." };

  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();
    if (!admin) return { status: "failed" as const, error: "Supabase admin client not configured." };
    await admin.from("call_transcripts").insert({ call_id: callId, transcript_text: text, source: "manual_paste" });
    await admin.from("calls").update({ transcript_status: "ready" }).eq("id", callId);
  } else {
    const existing = getManualCallById(callId);
    if (existing) {
      updateManualCall(callId, (c) => ({
        ...c,
        transcript_status: "ready",
        transcript: {
          id: `manual-transcript-${callId}`,
          call_id: callId,
          transcript_text: text,
          transcript_json: null,
          source: "manual_paste",
          speaker_mapping: null,
          created_at: new Date().toISOString(),
        },
      }));
    }
  }

  const result = await rerunAnalysisForCall(callId);
  revalidatePath(`/calls/${callId}`);
  return result;
}

export async function associateContactAction(callId: string, phone: string, email: string) {
  const result = await manuallyAssociateCall(callId, { phone: phone || undefined, email: email || undefined });
  revalidatePath(`/calls/${callId}`);
  return result;
}

export async function pushToHubSpotAction(callId: string, selected: PushableField[]) {
  const result = await pushAnalysisToHubSpot(callId, selected);
  revalidatePath(`/calls/${callId}`);
  return result;
}
