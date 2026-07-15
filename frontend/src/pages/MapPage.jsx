import { useEffect, useState } from "react";
import { api } from "../api";
import FilterBar from "../components/FilterBar.jsx";
import MapView from "../components/MapView.jsx";
import DefectDetailModal from "../components/DefectDetailModal.jsx";
import { DEFECT_TYPE_MAP, DISTRICT_LABEL_MAP, STATUS_META } from "../constants";
import { useLang } from "../i18n.jsx";

export default function MapPage() {
  const { t, pick } = useLang();
  const [filters, setFilters] = useState({ status: "open" });
  const [defects, setDefects] = useState([]);
  const [selected, setSelected] = useState(null);

  function load() {
    const params = {};
    if (filters.defect_class) params.defect_class = filters.defect_class;
    if (filters.district) params.district = filters.district;
    if (filters.status) params.status = filters.status;
    api.getDefects(params).then(setDefects);
  }

  useEffect(load, [filters.defect_class, filters.district, filters.status]);

  function handleUpdated(updated) {
    setSelected(updated);
    load();
  }

  return (
    <div>
      <h1 className="page-title">{t("map_title")}</h1>
      <p className="page-subtitle">{t("map_subtitle")}</p>
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="legend-row">
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <span className="legend-item" key={key}>
            <span className="status-dot" style={{ background: meta.color }} />
            {pick(meta.label)}
          </span>
        ))}
      </div>
      <div className="map-page-layout">
        <div className="card map-sidebar">
          {defects.length === 0 ? (
            <div className="empty-state">{t("no_defects_match")}</div>
          ) : (
            defects
              .slice()
              .sort((a, b) => b.priority_score - a.priority_score)
              .map((d) => (
                <div
                  key={d.id}
                  className="queue-row"
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onClick={() => setSelected(d)}
                >
                  <div className="queue-main">
                    <div className="queue-title-row" style={{ fontSize: 13 }}>
                      {pick(DEFECT_TYPE_MAP[d.defect_class]?.label) || d.defect_class} — {d.segment.name}
                    </div>
                    <div className="queue-sub">{pick(DISTRICT_LABEL_MAP[d.segment.district]) || d.segment.district}</div>
                  </div>
                  <div className="queue-score">
                    <div className="queue-score-value" style={{ fontSize: 13 }}>
                      {(d.priority_score * 100).toFixed(0)}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
        <div className="card" style={{ overflow: "hidden" }}>
          <MapView defects={defects} onSelect={setSelected} />
        </div>
      </div>
      <DefectDetailModal defect={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
    </div>
  );
}
