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
} from "@/components/ui";
import { formatDateTime, formatMoney } from "@/lib/format";
import { financeForFreelancer, clientAssignments } from "@/lib/finance";
import {
  addFreelancerPayment,
  createFreelancer,
  deleteFreelancer,
  deleteFreelancerPayment,
  getClients,
  getFreelancers,
  setFreelancerPaymentPaid,
  updateFreelancer,
  updateFreelancerPaymentAmount,
  type FreelancerInput,
} from "@/lib/api";
import type {
  ClientWithRelations,
  Freelancer,
  FreelancerPayment,
} from "@/lib/types";

const emptyForm: FreelancerInput = {
  name: "",
  email: "",
  phone: "",
  specialty: "",
};

function installmentLabelFor(nextNo: number) {
  if (nextNo === 1) return "First Payment";
  if (nextNo === 2) return "Second Payment";
  if (nextNo === 3) return "Third Payment";
  return `Payment ${nextNo}`;
}

/** Same milestone row style used on Clients → Payment milestones. */
function InstallmentRow({
  payment,
  amount,
  onAmountChange,
  onSaveAmount,
  onTogglePaid,
  onDelete,
  busy,
}: {
  payment: FreelancerPayment;
  amount: string;
  onAmountChange: (value: string) => void;
  onSaveAmount: () => void;
  onTogglePaid: () => void;
  onDelete?: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3">
      <span className="w-28 text-sm font-medium text-slate-700">
        {payment.label}
      </span>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        className="w-32"
      />
      <Button
        variant="ghost"
        onClick={onSaveAmount}
        disabled={busy}
        className="!px-2 !text-xs"
      >
        Save
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {payment.is_paid ? (
          <span className="text-xs text-emerald-600">
            Paid {formatDateTime(payment.paid_at)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Unpaid</span>
        )}
        <Button
          variant={payment.is_paid ? "secondary" : "success"}
          onClick={onTogglePaid}
          disabled={busy}
          className="!py-1.5 !text-xs"
        >
          {payment.is_paid ? "Mark unpaid" : "Mark paid"}
        </Button>
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={busy}
            className="rounded-md px-1.5 py-1 text-xs text-red-600 hover:bg-red-50"
            aria-label="Delete payment"
            title="Delete payment"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function FreelancersPage() {
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [clients, setClients] = useState<ClientWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Freelancer | null>(null);
  const [form, setForm] = useState<FreelancerInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Freelancer | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, c] = await Promise.all([getFreelancers(), getClients()]);
      setFreelancers(f);
      setClients(c);
      setProfile((prev) => (prev ? f.find((x) => x.id === prev.id) ?? null : null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (f: Freelancer) => {
    setEditing(f);
    setForm({
      name: f.name,
      email: f.email ?? "",
      phone: f.phone ?? "",
      specialty: f.specialty ?? "",
    });
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await updateFreelancer(editing.id, form);
      else await createFreelancer(form);
      setFormOpen(false);
      await load();
    } catch (err) {
      alert("Could not save: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (f: Freelancer) => {
    if (
      !confirm(
        `Delete freelancer "${f.name}"? Their client assignments will be cleared.`
      )
    )
      return;
    try {
      await deleteFreelancer(f.id);
      await load();
    } catch (err) {
      alert("Could not delete: " + (err as Error).message);
    }
  };

  const projectsFor = (id: string) =>
    clients
      .filter((c) =>
        clientAssignments(c).some((a) => a.freelancer_id === id)
      )
      .map((c) => ({
        client: c,
        ...financeForFreelancer(c, id),
      }));

  const statsFor = (id: string) => {
    const projects = projectsFor(id);
    return {
      count: projects.length,
      owed: projects.reduce((s, p) => s + p.fee, 0),
      paid: projects.reduce((s, p) => s + p.paid, 0),
    };
  };

  const runCard = async (key: string, fn: () => Promise<unknown>) => {
    setBusyId(key);
    try {
      await fn();
      await load();
    } catch (err) {
      alert("Something went wrong: " + (err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const amountValue = (id: string, fallback: number) =>
    amounts[id] ?? String(fallback);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <SetupBanner />
      <PageHeader
        title="Freelancers"
        subtitle="The people you assign signed projects to."
        action={<Button onClick={openNew}>+ Add freelancer</Button>}
      />

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
      ) : freelancers.length === 0 ? (
        <EmptyState
          title="No freelancers yet"
          description="Add freelancers so you can assign them to won projects."
          action={<Button onClick={openNew}>+ Add freelancer</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {freelancers.map((f) => {
            const s = statsFor(f.id);
            const projects = projectsFor(f.id);
            const busy = busyId?.startsWith(f.id) ?? false;
            return (
              <Card key={f.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                      {f.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{f.name}</p>
                      {f.specialty && (
                        <p className="text-xs text-slate-400">{f.specialty}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setProfile(f)}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => openEdit(f)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(f)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  {f.email && <span className="truncate">{f.email}</span>}
                  {f.phone && <span>{f.phone}</span>}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                  <div>
                    <p className="text-xs text-slate-400">Projects</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {s.count}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Owed</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatMoney(s.owed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Paid</p>
                    <p className="text-sm font-semibold text-emerald-600">
                      {formatMoney(s.paid)}
                    </p>
                  </div>
                </div>

                {/* Payment installments — same style as client milestones */}
                <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                  <h4 className="text-sm font-semibold text-slate-800">
                    Payment milestones
                  </h4>
                  {projects.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                      No projects assigned yet.
                    </p>
                  ) : (
                    projects.map((proj) => {
                      const nextNo = proj.payments.length + 1;
                      return (
                        <div key={proj.client.id} className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-slate-600">
                              {proj.client.full_name}
                            </p>
                            <p className="text-xs text-slate-400">
                              Fee {formatMoney(proj.fee)}
                            </p>
                          </div>
                          {proj.payments.length === 0 ? (
                            <p className="text-xs text-slate-400">
                              No installments yet.
                            </p>
                          ) : (
                            proj.payments.map((p) => (
                              <InstallmentRow
                                key={p.id}
                                payment={p}
                                amount={amountValue(p.id, p.amount)}
                                onAmountChange={(v) =>
                                  setAmounts({ ...amounts, [p.id]: v })
                                }
                                onSaveAmount={() =>
                                  runCard(`${f.id}-${p.id}`, () =>
                                    updateFreelancerPaymentAmount(
                                      p.id,
                                      Number(amountValue(p.id, p.amount) || 0)
                                    )
                                  )
                                }
                                onTogglePaid={() =>
                                  runCard(`${f.id}-${p.id}`, () =>
                                    setFreelancerPaymentPaid(p.id, !p.is_paid)
                                  )
                                }
                                busy={busy}
                              />
                            ))
                          )}
                          <Button
                            variant="ghost"
                            onClick={() =>
                              runCard(`${f.id}-add-${proj.client.id}`, () =>
                                addFreelancerPayment(
                                  proj.client.id,
                                  f.id,
                                  installmentLabelFor(nextNo),
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
                      );
                    })
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit freelancer" : "Add freelancer"}
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
              required
              autoFocus
            />
          </Field>
          <Field label="Specialty">
            <Input
              value={form.specialty ?? ""}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              placeholder="e.g. Food photographer, Designer"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@email.com"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 555 123 4567"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add freelancer"}
            </Button>
          </div>
        </form>
      </Modal>

      {profile && (
        <FreelancerProfile
          freelancer={profile}
          clients={clients.filter((c) =>
            clientAssignments(c).some((a) => a.freelancer_id === profile.id)
          )}
          onClose={() => setProfile(null)}
          onChange={load}
        />
      )}
    </div>
  );
}

function FreelancerProfile({
  freelancer,
  clients,
  onClose,
  onChange,
}: {
  freelancer: Freelancer;
  clients: ClientWithRelations[];
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const perProject = clients.map((c) => ({
    client: c,
    ...financeForFreelancer(c, freelancer.id),
  }));
  const owed = perProject.reduce((s, p) => s + p.fee, 0);
  const received = perProject.reduce((s, p) => s + p.paid, 0);
  const outstanding = Math.max(owed - received, 0);

  const amountValue = (id: string, fallback: number) =>
    amounts[id] ?? String(fallback);

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

  return (
    <Modal open onClose={onClose} title={freelancer.name} wide>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
          <div>
            <span className="block text-xs text-slate-400">Specialty</span>
            <span className="text-slate-700">{freelancer.specialty || "—"}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Email</span>
            <span className="text-slate-700">{freelancer.email || "—"}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Phone</span>
            <span className="text-slate-700">{freelancer.phone || "—"}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-400">Total owed</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatMoney(owed)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-400">Received</p>
            <p className="text-lg font-semibold text-emerald-600">
              {formatMoney(received)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-400">Outstanding</p>
            <p className="text-lg font-semibold text-amber-600">
              {formatMoney(outstanding)}
            </p>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">
            Payment milestones
          </h4>
          {clients.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
              Not assigned to any projects yet.
            </p>
          ) : (
            <div className="space-y-5">
              {perProject.map((f) => {
                const status =
                  f.fee > 0 && f.outstanding <= 0
                    ? "paid"
                    : f.paid > 0
                    ? "partial"
                    : "unpaid";
                const nextNo = f.payments.length + 1;
                return (
                  <div key={f.client.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {f.client.full_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          Fee {formatMoney(f.fee)} · received{" "}
                          {formatMoney(f.paid)} · owed{" "}
                          {formatMoney(f.outstanding)}
                        </p>
                      </div>
                      <Badge value={status} label={status} />
                    </div>
                    <div className="space-y-2">
                      {f.payments.length === 0 && (
                        <p className="text-xs text-slate-400">
                          No installments yet.
                        </p>
                      )}
                      {f.payments.map((p) => (
                        <InstallmentRow
                          key={p.id}
                          payment={p}
                          amount={amountValue(p.id, p.amount)}
                          onAmountChange={(v) =>
                            setAmounts({ ...amounts, [p.id]: v })
                          }
                          onSaveAmount={() =>
                            run(() =>
                              updateFreelancerPaymentAmount(
                                p.id,
                                Number(amountValue(p.id, p.amount) || 0)
                              )
                            )
                          }
                          onTogglePaid={() =>
                            run(() =>
                              setFreelancerPaymentPaid(p.id, !p.is_paid)
                            )
                          }
                          onDelete={() =>
                            run(() => deleteFreelancerPayment(p.id))
                          }
                          busy={busy}
                        />
                      ))}
                      <Button
                        variant="ghost"
                        onClick={() =>
                          run(() =>
                            addFreelancerPayment(
                              f.client.id,
                              freelancer.id,
                              installmentLabelFor(nextNo),
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
                    <div className="mt-2 flex gap-4 text-sm text-slate-500">
                      <span>Received: {formatMoney(f.paid)}</span>
                      <span>Outstanding: {formatMoney(f.outstanding)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
