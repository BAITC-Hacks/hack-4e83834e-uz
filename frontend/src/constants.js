// Fixed categorical order (never cycled/reassigned) - matches the validated
// palette's slot order. Used anywhere a defect_class needs an identity color.
export const DEFECT_TYPES = [
  { value: "pothole", label: "Pothole", color: "var(--series-1)" },
  { value: "crack", label: "Crack", color: "var(--series-2)" },
  { value: "broken_curb", label: "Broken curb", color: "var(--series-3)" },
  { value: "faded_marking", label: "Faded marking", color: "var(--series-4)" },
];

export const DEFECT_TYPE_MAP = Object.fromEntries(DEFECT_TYPES.map((t) => [t.value, t]));

export const DISTRICTS = ["Medeu", "Bostandyk", "Almaly", "Auezov", "Nauryzbay", "Turksib"];

// Status colors are reserved semantic slots, never reused as series colors.
export const STATUS_META = {
  open: { label: "Open", color: "var(--text-muted)" },
  scheduled: { label: "Scheduled", color: "var(--status-good)" },
  rejected: { label: "Rejected", color: "var(--status-critical)" },
  deferred: { label: "Deferred", color: "var(--status-warning)" },
};

export const FACTOR_COLORS = {
  severity: "var(--series-1)",
  traffic: "var(--series-2)",
  repeat_reports: "var(--series-3)",
};

export const FACTOR_LABELS = {
  severity: "Severity",
  traffic: "Traffic",
  repeat_reports: "Repeat reports",
};

export const API_BASE = "http://localhost:8000";
