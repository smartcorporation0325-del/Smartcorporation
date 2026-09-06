import TeamMemberForm from "../TeamMemberForm";
import { createTeamMemberAction } from "../actions";

export default function NewTeamMemberPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink">Add Team Member</h1>
      <TeamMemberForm action={createTeamMemberAction} />
    </div>
  );
}
