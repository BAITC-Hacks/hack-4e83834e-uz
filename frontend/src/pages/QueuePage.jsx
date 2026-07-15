import { useEffect, useState } from "react";
import { api, mediaUrl } from "../api";
import { DEFECT_TYPE_MAP } from "../constants";
import FilterBar from "../components/FilterBar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import DefectDetailModal from "../components/DefectDetailModal.jsx";

export default function QueuePage() {
  const [filters, setFilters] = useState({ status: "open" });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    const params = {};
    if (filters.defect_class) params.defect_class = filters.defect_class;
    if (filters.district) params.district = filters.district;
    params.status = filters.status || "open";
    api
      .getQueue(params)
      .then(setItems)
      .finally(() => setLoading(false));
  }

  useEffect(load, [filters.defect_class, filters.district, filters.status]);

  function handleUpdated(updatedDefect) {
    setSelected(updatedDefect);
    load();
  }

  return (
    <div>
      <h1 className="page-title">Repair priority queue</h1>
      <p className="page-subtitle">
        Ranked by the learned priority model (severity + traffic + repeat reports). Nothing here is scheduled until
        a human analyst approves it.
      </p>
      <FilterBar filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card empty-state">No defects match these filters.</div>
      ) : (
        <div className="queue-list">
          {items.map(({ rank, defect }) => {
            const typeMeta = DEFECT_TYPE_MAP[defect.defect_class];
            return (
              <div className="card queue-row" key={defect.id} onClick={() => setSelected(defect)}>
                <div className="rank-badge">{rank}</div>
                <img className="queue-thumb" src={mediaUrl(defect.image_url)} alt={defect.defect_class} />
                <div className="queue-main">
                  <div className="queue-title-row">
                    <span className="type-dot" style={{ background: typeMeta?.color }} />
                    {typeMeta?.label || defect.defect_class}
                    <StatusBadge status={defect.status} />
                  </div>
                  <div className="queue-sub">{defect.explanation}</div>
                </div>
                <div className="queue-score">
                  <div className="queue-score-value">{(defect.priority_score * 100).toFixed(0)}</div>
                  <div className="queue-score-label">priority</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DefectDetailModal defect={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
    </div>
  );
}
