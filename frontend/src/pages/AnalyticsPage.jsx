import { useEffect, useState } from "react";
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
import { api } from "../api";
import { DEFECT_TYPE_MAP, STATUS_META } from "../constants";

const tooltipStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text-primary)",
};

const ACTION_META = {
  approve: { label: "Approved", color: "var(--status-good)" },
  reject: { label: "Rejected", color: "var(--status-critical)" },
  defer: { label: "Deferred", color: "var(--status-warning)" },
};

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(null);
  const [byType, setByType] = useState([]);
  const [byDistrict, setByDistrict] = useState([]);
  const [trend, setTrend] = useState([]);
  const [funnel, setFunnel] = useState([]);

  useEffect(() => {
    api.analyticsSummary().then(setSummary);
    api.analyticsByType().then(setByType);
    api.analyticsByDistrict().then(setByDistrict);
    api.analyticsTrend().then(setTrend);
    api.analyticsApprovalFunnel().then(setFunnel);
  }, []);

  return (
    <div>
      <h1 className="page-title">Analytics</h1>
      <p className="page-subtitle">City-wide view of defect volume, mix, and the human review workflow.</p>

      {summary && (
        <div className="stat-row">
          <StatTile label="Total defects" value={summary.total_defects} />
          <StatTile label="Open" value={summary.open} />
          <StatTile label="Scheduled" value={summary.scheduled} color="var(--status-good)" />
          <StatTile label="Rejected" value={summary.rejected} color="var(--status-critical)" />
          <StatTile label="Deferred" value={summary.deferred} color="var(--status-warning)" />
        </div>
      )}

      <div className="grid-2">
        <div className="card chart-card">
          <h3>Defects by type</h3>
          <p className="chart-caption">Count of open + reviewed defects per defect class.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType} margin={{ left: -18, top: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gridline)" vertical={false} />
              <XAxis dataKey="defect_class" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 11, fill: "var(--text-secondary)" }}>
                {byType.map((entry) => (
                  <Cell key={entry.defect_class} fill={DEFECT_TYPE_MAP[entry.defect_class]?.color || "var(--series-1)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <h3>Defects by district</h3>
          <p className="chart-caption">Count of defects per Almaty district (illustrative demo geography).</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byDistrict} margin={{ left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gridline)" vertical={false} />
              <XAxis dataKey="district" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="count" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2">
        <div className="card chart-card">
          <h3>Defects reported over time</h3>
          <p className="chart-caption">New defects created per day.</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gridline)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="var(--series-1)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <h3>Human review outcomes</h3>
          <p className="chart-caption">How analysts have resolved reviewed defects so far.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnel} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gridline)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="action"
                tickFormatter={(v) => ACTION_META[v]?.label || v}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--baseline)" }}
                width={80}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "var(--text-secondary)" }}>
                {funnel.map((entry) => (
                  <Cell key={entry.action} fill={ACTION_META[entry.action]?.color || "var(--series-1)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, color }) {
  return (
    <div className="card stat-tile">
      <div className="stat-value" style={color ? { color } : undefined}>
        {value ?? "—"}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
