"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SetupBanner } from "@/components/SetupBanner";
import { Card, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { financeSummary, type FinanceSummary } from "@/lib/finance";
import { getClients } from "@/lib/api";

export default function AccountingPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const clients = await getClients();
      setSummary(financeSummary(clients));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <SetupBanner />
      <PageHeader
        title="Accounting"
        subtitle="The full financial picture across all signed projects."
      />

      {loading || !summary ? (
        <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Money label="Total contracted" value={summary.totalContracted} big />
            <Money
              label="Received (down + payments)"
              value={summary.totalReceived}
              tone="emerald"
            />
            <Money
              label="Still outstanding"
              value={summary.totalOutstanding}
              tone="amber"
            />
            <Money
              label="Freelancer cost (total)"
              value={summary.totalFreelancerPayment}
            />
            <Money
              label="Paid to freelancers"
              value={summary.totalFreelancerPaid}
              tone="emerald"
            />
            <Money
              label="Owed to freelancers"
              value={summary.totalFreelancerOutstanding}
              tone="amber"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-sm text-slate-500">Net profit (cash in hand)</p>
              <p className="mt-1 text-3xl font-semibold text-brand-700">
                {formatMoney(summary.netProfit)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Received from clients − paid to freelancers
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-slate-500">Projected profit</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {formatMoney(summary.projectedProfit)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Total contracted − total freelancer cost
              </p>
            </Card>
          </div>

          <h2 className="mt-8 mb-3 text-sm font-semibold text-slate-800">
            Per project
          </h2>
          {summary.projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Win a lead to start tracking project finances."
            />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Project</th>
                      <th className="px-5 py-3 text-right">Total</th>
                      <th className="px-5 py-3 text-right">Received</th>
                      <th className="px-5 py-3 text-right">Outstanding</th>
                      <th className="px-5 py-3 text-right">Freelancer</th>
                      <th className="px-5 py-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.projects.map((p) => (
                      <tr key={p.client.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">
                            {p.client.full_name}
                          </div>
                          <div className="text-xs text-slate-400">
                            {p.client.freelancer?.name ?? "Unassigned"}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-slate-700">
                          {formatMoney(p.total)}
                        </td>
                        <td className="px-5 py-3 text-right text-emerald-600">
                          {formatMoney(p.received)}
                        </td>
                        <td className="px-5 py-3 text-right text-amber-600">
                          {formatMoney(p.outstanding)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-700">
                          {formatMoney(p.freelancerPayment)}
                          <span
                            className={`ml-1 text-xs ${
                              p.client.freelancer_paid
                                ? "text-emerald-500"
                                : "text-slate-400"
                            }`}
                          >
                            {p.client.freelancer_paid ? "paid" : "unpaid"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">
                          {formatMoney(p.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                      <td className="px-5 py-3">Totals</td>
                      <td className="px-5 py-3 text-right">
                        {formatMoney(summary.totalContracted)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatMoney(summary.totalReceived)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatMoney(summary.totalOutstanding)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatMoney(summary.totalFreelancerPayment)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatMoney(summary.projectedProfit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Money({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber";
  big?: boolean;
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "amber"
      ? "text-amber-600"
      : "text-slate-900";
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold ${big ? "text-3xl" : "text-2xl"} ${color}`}>
        {formatMoney(value)}
      </p>
    </Card>
  );
}
