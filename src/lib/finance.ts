import type { ClientWithRelations } from "./types";

export interface ProjectFinance {
  client: ClientWithRelations;
  total: number;
  received: number;
  outstanding: number;
  freelancerPayment: number;
  freelancerPaid: number;
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

export function projectFinance(client: ClientWithRelations): ProjectFinance {
  const total = Number(client.total_amount ?? 0);
  const received = (client.payments ?? [])
    .filter((p) => p.is_paid)
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const freelancerPayment = Number(client.freelancer_payment ?? 0);
  const freelancerPaid = client.freelancer_paid ? freelancerPayment : 0;
  return {
    client,
    total,
    received,
    outstanding: Math.max(total - received, 0),
    freelancerPayment,
    freelancerPaid,
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
