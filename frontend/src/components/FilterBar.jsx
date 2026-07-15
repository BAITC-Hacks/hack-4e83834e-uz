import { DEFECT_TYPES, DISTRICTS } from "../constants";

export default function FilterBar({ filters, onChange, showStatus = true }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <div className="filter-bar">
      <select value={filters.defect_class || ""} onChange={set("defect_class")}>
        <option value="">All defect types</option>
        {DEFECT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select value={filters.district || ""} onChange={set("district")}>
        <option value="">All districts</option>
        {DISTRICTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      {showStatus && (
        <select value={filters.status || "open"} onChange={set("status")}>
          <option value="open">Open (needs review)</option>
          <option value="scheduled">Scheduled</option>
          <option value="rejected">Rejected</option>
          <option value="deferred">Deferred</option>
        </select>
      )}
    </div>
  );
}
