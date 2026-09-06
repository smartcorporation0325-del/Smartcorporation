import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO_SCORECARD_TEMPLATE_ID } from "@/lib/demo/seed-data";
import { ELITE_MARRY_ME_SCORECARD, ELITE_MARRY_ME_SCORECARD_NAME } from "@/lib/demo/scorecard";
import type { ScorecardForPrompt } from "@/services/anthropic";

interface CriterionRow {
  id: string;
  name: string;
  max_score: number;
  guidance: string | null;
  sort_order: number;
}

interface SectionRow {
  id: string;
  name: string;
  weight: number;
  description: string | null;
  scorecard_criteria: CriterionRow[] | null;
}

export interface ScorecardTemplateWithSections {
  id: string;
  name: string;
  description: string | null;
  version: number;
  active: boolean;
  sections: {
    id: string;
    name: string;
    weight: number;
    description: string | null;
    criteria: { id: string; name: string; maxScore: number; guidance: string | null }[];
  }[];
}

function demoTemplate(): ScorecardTemplateWithSections {
  return {
    id: DEMO_SCORECARD_TEMPLATE_ID,
    name: ELITE_MARRY_ME_SCORECARD_NAME,
    description: "Elite Marry Me's standard sales call audit scorecard.",
    version: 1,
    active: true,
    sections: ELITE_MARRY_ME_SCORECARD.map((s, i) => ({
      id: `demo-section-${i}`,
      name: s.name,
      weight: s.weight,
      description: s.description,
      criteria: s.criteria.map((c, j) => ({
        id: `demo-criterion-${i}-${j}`,
        name: c.name,
        maxScore: c.maxScore,
        guidance: c.guidance,
      })),
    })),
  };
}

export async function getActiveScorecardTemplate(): Promise<ScorecardTemplateWithSections> {
  if (!isSupabaseConfigured()) return demoTemplate();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return demoTemplate();

  const { data: template } = await supabase
    .from("scorecard_templates")
    .select("*")
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!template) return demoTemplate();

  const { data: sections } = await supabase
    .from("scorecard_sections")
    .select("*, scorecard_criteria(*)")
    .eq("scorecard_template_id", template.id)
    .order("sort_order", { ascending: true });

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    version: template.version,
    active: template.active,
    sections: (sections ?? []).map((s: SectionRow) => ({
      id: s.id,
      name: s.name,
      weight: s.weight,
      description: s.description,
      criteria: (s.scorecard_criteria ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({ id: c.id, name: c.name, maxScore: c.max_score, guidance: c.guidance })),
    })),
  };
}

export function toScorecardForPrompt(template: ScorecardTemplateWithSections): ScorecardForPrompt {
  return {
    name: template.name,
    sections: template.sections.map((s) => ({
      name: s.name,
      weight: s.weight,
      criteria: s.criteria.map((c) => ({ name: c.name, maxScore: c.maxScore, guidance: c.guidance })),
    })),
  };
}
