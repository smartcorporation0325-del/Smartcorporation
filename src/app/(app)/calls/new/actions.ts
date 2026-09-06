"use server";

import { redirect } from "next/navigation";
import { runManualCallPipeline } from "@/lib/pipeline/analyze";

export async function createManualCallAction(formData: FormData) {
  const input = {
    contactFirstName: String(formData.get("contactFirstName") ?? ""),
    contactLastName: String(formData.get("contactLastName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? "") || undefined,
    contactPhone: String(formData.get("contactPhone") ?? "") || undefined,
    callType: String(formData.get("callType") ?? "Consultation"),
    dealName: String(formData.get("dealName") ?? "") || undefined,
    dealStage: String(formData.get("dealStage") ?? "") || undefined,
    dealAmount: formData.get("dealAmount") ? Number(formData.get("dealAmount")) : undefined,
    dealStatus: (String(formData.get("dealStatus") ?? "open") || "open") as "open" | "closed_won" | "closed_lost",
    transcriptText: String(formData.get("transcriptText") ?? ""),
  };

  const result = await runManualCallPipeline(input);
  if (result.status === "failed" || !result.callId) {
    redirect(`/calls/new?error=${encodeURIComponent(result.error ?? "Analysis failed")}`);
  }
  redirect(`/calls/${result.callId}`);
}
