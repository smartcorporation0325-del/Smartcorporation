import { notFound } from "next/navigation";
import TeamMemberForm from "../TeamMemberForm";
import { updateTeamMemberAction } from "../actions";
import { createClient } from "@/lib/supabase/server";
import type { TeamMember } from "@/lib/types";

export default async function EditTeamMemberPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: member } = await supabase
    .from("team_members")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!member) notFound();

  const boundAction = updateTeamMemberAction.bind(null, params.id);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink">Edit Team Member</h1>
      <TeamMemberForm member={member as TeamMember} action={boundAction} />
    </div>
  );
}
