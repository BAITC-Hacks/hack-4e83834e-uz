export const DEFECT_TYPES = [
  { value: "pothole", color: "var(--series-1)", label: { en: "Pothole", ru: "Выбоина" } },
  { value: "crack", color: "var(--series-2)", label: { en: "Crack", ru: "Трещина" } },
];

export const PLANNED_DEFECT_TYPES = [
  { value: "broken_curb", color: "var(--series-3)", label: { en: "Broken curb", ru: "Повреждённый бордюр" } },
  { value: "faded_marking", color: "var(--series-4)", label: { en: "Faded marking", ru: "Стёртая разметка" } },
];

export const DEFECT_TYPE_MAP = Object.fromEntries(
  [...DEFECT_TYPES, ...PLANNED_DEFECT_TYPES].map((t) => [t.value, t])
);

export const DISTRICTS = [
  { value: "Medeu", label: { en: "Medeu", ru: "Медеуский" } },
  { value: "Bostandyk", label: { en: "Bostandyk", ru: "Бостандыкский" } },
  { value: "Almaly", label: { en: "Almaly", ru: "Алмалинский" } },
  { value: "Auezov", label: { en: "Auezov", ru: "Ауэзовский" } },
  { value: "Nauryzbay", label: { en: "Nauryzbay", ru: "Наурызбайский" } },
  { value: "Turksib", label: { en: "Turksib", ru: "Турксибский" } },
  { value: "Esil", label: { en: "Esil (Astana)", ru: "Есильский (Астана)" } },
  { value: "Saryarka", label: { en: "Saryarka (Astana)", ru: "Сарыаркинский (Астана)" } },
  { value: "Baikonur", label: { en: "Baikonur (Astana)", ru: "Байконурский (Астана)" } },
  { value: "Almaty (Astana)", label: { en: "Almaty (Astana)", ru: "Алматинский (Астана)" } },
  { value: "Nura", label: { en: "Nura (Astana)", ru: "Нуринский (Астана)" } },
];

export const DISTRICT_LABEL_MAP = Object.fromEntries(DISTRICTS.map((d) => [d.value, d.label]));

export const STATUS_META = {
  open: { color: "var(--text-muted)", label: { en: "Open", ru: "Открыт" } },
  scheduled: { color: "var(--status-good)", label: { en: "Scheduled", ru: "Запланирован" } },
  rejected: { color: "var(--status-critical)", label: { en: "Rejected", ru: "Отклонён" } },
  deferred: { color: "var(--status-warning)", label: { en: "Deferred", ru: "Отложен" } },
};

export const FACTOR_COLORS = {
  severity: "var(--series-1)",
  traffic: "var(--series-2)",
  repeat_reports: "var(--series-3)",
};

export const FACTOR_LABELS = {
  severity: { en: "Severity", ru: "Серьёзность" },
  traffic: { en: "Traffic", ru: "Трафик" },
  repeat_reports: { en: "Repeat reports", ru: "Повторные обращения" },
};

export const ACTION_META = {
  approve: { color: "var(--status-good)", label: { en: "Approved", ru: "Одобрено" } },
  reject: { color: "var(--status-critical)", label: { en: "Rejected", ru: "Отклонено" } },
  defer: { color: "var(--status-warning)", label: { en: "Deferred", ru: "Отложено" } },
};

export const API_BASE = "http://localhost:8000";
