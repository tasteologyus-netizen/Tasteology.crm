"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SetupBanner } from "@/components/SetupBanner";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatDateTime, formatMoney, timeAgo } from "@/lib/format";
import { downloadIcs, googleCalendarUrl, type MeetingEvent } from "@/lib/calendar";
import { financeSummary } from "@/lib/finance";
import { getClients, getFreelancers, getLeads } from "@/lib/api";
import { LEAD_STATUSES, type ClientWithRelations, type Lead } from "@/lib/types";

interface Activity {
  id: string;
  when: string;
  text: string;
  tag: string;
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<ClientWithRelations[]>([]);
  const [freelancerCount, setFreelancerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, c, f] = await Promise.all([
        getLeads(),
        getClients(),
        getFreelancers(),
      ]);
      setLeads(l);
      setClients(c);
      setFreelancerCount(f.length);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fin = financeSummary(clients);
  const activeLeads = leads.filter((l) => l.status !== "won");

  const upcomingMeetings = leads
    .filter(
      (l) =>
        l.meeting_at && new Date(l.meeting_at).getTime() > Date.now() - 3600000
    )
    .sort(
      (a, b) =>
        new Date(a.meeting_at!).getTime() - new Date(b.meeting_at!).getTime()
    )
    .slice(0, 5);

  const pipeline = LEAD_STATUSES.map((s) => ({
    status: s,
    count: leads.filter((l) => l.status === s).length,
  }));

  // Build a simple recent-activity feed from timestamps
  const activity: Activity[] = [];
  leads.forEach((l) =>
    activity.push({
      id: "lead-" + l.id,
      when: l.created_at,
      text: `New lead: ${l.full_name}`,
      tag: l.source,
    })
  );
  clients.forEach((c) => {
    activity.push({
      id: "client-" + c.id,
      when: c.won_at,
      text: `Project won: ${c.full_name} (${formatMoney(c.total_amount)})`,
      tag: "won",
    });
    c.payments
      .filter((p) => p.is_paid && p.paid_at)
      .forEach((p) =>
        activity.push({
          id: "pay-" + p.id,
          when: p.paid_at!,
          text: `${p.label} received from ${c.full_name} (${formatMoney(p.amount)})`,
          tag: "paid",
        })
      );
  });
  activity.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  const recent = activity.slice(0, 8);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <SetupBanner />
      <PageHeader
        title="Dashboard"
        subtitle="Everything at a glance for Tasteology & Co."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label="Active leads"
              value={String(activeLeads.length)}
              href="/leads"
            />
            <Stat
              label="Clients"
              value={String(clients.length)}
              href="/clients"
            />
            <Stat
              label="Freelancers"
              value={String(freelancerCount)}
              href="/freelancers"
            />
            <Stat
              label="Net profit"
              value={formatMoney(fin.netProfit)}
              href="/accounting"
              accent
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
            <Money label="Total contracted" value={fin.totalContracted} />
            <Money
              label="Received"
              value={fin.totalReceived}
              tone="emerald"
            />
            <Money
              label="Outstanding"
              value={fin.totalOutstanding}
              tone="amber"
            />
            <Money
              label="Paid to freelancers"
              value={fin.totalFreelancerPaid}
            />
          </div>

          {upcomingMeetings.length > 0 && (
            <Card className="mt-6 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">
                  Upcoming meetings
                </h3>
                <Link
                  href="/leads"
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  View leads
                </Link>
              </div>
              <ul className="space-y-3">
                {upcomingMeetings.map((lead) => {
                  const ev: MeetingEvent = {
                    title: `Meeting — ${lead.full_name}`,
                    startIso: lead.meeting_at!,
                    details: lead.project_brief ?? "",
                    location: lead.zoom_link ?? "",
                  };
                  return (
                    <li
                      key={lead.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {lead.full_name}
                        </p>
                        <p className="text-xs text-brand-600">
                          {formatDateTime(lead.meeting_at)}
                        </p>
                      </div>
                      <div className="flex gap-1">
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
                        <a
                          href={googleCalendarUrl(ev)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md px-2 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50"
                        >
                          Calendar
                        </a>
                        <button
                          onClick={() =>
                            downloadIcs(ev, `meeting-${lead.full_name}.ics`)
                          }
                          className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          .ics
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Pipeline */}
            <Card className="p-5 lg:col-span-1">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">
                  Pipeline
                </h3>
                <Link
                  href="/leads"
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  View leads
                </Link>
              </div>
              <div className="space-y-3">
                {pipeline.map((p) => {
                  const max = Math.max(...pipeline.map((x) => x.count), 1);
                  return (
                    <div key={p.status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <Badge value={p.status} />
                        <span className="font-medium text-slate-700">
                          {p.count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${(p.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Recent activity */}
            <Card className="p-5 lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold text-slate-800">
                Recent activity
              </h3>
              {recent.length === 0 ? (
                <EmptyState
                  title="Nothing yet"
                  description="Add a lead to see your activity timeline here."
                />
              ) : (
                <ul className="space-y-3">
                  {recent.map((a) => (
                    <li key={a.id} className="flex items-start gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                      <div className="flex-1">
                        <p className="text-sm text-slate-700">{a.text}</p>
                        <p className="text-xs text-slate-400">
                          {timeAgo(a.when)}
                        </p>
                      </div>
                      <Badge value={a.tag} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="p-5 transition-shadow hover:shadow-md">
        <p className="text-sm text-slate-500">{label}</p>
        <p
          className={`mt-1 text-2xl font-semibold ${
            accent ? "text-brand-700" : "text-slate-900"
          }`}
        >
          {value}
        </p>
      </Card>
    </Link>
  );
}

function Money({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber";
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
      <p className={`mt-1 text-xl font-semibold ${color}`}>
        {formatMoney(value)}
      </p>
    </Card>
  );
}
