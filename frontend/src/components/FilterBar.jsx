import { DEFECT_TYPES, DISTRICTS } from "../constants";
import { useLang } from "../i18n.jsx";

export default function FilterBar({ filters, onChange, showStatus = true }) {
  const { t, pick } = useLang();
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <div className="filter-bar">
      <select value={filters.defect_class || ""} onChange={set("defect_class")}>
        <option value="">{t("filter_all_types")}</option>
        {DEFECT_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {pick(type.label)}
          </option>
        ))}
      </select>
      <select value={filters.district || ""} onChange={set("district")}>
        <option value="">{t("filter_all_districts")}</option>
        {DISTRICTS.map((d) => (
          <option key={d.value} value={d.value}>
            {pick(d.label)}
          </option>
        ))}
      </select>
      {showStatus && (
        <select value={filters.status || "open"} onChange={set("status")}>
          <option value="open">{t("filter_status_open")}</option>
          <option value="scheduled">{t("filter_status_scheduled")}</option>
          <option value="rejected">{t("filter_status_rejected")}</option>
          <option value="deferred">{t("filter_status_deferred")}</option>
        </select>
      )}
    </div>
  );
}
