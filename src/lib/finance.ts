import type {
  ClientFreelancer,
  ClientWithRelations,
  FreelancerPayment,
} from "./types";

export interface ProjectFinance {
  client: ClientWithRelations;
  total: number;
  received: number;
  outstanding: number;
  freelancerPayment: number;
  freelancerPaid: number;
  freelancerOutstanding: number;
  profit: number; // total - freelancer payment
}

export interface FinanceSummary {
  totalContracted: number;
  totalReceived: number;
  totalOutstanding: number;
  totalFreelancerPayment: number;
  totalFreelancerPaid: number;
  totalFreelancerOutstanding: number;
  netProfit: number; // received - freelancer paid (cash in hand after payouts)
  projectedProfit: number; // contracted - freelancer payment
  projects: ProjectFinance[];
}

/** Assignments for a client, with legacy single-freelancer fallback. */
export function clientAssignments(
  client: ClientWithRelations
): ClientFreelancer[] {
  const rows = client.client_freelancers ?? [];
  if (rows.length > 0) return rows;
  if (client.freelancer_id) {
    return [
      {
        id: `legacy-${client.id}`,
        client_id: client.id,
        freelancer_id: client.freelancer_id,
        fee: Number(client.freelancer_payment ?? 0),
        created_at: client.created_at,
        freelancer: client.freelancer,
      },
    ];
  }
  return [];
}

export function freelancerDisplayNames(client: ClientWithRelations): string {
  const names = clientAssignments(client)
    .map((a) => a.freelancer?.name)
    .filter(Boolean) as string[];
  return names.length ? names.join(", ") : "Unassigned";
}

export function paymentsForFreelancer(
  client: ClientWithRelations,
  freelancerId: string
): FreelancerPayment[] {
  const all = client.freelancer_payments ?? [];
  const tagged = all.filter((p) => p.freelancer_id === freelancerId);
  if (tagged.length > 0) return tagged;
  // Legacy untagged milestones: only show on the sole assignee.
  const assignments = clientAssignments(client);
  if (
    assignments.length === 1 &&
    assignments[0].freelancer_id === freelancerId
  ) {
    return all.filter((p) => !p.freelancer_id);
  }
  return [];
}

export function financeForFreelancer(
  client: ClientWithRelations,
  freelancerId: string
) {
  const assignment = clientAssignments(client).find(
    (a) => a.freelancer_id === freelancerId
  );
  const fee = Number(assignment?.fee ?? 0);
  const pays = paymentsForFreelancer(client, freelancerId);
  const paid =
    pays.length > 0
      ? pays
          .filter((p) => p.is_paid)
          .reduce((s, p) => s + Number(p.amount ?? 0), 0)
      : client.freelancer_paid && client.freelancer_id === freelancerId
      ? fee
      : 0;
  return {
    fee,
    paid,
    outstanding: Math.max(fee - paid, 0),
    payments: pays,
  };
}

export function projectFinance(client: ClientWithRelations): ProjectFinance {
  const total = Number(client.total_amount ?? 0);
  const received = (client.payments ?? [])
    .filter((p) => p.is_paid)
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  const assignments = clientAssignments(client);
  const freelancerPayment =
    assignments.length > 0
      ? assignments.reduce((s, a) => s + Number(a.fee ?? 0), 0)
      : Number(client.freelancer_payment ?? 0);

  const freelancerMilestones = client.freelancer_payments ?? [];
  const freelancerPaid =
    freelancerMilestones.length > 0
      ? freelancerMilestones
          .filter((p) => p.is_paid)
          .reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
      : client.freelancer_paid
      ? freelancerPayment
      : 0;

  return {
    client,
    total,
    received,
    outstanding: Math.max(total - received, 0),
    freelancerPayment,
    freelancerPaid,
    freelancerOutstanding: Math.max(freelancerPayment - freelancerPaid, 0),
    profit: total - freelancerPayment,
  };
}

export function financeSummary(
  clients: ClientWithRelations[]
): FinanceSummary {
  const projects = clients.map(projectFinance);
  const sum = (fn: (p: ProjectFinance) => number) =>
    projects.reduce((acc, p) => acc + fn(p), 0);

  const totalContracted = sum((p) => p.total);
  const totalReceived = sum((p) => p.received);
  const totalFreelancerPayment = sum((p) => p.freelancerPayment);
  const totalFreelancerPaid = sum((p) => p.freelancerPaid);

  return {
    totalContracted,
    totalReceived,
    totalOutstanding: sum((p) => p.outstanding),
    totalFreelancerPayment,
    totalFreelancerPaid,
    totalFreelancerOutstanding: totalFreelancerPayment - totalFreelancerPaid,
    netProfit: totalReceived - totalFreelancerPaid,
    projectedProfit: totalContracted - totalFreelancerPayment,
    projects,
  };
}
