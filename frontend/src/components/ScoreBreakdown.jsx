import { FACTOR_COLORS, FACTOR_LABELS } from "../constants";

export default function ScoreBreakdown({ breakdown }) {
  return (
    <div>
      {Object.entries(breakdown).map(([key, pct]) => (
        <div className="breakdown-bar-row" key={key}>
          <span>{FACTOR_LABELS[key] || key}</span>
          <div className="breakdown-track">
            <div
              className="breakdown-fill"
              style={{ width: `${pct}%`, background: FACTOR_COLORS[key] || "var(--series-1)" }}
            />
          </div>
          <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
        </div>
      ))}
    </div>
  );
}
