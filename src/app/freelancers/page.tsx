"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SetupBanner } from "@/components/SetupBanner";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
} from "@/components/ui";
import { formatMoney } from "@/lib/format";
import {
  createFreelancer,
  deleteFreelancer,
  getClients,
  getFreelancers,
  updateFreelancer,
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
    const assigned = clients.filter((c) => c.freelancer_id === id);
    const owed = assigned.reduce(
      (s, c) => s + Number(c.freelancer_payment ?? 0),
      0
    );
    const paid = assigned
      .filter((c) => c.freelancer_paid)
      .reduce((s, c) => s + Number(c.freelancer_payment ?? 0), 0);
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
                <div className="mt-4 flex justify-end gap-1">
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
    </div>
  );
}
