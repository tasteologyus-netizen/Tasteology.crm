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
import type { ClientWithRelations, Freelancer } from "@/lib/types";

const emptyForm: FreelancerInput = {
  name: "",
  email: "",
  phone: "",
  specialty: "",
};

export default function FreelancersPage() {
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [clients, setClients] = useState<ClientWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Freelancer | null>(null);
  const [form, setForm] = useState<FreelancerInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Freelancer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, c] = await Promise.all([getFreelancers(), getClients()]);
      setFreelancers(f);
      setClients(c);
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
    if (!confirm(`Delete freelancer "${f.name}"? Their client assignments will be cleared.`))
      return;
    try {
      await deleteFreelancer(f.id);
      await load();
    } catch (err) {
      alert("Could not delete: " + (err as Error).message);
    }
  };

  const statsFor = (id: string) => {
    const assigned = clients.filter((c) =>
      clientAssignments(c).some((a) => a.freelancer_id === id)
    );
    let owed = 0;
    let paid = 0;
    for (const c of assigned) {
      const f = financeForFreelancer(c, id);
      owed += f.fee;
      paid += f.paid;
    }
    return { count: assigned.length, owed, paid };
  };

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {freelancers.map((f) => {
            const s = statsFor(f.id);
            return (
              <Card key={f.id} className="p-5">
                <div className="flex items-start justify-between">
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
                </div>
                <div className="mt-4 space-y-1 text-sm text-slate-600">
                  {f.email && <p className="truncate">{f.email}</p>}
                  {f.phone && <p className="text-slate-400">{f.phone}</p>}
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
                <div className="mt-4 flex items-center justify-between gap-1">
                  <button
                    onClick={() => setProfile(f)}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                  >
                    View profile
                  </button>
                  <div className="flex gap-1">
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
            Projects ({clients.length})
          </h4>
          {clients.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
              Not assigned to any projects yet.
            </p>
          ) : (
            <div className="space-y-3">
              {perProject.map((f) => {
                const status =
                  f.fee > 0 && f.outstanding <= 0
                    ? "paid"
                    : f.paid > 0
                    ? "partial"
                    : "unpaid";
                const nextNo = f.payments.length + 1;
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
                    key={f.client.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between">
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

                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Payment installments
                      </p>
                      {f.payments.length === 0 && (
                        <p className="text-xs text-slate-400">
                          No payments recorded yet. Add First / Second / Third
                          installments below.
                        </p>
                      )}
                      {f.payments.map((p) => (
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
                            value={amountValue(p.id, p.amount)}
                            onChange={(e) =>
                              setAmounts({ ...amounts, [p.id]: e.target.value })
                            }
                            className="w-28"
                          />
                          <Button
                            variant="ghost"
                            onClick={() =>
                              run(() =>
                                updateFreelancerPaymentAmount(
                                  p.id,
                                  Number(amountValue(p.id, p.amount) || 0)
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
                              aria-label="Delete payment"
                              title="Delete payment"
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
                              f.client.id,
                              freelancer.id,
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
        </div>
      </div>
    </Modal>
  );
}
