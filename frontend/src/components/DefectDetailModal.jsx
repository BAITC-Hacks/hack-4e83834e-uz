import { useState } from "react";
import { mediaUrl } from "../api";
import { DEFECT_TYPE_MAP } from "../constants";
import ScoreBreakdown from "./ScoreBreakdown.jsx";
import ReviewActions from "./ReviewActions.jsx";
import StatusBadge from "./StatusBadge.jsx";

export default function DefectDetailModal({ defect, onClose, onUpdated }) {
  const [imgSize, setImgSize] = useState(null);
  if (!defect) return null;

  const typeMeta = DEFECT_TYPE_MAP[defect.defect_class];
  const [x1, y1, x2, y2] = defect.bbox;

  let overlayStyle = null;
  if (imgSize) {
    overlayStyle = {
      left: `${(x1 / imgSize.w) * 100}%`,
      top: `${(y1 / imgSize.h) * 100}%`,
      width: `${((x2 - x1) / imgSize.w) * 100}%`,
      height: `${((y2 - y1) / imgSize.h) * 100}%`,
    };
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="queue-title-row">
            <span className="type-dot" style={{ background: typeMeta?.color }} />
            {typeMeta?.label || defect.defect_class}
            <StatusBadge status={defect.status} />
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div>
            <div className="image-frame">
              <img
                src={mediaUrl(defect.image_url)}
                alt={defect.defect_class}
                onLoad={(e) => setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
              />
              {overlayStyle && <div className="bbox-overlay" style={overlayStyle} />}
            </div>
            <div className="explanation-box">{defect.explanation}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              Detection model: {defect.model_source} · confidence {(defect.confidence * 100).toFixed(0)}% · area{" "}
              {defect.area_pct.toFixed(1)}% of frame
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
              {defect.segment.name} · {defect.segment.district} · {defect.segment.daily_traffic.toLocaleString()}{" "}
              vehicles/day
            </div>

            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              Priority score: {(defect.priority_score * 100).toFixed(0)} / 100
              <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 12 }}>
                {" "}
                ({defect.scorer_used})
              </span>
            </div>
            <ScoreBreakdown breakdown={defect.score_breakdown_pct} />

            <div style={{ marginTop: 18, fontWeight: 700, fontSize: 14 }}>Human review</div>
            <ReviewActions defect={defect} onReviewed={onUpdated} />

            {defect.approval_logs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Decision log</div>
                {defect.approval_logs.map((log) => (
                  <div key={log.id} style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                    {new Date(log.decided_at).toLocaleString()} — <b>{log.action}</b> by {log.reviewer_name}
                    {log.comment ? `: "${log.comment}"` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
