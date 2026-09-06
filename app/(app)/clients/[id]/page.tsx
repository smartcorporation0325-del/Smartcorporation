import { notFound } from "next/navigation";
import ClientForm from "../ClientForm";
import { updateClientAction } from "../actions";
import { getClient, getTeamMembers } from "@/lib/data";

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const [client, teamMembers] = await Promise.all([getClient(params.id), getTeamMembers()]);

  if (!client) notFound();

  const boundAction = updateClientAction.bind(null, client.id);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink">Edit Client</h1>
      <ClientForm client={client} teamMembers={teamMembers} action={boundAction} />
    </div>
  );
}
