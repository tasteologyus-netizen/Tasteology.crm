import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type {
  Client,
  ClientFreelancer,
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
    .select(
      "*, payments(*), freelancer_payments(*), client_freelancers(*, freelancer:freelancers(*)), freelancer:freelancers(*)"
    )
    .order("won_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as ClientWithRelations[];
  rows.forEach((c) => {
    c.payments?.sort((a, b) => a.sort_order - b.sort_order);
    c.freelancer_payments?.sort((a, b) => a.sort_order - b.sort_order);
    c.client_freelancers = c.client_freelancers ?? [];
  });
  return rows;
}

export interface ConvertLeadAssignment {
  freelancer_id: string;
  fee?: number;
  first_payment?: number;
  second_payment?: number;
  third_payment?: number;
}

export interface ConvertLeadInput {
  total_amount: number;
  first_payment: number;
  second_payment: number;
  third_payment: number;
  /** @deprecated use freelancers[] */
  freelancer_id?: string | null;
  /** @deprecated use freelancers[] */
  freelancer_payment?: number;
  freelancers?: ConvertLeadAssignment[];
}

/** Create First / Second / Third Payment rows for a freelancer on a project. */
async function seedFreelancerInstallments(
  clientId: string,
  freelancerId: string,
  first: number,
  second: number,
  third: number
): Promise<void> {
  const { error } = await supabase.from("freelancer_payments").insert([
    {
      client_id: clientId,
      freelancer_id: freelancerId,
      label: "First Payment",
      sort_order: 1,
      amount: first,
    },
    {
      client_id: clientId,
      freelancer_id: freelancerId,
      label: "Second Payment",
      sort_order: 2,
      amount: second,
    },
    {
      client_id: clientId,
      freelancer_id: freelancerId,
      label: "Third Payment",
      sort_order: 3,
      amount: third,
    },
  ]);
  if (error) throw error;
}

function assignmentFee(a: ConvertLeadAssignment): number {
  const parts =
    Number(a.first_payment ?? 0) +
    Number(a.second_payment ?? 0) +
    Number(a.third_payment ?? 0);
  if (parts > 0) return parts;
  return Number(a.fee ?? 0);
}

/** Keep legacy client.freelancer_id / freelancer_payment in sync with assignments. */
async function syncLegacyFreelancerFields(clientId: string): Promise<void> {
  const { data } = await supabase
    .from("client_freelancers")
    .select("freelancer_id, fee")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  const rows = data ?? [];
  const first = rows[0];
  const totalFee = rows.reduce((s, r) => s + Number(r.fee ?? 0), 0);
  await supabase
    .from("clients")
    .update({
      freelancer_id: first?.freelancer_id ?? null,
      freelancer_payment: totalFee,
    })
    .eq("id", clientId);
}

// Converts a lead to a won client: creates the client, its 3 payment
// milestones, optional freelancer assignments + installments, marks lead won.
export async function convertLeadToClient(
  lead: Lead,
  input: ConvertLeadInput
): Promise<Client> {
  const assignments: ConvertLeadAssignment[] =
    input.freelancers?.filter((a) => a.freelancer_id) ??
    (input.freelancer_id
      ? [
          {
            freelancer_id: input.freelancer_id,
            fee: input.freelancer_payment ?? 0,
            first_payment: input.freelancer_payment ?? 0,
          },
        ]
      : []);

  const totalFee = assignments.reduce((s, a) => s + assignmentFee(a), 0);
  const firstId = assignments[0]?.freelancer_id ?? null;

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
      freelancer_id: firstId,
      freelancer_payment: totalFee,
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

  if (assignments.length > 0) {
    const { error: aErr } = await supabase.from("client_freelancers").insert(
      assignments.map((a) => ({
        client_id: client.id,
        freelancer_id: a.freelancer_id,
        fee: assignmentFee(a),
      }))
    );
    if (aErr) throw aErr;

    for (const a of assignments) {
      const first = Number(a.first_payment ?? 0);
      const second = Number(a.second_payment ?? 0);
      const third = Number(a.third_payment ?? 0);
      const fee = assignmentFee(a);
      // If only a total fee was entered, put it on the first installment.
      await seedFreelancerInstallments(
        client.id,
        a.freelancer_id,
        first > 0 || second > 0 || third > 0 ? first : fee,
        second,
        third
      );
    }
  }

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

/** @deprecated Prefer addClientFreelancer / removeClientFreelancer */
export async function assignFreelancer(
  clientId: string,
  freelancerId: string | null,
  freelancerPayment: number
): Promise<void> {
  if (!freelancerId) {
    await supabase.from("client_freelancers").delete().eq("client_id", clientId);
    await syncLegacyFreelancerFields(clientId);
    return;
  }
  const { data: existing } = await supabase
    .from("client_freelancers")
    .select("id")
    .eq("client_id", clientId)
    .eq("freelancer_id", freelancerId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("client_freelancers")
      .update({ fee: freelancerPayment })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    // Replace single-legacy style: clear others then insert (old API was 1:1)
    await supabase.from("client_freelancers").delete().eq("client_id", clientId);
    const { error } = await supabase.from("client_freelancers").insert({
      client_id: clientId,
      freelancer_id: freelancerId,
      fee: freelancerPayment,
    });
    if (error) throw error;
  }
  await syncLegacyFreelancerFields(clientId);
}

export async function addClientFreelancer(
  clientId: string,
  freelancerId: string,
  fee: number,
  installments?: {
    first_payment?: number;
    second_payment?: number;
    third_payment?: number;
  }
): Promise<ClientFreelancer> {
  const first = Number(installments?.first_payment ?? 0);
  const second = Number(installments?.second_payment ?? 0);
  const third = Number(installments?.third_payment ?? 0);
  const parts = first + second + third;
  const resolvedFee = parts > 0 ? parts : fee;

  const { data, error } = await supabase
    .from("client_freelancers")
    .insert({
      client_id: clientId,
      freelancer_id: freelancerId,
      fee: resolvedFee,
    })
    .select("*, freelancer:freelancers(*)")
    .single();
  if (error) throw error;

  await seedFreelancerInstallments(
    clientId,
    freelancerId,
    parts > 0 ? first : resolvedFee,
    second,
    third
  );
  await syncLegacyFreelancerFields(clientId);
  return data as ClientFreelancer;
}

export async function updateClientFreelancerFee(
  assignmentId: string,
  fee: number
): Promise<void> {
  const { data, error } = await supabase
    .from("client_freelancers")
    .update({ fee })
    .eq("id", assignmentId)
    .select("client_id")
    .single();
  if (error) throw error;
  if (data?.client_id) await syncLegacyFreelancerFields(data.client_id);
}

export async function removeClientFreelancer(
  assignmentId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("client_freelancers")
    .delete()
    .eq("id", assignmentId)
    .select("client_id, freelancer_id")
    .single();
  if (error) throw error;
  if (data?.client_id && data.freelancer_id) {
    await supabase
      .from("freelancer_payments")
      .delete()
      .eq("client_id", data.client_id)
      .eq("freelancer_id", data.freelancer_id);
  }
  if (data?.client_id) await syncLegacyFreelancerFields(data.client_id);
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
  freelancerId: string,
  label: string,
  amount: number,
  sortOrder: number
): Promise<FreelancerPayment> {
  const { data, error } = await supabase
    .from("freelancer_payments")
    .insert({
      client_id: clientId,
      freelancer_id: freelancerId,
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
