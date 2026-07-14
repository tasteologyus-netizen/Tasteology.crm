"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SetupBanner } from "@/components/SetupBanner";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { formatDateTime, formatMoney } from "@/lib/format";
import { projectFinance } from "@/lib/finance";
import {
  assignFreelancer,
  deleteClient,
  getClients,
  getFreelancers,
  setFreelancerPaid,
  setPaymentPaid,
  updateClient,
  updatePaymentAmount,
} from "@/lib/api";
import type { ClientWithRelations, Freelancer } from "@/lib/types";

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithRelations[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ClientWithRelations | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, f] = await Promise.all([getClients(), getFreelancers()]);
      setClients(c);
      setFreelancers(f);
      setActive((prev) => (prev ? c.find((x) => x.id === prev.id) ?? null : null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 lg:p-8">
      <SetupBanner />
      <PageHeader
        title="Clients"
        subtitle="Signed projects. Track payments and freelancer assignment."
      />

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="When you mark a lead as Won, it becomes a client here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {clients.map((client) => {
            const fin = projectFinance(client);
            const pct =
              fin.total > 0
                ? Math.min(100, Math.round((fin.received / fin.total) * 100))
                : 0;
            return (
              <Card key={client.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {client.full_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      Signed {formatDateTime(client.won_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-900">
                      {formatMoney(fin.total)}
                    </p>
                    <p className="text-xs text-slate-400">total project</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>{formatMoney(fin.received)} received</span>
                    <span>{formatMoney(fin.outstanding)} outstanding</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {client.payments.map((p) => (
                    <span
                      key={p.id}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
                        p.is_paid
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-slate-50 text-slate-500 ring-slate-200"
                      }`}
                    >
                      {p.is_paid ? "✓" : "•"} {p.label.replace(" Payment", "")}:{" "}
                      {formatMoney(p.amount)}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="text-sm">
                    <span className="text-slate-400">Freelancer: </span>
                    {client.freelancer ? (
                      <span className="font-medium text-slate-700">
                        {client.freelancer.name}
                      </span>
                    ) : (
                      <span className="text-amber-600">Unassigned</span>
                    )}
                    {client.freelancer && (
                      <Badge
                        value={client.freelancer_paid ? "paid" : "unpaid"}
                        label={client.freelancer_paid ? "paid" : "unpaid"}
                      />
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setActive(client)}
                    className="!py-1.5 !text-xs"
                  >
                    Manage
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {active && (
        <ClientDetail
          client={active}
          freelancers={freelancers}
          onClose={() => setActive(null)}
          onChange={load}
        />
      )}
    </div>
  );
}

function ClientDetail({
  client,
  freelancers,
  onClose,
  onChange,
}: {
  client: ClientWithRelations;
  freelancers: Freelancer[];
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(String(client.total_amount ?? 0));
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(client.payments.map((p) => [p.id, String(p.amount)]))
  );
  const [freelancerId, setFreelancerId] = useState(client.freelancer_id ?? "");
  const [freelancerPay, setFreelancerPay] = useState(
    String(client.freelancer_payment ?? 0)
  );

  const fin = projectFinance(client);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await onChange();
    } catch (err) {
      alert("Something went wrong: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveTotal = () =>
    run(() => updateClient(client.id, { total_amount: Number(total || 0) }));

  const saveAmount = (id: string) =>
    run(() => updatePaymentAmount(id, Number(amounts[id] || 0)));

  const togglePaid = (id: string, paid: boolean) =>
    run(() => setPaymentPaid(id, paid).then(() => undefined));

  const saveFreelancer = () =>
    run(() =>
      assignFreelancer(
        client.id,
        freelancerId || null,
        Number(freelancerPay || 0)
      )
    );

  const toggleFreelancerPaid = (paid: boolean) =>
    run(() => setFreelancerPaid(client.id, paid));

  const remove = () => {
    if (!confirm(`Delete client "${client.full_name}"? This cannot be undone.`))
      return;
    run(async () => {
      await deleteClient(client.id);
      onClose();
    });
  };

  return (
    <Modal open onClose={onClose} title={client.full_name} wide>
      <div className="space-y-6">
        {/* Contact */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
          <Info label="Email" value={client.email} />
          <Info label="Phone" value={client.phone} />
          <Info label="Signed" value={formatDateTime(client.won_at)} />
          {client.zoom_link && (
            <div className="col-span-2 sm:col-span-3">
              <span className="text-xs text-slate-400">Zoom</span>
              <a
                href={client.zoom_link}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-brand-600 hover:underline"
              >
                {client.zoom_link}
              </a>
            </div>
          )}
          {client.project_brief && (
            <div className="col-span-2 sm:col-span-3">
              <span className="text-xs text-slate-400">Project brief</span>
              <p className="text-slate-700">{client.project_brief}</p>
            </div>
          )}
        </div>

        {/* Total */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">
            Project total
          </h4>
          <div className="flex items-end gap-2">
            <Field label="Total amount (USD)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </Field>
            <Button
              variant="secondary"
              onClick={saveTotal}
              disabled={busy}
              className="mb-0.5"
            >
              Save
            </Button>
          </div>
        </div>

        {/* Payments */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">
            Payment milestones
          </h4>
          <div className="space-y-2">
            {client.payments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3"
              >
                <span className="w-28 text-sm font-medium text-slate-700">
                  {p.label}
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amounts[p.id] ?? ""}
                  onChange={(e) =>
                    setAmounts({ ...amounts, [p.id]: e.target.value })
                  }
                  className="w-32"
                />
                <Button
                  variant="ghost"
                  onClick={() => saveAmount(p.id)}
                  disabled={busy}
                  className="!px-2 !text-xs"
                >
                  Save
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  {p.is_paid ? (
                    <span className="text-xs text-emerald-600">
                      Paid {formatDateTime(p.paid_at)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Unpaid</span>
                  )}
                  <Button
                    variant={p.is_paid ? "secondary" : "success"}
                    onClick={() => togglePaid(p.id, !p.is_paid)}
                    disabled={busy}
                    className="!py-1.5 !text-xs"
                  >
                    {p.is_paid ? "Mark unpaid" : "Mark paid"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-sm text-slate-500">
            <span>Received: {formatMoney(fin.received)}</span>
            <span>Outstanding: {formatMoney(fin.outstanding)}</span>
          </div>
        </div>

        {/* Freelancer */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">
            Freelancer assignment
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Freelancer">
              <Select
                value={freelancerId}
                onChange={(e) => setFreelancerId(e.target.value)}
              >
                <option value="">— Unassigned —</option>
                {freelancers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Freelancer payment (USD)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={freelancerPay}
                onChange={(e) => setFreelancerPay(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={saveFreelancer} disabled={busy}>
              Save assignment
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {client.freelancer_paid ? (
                <span className="text-xs text-emerald-600">
                  Paid {formatDateTime(client.freelancer_paid_at)}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Not paid yet</span>
              )}
              <Button
                variant={client.freelancer_paid ? "secondary" : "success"}
                onClick={() => toggleFreelancerPaid(!client.freelancer_paid)}
                disabled={busy || !client.freelancer_id}
                className="!py-1.5 !text-xs"
              >
                {client.freelancer_paid
                  ? "Mark freelancer unpaid"
                  : "Mark freelancer paid"}
              </Button>
            </div>
          </div>
        </div>

        {/* Profit + delete */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="text-sm">
            <span className="text-slate-400">Project profit: </span>
            <span className="font-semibold text-slate-900">
              {formatMoney(fin.profit)}
            </span>
          </div>
          <Button variant="danger" onClick={remove} disabled={busy}>
            Delete client
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="block text-xs text-slate-400">{label}</span>
      <span className="text-slate-700">{value || "—"}</span>
    </div>
  );
}
