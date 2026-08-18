import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsSummary } from "@sixsync/shared";
import { getAnalyticsSummary } from "../api/client";
import { useWsEvents } from "../api/useWsEvents";

const STATUS_COLOR: Record<string, string> = {
  REPORTED: "#64748b",
  CONFIRMED: "#f59e0b",
  CRITICAL: "#ef4444",
  DISPUTED: "#a855f7",
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="text-sm font-semibold text-slate-200 mb-3">{title}</h2>
      {children}
    </div>
  );
}

const tooltipStyle = { backgroundColor: "#0f172a", border: "1px solid #1e293b", fontSize: 12, color: "#e2e8f0" };
const axisTick = { fill: "#64748b", fontSize: 11 };

function Analytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  const refresh = useCallback(async () => {
    setSummary(await getAnalyticsSummary());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useWsEvents((event) => {
    if (event.type === "report:new" || event.type === "report:updated" || event.type === "campaign:new") {
      refresh();
    }
  });

  if (!summary) return <p className="text-slate-500 text-sm">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Analytics</h1>
        <p className="text-sm text-slate-500">Network-wide trends across every reporting org.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500">Total reports</p>
          <p className="text-2xl font-semibold">{summary.totalReports}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500">Organizations</p>
          <p className="text-2xl font-semibold">{summary.totalOrgs}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500">Active campaigns</p>
          <p className="text-2xl font-semibold">{summary.totalCampaigns}</p>
        </div>
      </div>

      <ChartCard title="Reports over time (last 30 days)">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={summary.reportsByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={axisTick} />
            <YAxis tick={axisTick} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="count" stroke="#38bdf8" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Status breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary.statusBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="status" tick={axisTick} />
              <YAxis tick={axisTick} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {summary.statusBreakdown.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLOR[entry.status] ?? "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top attack types">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary.attackTypeBreakdown} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={axisTick} allowDecimals={false} />
              <YAxis type="category" dataKey="attackType" tick={axisTick} width={110} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#38bdf8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Top orgs by report volume">
        <div className="space-y-2">
          {summary.topOrgs.map((o) => (
            <div key={o.name} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{o.name}</span>
              <span className="text-slate-500">
                {o.reportsCount} reports · {o.reputation.toFixed(0)} rep
              </span>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}

export default Analytics;
