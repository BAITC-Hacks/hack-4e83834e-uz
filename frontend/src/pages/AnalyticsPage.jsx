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
import { ACTION_META, DEFECT_TYPE_MAP, DISTRICT_LABEL_MAP } from "../constants";
import { useLang } from "../i18n.jsx";

const tooltipStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text-primary)",
};

export default function AnalyticsPage() {
  const { t, pick } = useLang();
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
      <h1 className="page-title">{t("analytics_title")}</h1>
      <p className="page-subtitle">{t("analytics_subtitle")}</p>

      {summary && (
        <div className="stat-row">
          <StatTile label={t("stat_total")} value={summary.total_defects} />
          <StatTile label={t("stat_open")} value={summary.open} />
          <StatTile label={t("stat_scheduled")} value={summary.scheduled} color="var(--status-good)" />
          <StatTile label={t("stat_rejected")} value={summary.rejected} color="var(--status-critical)" />
          <StatTile label={t("stat_deferred")} value={summary.deferred} color="var(--status-warning)" />
        </div>
      )}

      <div className="grid-2">
        <div className="card chart-card">
          <h3>{t("chart_by_type_title")}</h3>
          <p className="chart-caption">{t("chart_by_type_caption")}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType} margin={{ left: -18, top: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gridline)" vertical={false} />
              <XAxis
                dataKey="defect_class"
                tickFormatter={(v) => pick(DEFECT_TYPE_MAP[v]?.label) || v}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--baseline)" }}
              />
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
          <h3>{t("chart_by_district_title")}</h3>
          <p className="chart-caption">{t("chart_by_district_caption")}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byDistrict} margin={{ left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gridline)" vertical={false} />
              <XAxis
                dataKey="district"
                tickFormatter={(v) => pick(DISTRICT_LABEL_MAP[v]) || v}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--baseline)" }}
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="count" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2">
        <div className="card chart-card">
          <h3>{t("chart_trend_title")}</h3>
          <p className="chart-caption">{t("chart_trend_caption")}</p>
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
          <h3>{t("chart_funnel_title")}</h3>
          <p className="chart-caption">{t("chart_funnel_caption")}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnel} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gridline)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="action"
                tickFormatter={(v) => pick(ACTION_META[v]?.label) || v}
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
