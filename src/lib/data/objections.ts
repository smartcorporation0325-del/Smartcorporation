import { getCalls } from "./calls";
import type { CallWithRelations } from "@/types/db";

export interface ObjectionAggregate {
  type: string;
  count: number;
  sharePercent: number;
  handledRate: number;
  wonCount: number;
  lostCount: number;
  calls: CallWithRelations[];
}

export async function getObjectionIntelligence(): Promise<ObjectionAggregate[]> {
  const calls = await getCalls();
  const byType = new Map<string, CallWithRelations[]>();
  let total = 0;

  for (const c of calls) {
    if (!c.analysis) continue;
    for (const o of c.analysis.objections) {
      const key = o.objection_type ?? "other";
      const arr = byType.get(key) ?? [];
      if (!arr.some((x) => x.id === c.id)) arr.push(c);
      byType.set(key, arr);
      total++;
    }
  }

  const results: ObjectionAggregate[] = [];
  for (const [type, typeCalls] of byType) {
    const objectionsOfType = typeCalls.flatMap((c) => c.analysis!.objections.filter((o) => o.objection_type === type));
    const handled = objectionsOfType.filter((o) => o.handled).length;
    results.push({
      type,
      count: objectionsOfType.length,
      sharePercent: total > 0 ? Math.round((objectionsOfType.length / total) * 1000) / 10 : 0,
      handledRate: objectionsOfType.length ? Math.round((handled / objectionsOfType.length) * 100) : 0,
      wonCount: typeCalls.filter((c) => c.deal?.status === "closed_won").length,
      lostCount: typeCalls.filter((c) => c.deal?.status === "closed_lost").length,
      calls: typeCalls,
    });
  }

  return results.sort((a, b) => b.count - a.count);
}
