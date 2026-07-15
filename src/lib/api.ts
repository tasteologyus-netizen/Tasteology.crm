import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type {
  Client,
  ClientWithRelations,
  Freelancer,
  FreelancerPayment,
  Lead,
  LeadStatus,
  Payment,
} from "./types";

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
export async function getLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface LeadInput {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  project_brief?: string | null;
  zoom_link?: string | null;
  source: string;
  status: LeadStatus;
  meeting_at?: string | null;
  created_at?: string | null;
}

export async function createLead(input: LeadInput): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateLead(
  id: string,
  input: Partial<LeadInput>
): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Freelancers
// ---------------------------------------------------------------------------
export async function getFreelancers(): Promise<Freelancer[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("freelancers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface FreelancerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
}

export async function createFreelancer(
  input: FreelancerInput
): Promise<Freelancer> {
  const { data, error } = await supabase
    .from("freelancers")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateFreelancer(
  id: string,
  input: Partial<FreelancerInput>
): Promise<Freelancer> {
  const { data, error } = await supabase
    .from("freelancers")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFreelancer(id: string): Promise<void> {
  const { error } = await supabase.from("freelancers").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Clients + payments
// ---------------------------------------------------------------------------
export async function getClients(): Promise<ClientWithRelations[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("clients")
    .select("*, payments(*), freelancer_payments(*), freelancer:freelancers(*)")
    .order("won_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as ClientWithRelations[];
  // keep milestones in a stable order
  rows.forEach((c) => {
    c.payments?.sort((a, b) => a.sort_order - b.sort_order);
    c.freelancer_payments?.sort((a, b) => a.sort_order - b.sort_order);
  });
  return rows;
}

export interface ConvertLeadInput {
  total_amount: number;
  first_payment: number;
  second_payment: number;
  third_payment: number;
  freelancer_id?: string | null;
  freelancer_payment?: number;
}

// Converts a lead to a won client: creates the client, its 3 payment
// milestones, and marks the source lead as "won".
export async function convertLeadToClient(
  lead: Lead,
  input: ConvertLeadInput
): Promise<Client> {
  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      lead_id: lead.id,
      full_name: lead.full_name,
      email: lead.email,
      phone: lead.phone,
      project_brief: lead.project_brief,
      zoom_link: lead.zoom_link,
      total_amount: input.total_amount,
      freelancer_id: input.freelancer_id ?? null,
      freelancer_payment: input.freelancer_payment ?? 0,
      won_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  const milestones = [
    { label: "First Payment", sort_order: 1, amount: input.first_payment },
    { label: "Second Payment", sort_order: 2, amount: input.second_payment },
    { label: "Third Payment", sort_order: 3, amount: input.third_payment },
  ].map((m) => ({ ...m, client_id: client.id }));

  const { error: pErr } = await supabase.from("payments").insert(milestones);
  if (pErr) throw pErr;

  await supabase
    .from("leads")
    .update({ status: "won", updated_at: new Date().toISOString() })
    .eq("id", lead.id);

  return client;
}

export async function updateClient(
  id: string,
  input: Partial<Client>
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export async function assignFreelancer(
  clientId: string,
  freelancerId: string | null,
  freelancerPayment: number
): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({
      freelancer_id: freelancerId,
      freelancer_payment: freelancerPayment,
    })
    .eq("id", clientId);
  if (error) throw error;
}

export async function setFreelancerPaid(
  clientId: string,
  paid: boolean
): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({
      freelancer_paid: paid,
      freelancer_paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", clientId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Payment milestones
// ---------------------------------------------------------------------------
export async function updatePaymentAmount(
  id: string,
  amount: number
): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({ amount })
    .eq("id", id);
  if (error) throw error;
}

export async function setPaymentPaid(
  id: string,
  paid: boolean
): Promise<Payment> {
  const { data, error } = await supabase
    .from("payments")
    .update({
      is_paid: paid,
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Freelancer payment milestones (pay a freelancer in installments)
// ---------------------------------------------------------------------------
export async function addFreelancerPayment(
  clientId: string,
  label: string,
  amount: number,
  sortOrder: number
): Promise<FreelancerPayment> {
  const { data, error } = await supabase
    .from("freelancer_payments")
    .insert({
      client_id: clientId,
      label,
      amount,
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateFreelancerPaymentAmount(
  id: string,
  amount: number
): Promise<void> {
  const { error } = await supabase
    .from("freelancer_payments")
    .update({ amount })
    .eq("id", id);
  if (error) throw error;
}

export async function setFreelancerPaymentPaid(
  id: string,
  paid: boolean
): Promise<void> {
  const { error } = await supabase
    .from("freelancer_payments")
    .update({
      is_paid: paid,
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFreelancerPayment(id: string): Promise<void> {
  const { error } = await supabase
    .from("freelancer_payments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
