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
  Textarea,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import {
  convertLeadToClient,
  createLead,
  deleteLead,
  getFreelancers,
  getLeads,
  updateLead,
  type LeadInput,
} from "@/lib/api";
import { LEAD_SOURCES, LEAD_STATUSES, type Freelancer, type Lead, type LeadStatus } from "@/lib/types";

const emptyForm: LeadInput = {
  full_name: "",
  email: "",
  phone: "",
  project_brief: "",
  zoom_link: "",
  source: "manual",
  status: "new",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [convertLead, setConvertLead] = useState<Lead | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, f] = await Promise.all([getLeads(), getFreelancers()]);
      setLeads(l);
      setFreelancers(f);
    } catch (e) {
      setError((e as Error).message);
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

  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setForm({
      full_name: lead.full_name,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      project_brief: lead.project_brief ?? "",
      zoom_link: lead.zoom_link ?? "",
      source: lead.source,
      status: lead.status,
    });
    setFormOpen(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateLead(editing.id, form);
      } else {
        await createLead(form);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      alert("Could not save lead: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (lead: Lead, status: LeadStatus) => {
    if (status === "won") {
      setConvertLead(lead);
      return;
    }
    try {
      await updateLead(lead.id, { status });
      await load();
    } catch (err) {
      alert("Could not update status: " + (err as Error).message);
    }
  };

  const remove = async (lead: Lead) => {
    if (!confirm(`Delete lead "${lead.full_name}"?`)) return;
    try {
      await deleteLead(lead.id);
      await load();
    } catch (err) {
      alert("Could not delete: " + (err as Error).message);
    }
  };

  const openLeads = useMemo(
    () => leads.filter((l) => l.status !== "won"),
    [leads]
  );

  return (
    <div className="p-6 lg:p-8">
      <SetupBanner />
      <PageHeader
        title="Leads"
        subtitle="Your pipeline. Add leads manually or track ones from Calendly."
        action={<Button onClick={openNew}>+ Add lead</Button>}
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
        ) : openLeads.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No active leads"
              description="Add your first lead to start tracking your pipeline."
              action={<Button onClick={openNew}>+ Add lead</Button>}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {openLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">
                        {lead.full_name}
                      </div>
                      {lead.project_brief && (
                        <div className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                          {lead.project_brief}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <div>{lead.email || "—"}</div>
                      <div className="text-xs text-slate-400">
                        {lead.phone || ""}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge value={lead.source} />
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {formatDateTime(lead.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <Select
                        value={lead.status}
                        onChange={(e) =>
                          changeStatus(lead, e.target.value as LeadStatus)
                        }
                        className="w-32 capitalize"
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s} className="capitalize">
                            {s}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        {lead.zoom_link && (
                          <a
                            href={lead.zoom_link}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                          >
                            Zoom
                          </a>
                        )}
                        <button
                          onClick={() => openEdit(lead)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(lead)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 text-xs text-slate-400">
        Tip: set a lead to <span className="font-medium">Won</span> to sign the
        project and move it to Clients.
      </p>

      {/* Add / edit lead */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit lead" : "Add lead"}
        wide
      >
        <form onSubmit={submitForm} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                placeholder="Jane Doe"
                required
                autoFocus
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@email.com"
              />
            </Field>
            <Field label="Phone number">
              <Input
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 555 123 4567"
              />
            </Field>
            <Field label="Zoom meeting link">
              <Input
                value={form.zoom_link ?? ""}
                onChange={(e) =>
                  setForm({ ...form, zoom_link: e.target.value })
                }
                placeholder="https://zoom.us/j/…"
              />
            </Field>
            <Field label="Source">
              <Select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="capitalize"
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as LeadStatus })
                }
                className="capitalize"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Project brief">
            <Textarea
              value={form.project_brief ?? ""}
              onChange={(e) =>
                setForm({ ...form, project_brief: e.target.value })
              }
              placeholder="What does the client need?"
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
              {saving ? "Saving…" : editing ? "Save changes" : "Add lead"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Convert to client */}
      {convertLead && (
        <ConvertModal
          lead={convertLead}
          freelancers={freelancers}
          onClose={() => setConvertLead(null)}
          onDone={async () => {
            setConvertLead(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ConvertModal({
  lead,
  freelancers,
  onClose,
  onDone,
}: {
  lead: Lead;
  freelancers: Freelancer[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [total, setTotal] = useState("");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [third, setThird] = useState("");
  const [freelancerId, setFreelancerId] = useState("");
  const [freelancerPay, setFreelancerPay] = useState("");
  const [saving, setSaving] = useState(false);

  const num = (v: string) => Number(v || 0);
  const milestonesTotal = num(first) + num(second) + num(third);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await convertLeadToClient(lead, {
        total_amount: num(total),
        first_payment: num(first),
        second_payment: num(second),
        third_payment: num(third),
        freelancer_id: freelancerId || null,
        freelancer_payment: num(freelancerPay),
      });
      onDone();
    } catch (err) {
      alert("Could not convert lead: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Win project — ${lead.full_name}`} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Marking this lead as <strong>Won</strong> signs the project and moves
          it to <strong>Clients</strong>.
        </div>
        <Field label="Total project amount (USD)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="0.00"
            required
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="First payment">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Second payment">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={second}
              onChange={(e) => setSecond(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Third payment">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={third}
              onChange={(e) => setThird(e.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>
        {milestonesTotal > 0 && num(total) > 0 && milestonesTotal !== num(total) && (
          <p className="text-xs text-amber-600">
            Note: your three payments add up to {milestonesTotal.toFixed(2)},
            which differs from the total {num(total).toFixed(2)}. You can adjust
            later on the client page.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Assign freelancer (optional)">
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
              placeholder="0.00"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="success" disabled={saving}>
            {saving ? "Saving…" : "Win & create client"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
