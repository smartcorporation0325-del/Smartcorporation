export interface HubSpotContact {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  phone: string | null;
  lifecycleStage: string | null;
}

export interface HubSpotDeal {
  id: string;
  dealName: string | null;
  pipeline: string | null;
  stage: string | null;
  amount: number | null;
  ownerId: string | null;
  closeDate: string | null;
  status: "open" | "closed_won" | "closed_lost";
  leadSource: string | null;
}

export interface HubSpotOwner {
  id: string;
  name: string;
  email: string | null;
}

export interface HubSpotTask {
  id: string;
  subject: string;
  dueDate: string | null;
  completed: boolean;
}
