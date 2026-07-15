"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  clientAssignments,
  financeForFreelancer,
  freelancerDisplayNames,
  projectFinance,
} from "@/lib/finance";
import {
  addClientFreelancer,
  addFreelancerPayment,
  deleteClient,
  deleteFreelancerPayment,
  getClients,
  getFreelancers,
  removeClientFreelancer,
  setFreelancerPaymentPaid,
  setPaymentPaid,
  updateClient,
  updateClientFreelancerFee,
  updateFreelancerPaymentAmount,
  updatePaymentAmount,
} from "@/lib/api";
import type { ClientWithRelations, Freelancer } from "@/lib/types";

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithRelations[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ClientWithRelations | null>(null);
  const [query, setQuery] = useState("");

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

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const names = freelancerDisplayNames(c);
      const hay = [
        c.full_name,
        c.email,
        c.phone,
        c.project_brief,
        c.zoom_link,
        names,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, query]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <SetupBanner />
      <PageHeader
        title="Clients"
        subtitle="Signed projects. Track payments and freelancer assignment."
      />

      <div className="mb-4">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients by name, email, phone, freelancer…"
            className="pl-9"
            aria-label="Search clients"
          />
        </div>
        {query.trim() && (
          <p className="mt-1.5 text-xs text-slate-400">
            Showing {filteredClients.length} of {clients.length} clients
          </p>
        )}
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="When you mark a lead as Won, it becomes a client here."
        />
      ) : filteredClients.length === 0 ? (
        <EmptyState
          title="No matching clients"
          description={`Nothing matched “${query.trim()}”. Try a different name, email, or freelancer.`}
          action={
            <Button variant="secondary" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredClients.map((client) => {
            const fin = projectFinance(client);
            const assignments = clientAssignments(client);
            const pct =
              fin.total > 0
                ? Math.min(100, Math.round((fin.received / fin.total) * 100))
                : 0;
            const status =
              fin.freelancerPayment > 0 && fin.freelancerOutstanding <= 0
                ? "paid"
                : fin.freelancerPaid > 0
                ? "partial"
                : "unpaid";
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

                {/* Client payments */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Client payments
                  </p>
                  {client.payments.length === 0 ? (
                    <p className="text-xs text-slate-400">No client payments.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {client.payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-700">
                            {p.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-800">
                              {formatMoney(p.amount)}
                            </span>
                            {p.is_paid ? (
                              <Badge value="paid" label="paid" />
                            ) : (
                              <Badge value="unpaid" label="unpaid" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-3 text-xs text-slate-500">
                    <span>Received {formatMoney(fin.received)}</span>
                    <span>Left {formatMoney(fin.outstanding)}</span>
                  </div>
                </div>

                {/* Freelancer payments */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Freelancer payments
                  </p>
                  {assignments.length === 0 ? (
                    <p className="text-xs text-amber-600">No freelancers assigned.</p>
                  ) : (
                    <div className="space-y-3">
                      {assignments.map((a) => {
                        const ff = financeForFreelancer(
                          client,
                          a.freelancer_id
                        );
                        return (
                          <div key={a.id}>
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-800">
                                {a.freelancer?.name ?? "Freelancer"}
                              </p>
                              <p className="text-xs text-slate-400">
                                <span
                                  className={
                                    ff.outstanding > 0
                                      ? "font-semibold text-amber-600"
                                      : "font-semibold text-emerald-600"
                                  }
                                >
                                  {formatMoney(ff.outstanding)} left
                                </span>
                                {" · "}
                                {formatMoney(ff.paid)} paid of{" "}
                                {formatMoney(ff.fee)}
                              </p>
                            </div>
                            {ff.payments.length === 0 ? (
                              <p className="text-xs text-slate-400">
                                No installments yet.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {ff.payments.map((p) => (
                                  <div
                                    key={p.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm"
                                  >
                                    <span className="font-medium text-slate-700">
                                      {p.label}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-800">
                                        {formatMoney(p.amount)}
                                      </span>
                                      {p.is_paid ? (
                                        <Badge value="paid" label="paid" />
                                      ) : (
                                        <Badge value="unpaid" label="unpaid" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {assignments.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>
                        Freelancer total paid {formatMoney(fin.freelancerPaid)}
                      </span>
                      <span>
                        Still owed {formatMoney(fin.freelancerOutstanding)}
                      </span>
                      <Badge value={status} label={status} />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-4">
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
  const [addFreelancerId, setAddFreelancerId] = useState("");
  const [addFirst, setAddFirst] = useState("");
  const [addSecond, setAddSecond] = useState("");
  const [addThird, setAddThird] = useState("");
  const [feeEdits, setFeeEdits] = useState<Record<string, string>>({});
  const [fpAmounts, setFpAmounts] = useState<Record<string, string>>({});

  const fin = projectFinance(client);
  const assignments = clientAssignments(client);
  const assignedIds = new Set(assignments.map((a) => a.freelancer_id));
  const available = freelancers.filter((f) => !assignedIds.has(f.id));
  const addFeeTotal =
    Number(addFirst || 0) + Number(addSecond || 0) + Number(addThird || 0);

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

  const addAssignment = () => {
    if (!addFreelancerId) return;
    run(async () => {
      await addClientFreelancer(client.id, addFreelancerId, addFeeTotal, {
        first_payment: Number(addFirst || 0),
        second_payment: Number(addSecond || 0),
        third_payment: Number(addThird || 0),
      });
      setAddFreelancerId("");
      setAddFirst("");
      setAddSecond("");
      setAddThird("");
    });
  };

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

        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">
            Freelancer assignments
          </h4>
          <p className="mb-3 text-xs text-slate-400">
            Assign one or more freelancers and pay them in First / Second /
            Third installments — same as client payments.
          </p>

          {assignments.length === 0 ? (
            <p className="mb-3 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400">
              No freelancers assigned yet.
            </p>
          ) : (
            <div className="mb-4 space-y-3">
              {assignments.map((a) => {
                const ff = financeForFreelancer(client, a.freelancer_id);
                const nextNo = ff.payments.length + 1;
                const installmentLabel =
                  nextNo === 1
                    ? "First Payment"
                    : nextNo === 2
                    ? "Second Payment"
                    : nextNo === 3
                    ? "Third Payment"
                    : `Payment ${nextNo}`;
                return (
                  <div
                    key={a.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-[8rem] flex-1 text-sm font-medium text-slate-800">
                        {a.freelancer?.name ?? "Freelancer"}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={feeEdits[a.id] ?? String(a.fee)}
                        onChange={(e) =>
                          setFeeEdits({ ...feeEdits, [a.id]: e.target.value })
                        }
                        className="w-28"
                        title="Total fee"
                      />
                      <Button
                        variant="ghost"
                        onClick={() =>
                          run(() =>
                            updateClientFreelancerFee(
                              a.id,
                              Number(feeEdits[a.id] ?? a.fee) || 0
                            )
                          )
                        }
                        disabled={busy || a.id.startsWith("legacy-")}
                        className="!px-2 !text-xs"
                      >
                        Save fee
                      </Button>
                      <button
                        onClick={() =>
                          run(() => removeClientFreelancer(a.id))
                        }
                        disabled={busy || a.id.startsWith("legacy-")}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      <span
                        className={
                          ff.outstanding > 0
                            ? "font-semibold text-amber-600"
                            : "font-semibold text-emerald-600"
                        }
                      >
                        Fee {formatMoney(ff.outstanding)} left
                      </span>
                      {" · "}
                      {formatMoney(ff.paid)} paid of {formatMoney(ff.fee)}
                    </p>

                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      {ff.payments.length === 0 && (
                        <p className="text-xs text-slate-400">
                          No payment installments yet.
                        </p>
                      )}
                      {ff.payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span className="w-28 text-sm font-medium text-slate-700">
                            {p.label}
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={fpAmounts[p.id] ?? String(p.amount)}
                            onChange={(e) =>
                              setFpAmounts({
                                ...fpAmounts,
                                [p.id]: e.target.value,
                              })
                            }
                            className="w-28"
                          />
                          <Button
                            variant="ghost"
                            onClick={() =>
                              run(() =>
                                updateFreelancerPaymentAmount(
                                  p.id,
                                  Number(fpAmounts[p.id] ?? p.amount) || 0
                                )
                              )
                            }
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
                              <span className="text-xs text-slate-400">
                                Unpaid
                              </span>
                            )}
                            <Button
                              variant={p.is_paid ? "secondary" : "success"}
                              onClick={() =>
                                run(() =>
                                  setFreelancerPaymentPaid(p.id, !p.is_paid)
                                )
                              }
                              disabled={busy}
                              className="!py-1.5 !text-xs"
                            >
                              {p.is_paid ? "Mark unpaid" : "Mark paid"}
                            </Button>
                            <button
                              onClick={() =>
                                run(() => deleteFreelancerPayment(p.id))
                              }
                              disabled={busy}
                              className="rounded-md px-1.5 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        onClick={() =>
                          run(() =>
                            addFreelancerPayment(
                              client.id,
                              a.freelancer_id,
                              installmentLabel,
                              0,
                              nextNo
                            )
                          )
                        }
                        disabled={busy}
                        className="!px-2 !text-xs"
                      >
                        + Add installment
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-lg border border-dashed border-slate-300 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">
              Add freelancer
            </p>
            <Field label="Freelancer">
              <Select
                value={addFreelancerId}
                onChange={(e) => setAddFreelancerId(e.target.value)}
              >
                <option value="">— Choose —</option>
                {available.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Field label="First payment">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addFirst}
                  onChange={(e) => setAddFirst(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Second payment">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addSecond}
                  onChange={(e) => setAddSecond(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Third payment">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addThird}
                  onChange={(e) => setAddThird(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                Fee total: {formatMoney(addFeeTotal)}
              </span>
              <Button
                variant="secondary"
                onClick={addAssignment}
                disabled={busy || !addFreelancerId}
              >
                + Add freelancer
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="text-sm">
            <span className="text-slate-400">Project profit: </span>
            <span className="font-semibold text-slate-900">
              {formatMoney(fin.profit)}
            </span>
            <span className="ml-2 text-xs text-slate-400">
              (fees total {formatMoney(fin.freelancerPayment)})
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
