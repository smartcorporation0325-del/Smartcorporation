import ClientForm from "../ClientForm";
import { createClientAction } from "../actions";
import { getTeamMembers } from "@/lib/data";

export default async function NewClientPage() {
  const teamMembers = await getTeamMembers();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink">Add Client</h1>
      <ClientForm teamMembers={teamMembers} action={createClientAction} />
    </div>
  );
}
