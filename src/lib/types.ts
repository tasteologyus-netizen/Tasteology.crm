export type LeadSource = "manual" | "calendly";
export type LeadStatus = "new" | "pending" | "booked" | "quoted" | "won";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "pending",
  "booked",
  "quoted",
  "won",
];
export const LEAD_SOURCES: LeadSource[] = ["manual", "calendly"];

export interface Freelancer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  project_brief: string | null;
  zoom_link: string | null;
  source: LeadSource;
  status: LeadStatus;
  meeting_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  client_id: string;
  label: string;
  sort_order: number;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface FreelancerPayment {
  id: string;
  client_id: string;
  freelancer_id: string | null;
  label: string;
  sort_order: number;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
}

/** One freelancer assigned to a project, with their fee. */
export interface ClientFreelancer {
  id: string;
  client_id: string;
  freelancer_id: string;
  fee: number;
  created_at: string;
  freelancer?: Freelancer | null;
}

export interface Client {
  id: string;
  lead_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  project_brief: string | null;
  zoom_link: string | null;
  total_amount: number;
  /** @deprecated Prefer client_freelancers — kept for backward compat */
  freelancer_id: string | null;
  /** @deprecated Prefer client_freelancers[].fee */
  freelancer_payment: number;
  freelancer_paid: boolean;
  freelancer_paid_at: string | null;
  won_at: string;
  created_at: string;
}

export interface ClientWithRelations extends Client {
  payments: Payment[];
  freelancer_payments: FreelancerPayment[];
  client_freelancers: ClientFreelancer[];
  /** @deprecated Prefer client_freelancers */
  freelancer: Freelancer | null;
}
