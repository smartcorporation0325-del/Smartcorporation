export type BillingModel = "hourly" | "fixed_monthly" | "project" | "other";
export type ClientStatus = "prospect" | "active" | "paused" | "closed";
export type PaymentType = "fixed_monthly" | "profit_share" | "hourly" | "one_time";
export type FixedPaymentStatus = "pending" | "invoiced" | "paid" | "overdue";
export type ProspectStatus =
  | "new_lead"
  | "contacted"
  | "meeting_scheduled"
  | "proposal_sent"
  | "negotiation"
  | "won"
  | "lost";
export type ExpenseCategory =
  | "Team"
  | "Software"
  | "Subscriptions"
  | "Operations"
  | "Banking Fees"
  | "Contractors"
  | "Other";

export interface Settings {
  id: string;
  company_name: string;
  currency: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string | null;
  payment_type: PaymentType;
  monthly_fixed_payment: number;
  hourly_rate: number;
  profit_share_percent: number;
  active: boolean;
}

export interface TeamPayment {
  id: string;
  team_member_id: string;
  month: string; // yyyy-mm-01
  amount: number;
  note: string | null;
}

export interface Client {
  id: string;
  client_name: string;
  company_name: string | null;
  status: ClientStatus;
  billing_model: BillingModel;
  hourly_rate: number;
  monthly_fixed_fee: number;
  project_fee: number;
  start_date: string | null;
  end_date: string | null;
  main_contact: string | null;
  email: string | null;
  phone: string | null;
  service_scope: string | null;
  assigned_team_member_id: string | null;
  notes: string | null;
  source: string | null;
  payment_status: string | null;
}

export interface TimeEntry {
  id: string;
  client_id: string;
  month: string;
  hours_worked: number;
  hourly_rate: number;
  total_revenue: number;
}

export interface FixedBilling {
  id: string;
  client_id: string;
  month: string;
  monthly_fee: number;
  payment_status: FixedPaymentStatus;
  due_date: string | null;
  amount_paid: number;
}

export interface Expense {
  id: string;
  date: string;
  month: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  recurring: boolean;
  notes: string | null;
}

export interface Prospect {
  id: string;
  company: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  service_interested: string | null;
  estimated_value: number;
  billing_model: BillingModel | null;
  status: ProspectStatus;
  next_follow_up: string | null;
  notes: string | null;
  converted_client_id: string | null;
}
